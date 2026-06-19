/**
 * Higgsfield Provider — Cloud REST API adapter (IMAGE, U0)
 *
 * Slots behind the existing image-router seam as an ADDITIVE provider. It calls
 * Higgsfield's Cloud REST API (submit job → poll until completed) and returns the
 * same normalized `GeneratedImage` shape the other image-router providers return.
 *
 * Design notes (see docs/_brain_outputs/architecture-rd.md §2):
 * - This adapter is the ONLY place that knows the Higgsfield REST contract.
 * - Async = submit (POST) then poll (GET) until completed/failed, with a wall-clock
 *   budget so a serverless request never hangs past the platform timeout.
 * - Credentials are read ONLY via getConfig().higgsfieldApiKey (never the client bundle).
 * - On a missing key it throws a typed HiggsfieldError so the router can fall back.
 *
 * SCOPE: image only. Video / brand-DNA (soul_id) / autopilot are LATER rungs.
 */

import { getConfig, getSupabase } from '../config'
import type { GeneratedImage } from '../types'

// ============================================================================
// REST CONTRACT CONSTANTS — FULLY RECONCILED against the LIVE API (U0 live-verify
// FINAL, 2026-06-17) with BOTH credential halves set + cross-checked against the
// official higgsfield-ai/higgsfield-js V1 SDK source. See U0-live-verify.md.
//
// VERIFIED LIVE (GET probes, 200 OK, zero credits) + ONE real image generation:
//  - Base URL is `platform.higgsfield.ai` (the old `api.higgsfield.ai` DNS-failed).
//  - Auth is a key:secret PAIR sent as TWO HEADERS: `hf-api-key: <KEY_ID>` +
//    `hf-secret: <KEY_SECRET>` (the V1 SDK shape). LIVE: this returns 200 on
//    `GET /v1/motions`. `Authorization: Key id:secret` (V2 shape) ALSO works, but
//    `Basic base64(key:secret)` → 401, and no auth → 401. We use the V1 two-header
//    form (matches the maintained Node SDK transport).
//  - Submit is MODEL-ROUTED: `POST /v1/text2image/soul` with body wrapped as
//    `{ params: { prompt, width_and_height, quality, batch_size, ... } }`. There is
//    NO generic `model` field and NO `z_image` REST id — `z_image` is an MCP-only
//    catalog id; the cheapest REST text-to-image is Soul at 720p / batch_size 1.
//  - Submit RESPONSE is a JobSet: `{ id, jobs:[{ id, status, results }] }`.
//  - Poll: `GET /v1/job-sets/{id}` → `{ id, jobs:[{ status, results:{ raw:{url,type},
//    min:{url,type} } }] }`. Result image URL = `jobs[0].results.raw.url`.
//  - Status enum (per-job): queued | in_progress | completed | nsfw | failed | canceled.
// ============================================================================

/** Base URL of the Higgsfield Cloud REST API. VERIFIED reachable + authenticated (200). */
const HF_DEFAULT_BASE_URL = 'https://platform.higgsfield.ai'
/** Submit endpoint — model-routed. VERIFIED: `POST /v1/text2image/soul` (Soul t2i).
 *  Body is wrapped as `{ params: {...} }`. This is the cheapest live REST t2i path. */
const HF_SUBMIT_PATH = '/v1/text2image/soul' // VERIFIED (live submit → JobSet)
/** Poll endpoint PREFIX. VERIFIED: `GET /v1/job-sets/{id}` returns the JobSet status. */
const HF_STATUS_PATH = '/v1/job-sets' // VERIFIED (live poll route)

/** Request field names sent INSIDE the `params` wrapper. VERIFIED against the live submit.
 *  Soul t2i uses `width_and_height` (e.g. '1536x1536'), not a free-form aspect ratio. */
const HF_REQ_FIELDS = {
  prompt: 'prompt',
  widthAndHeight: 'width_and_height',
  quality: 'quality',
  batchSize: 'batch_size',
} as const

/** Response field names. VERIFIED: JobSet `{ id, jobs:[{status, results:{raw:{url}}}] }`. */
const HF_RES_FIELDS = {
  jobId: 'id',          // VERIFIED: submit returns JobSet `id`
  jobs: 'jobs',         // VERIFIED: jobs[]
  status: 'status',     // VERIFIED: jobs[i].status
  results: 'results',   // VERIFIED: jobs[i].results
  rawKey: 'raw',        // VERIFIED: results.raw
  imageUrl: 'url',      // VERIFIED: results.raw.url
} as const

/** Terminal status string sets. VERIFIED enum: queued|in_progress|completed|nsfw|failed|canceled. */
const HF_STATUS_COMPLETED = ['completed', 'succeeded', 'success'] as const
const HF_STATUS_FAILED = ['failed', 'error', 'cancelled', 'canceled'] as const
const HF_STATUS_NSFW = ['nsfw', 'flagged'] as const

/**
 * Soul t2i request defaults. The REST surface routes by ENDPOINT, not a `model`
 * field, so the "model" here is really the quality/size of the Soul t2i call.
 * Cheapest viable = 720p (SD) at batch_size 1 (~1 credit). Callers may override
 * width_and_height / quality via HiggsfieldImageOpts.
 */
const HF_SOUL_DEFAULTS = {
  qualitySD: '720p',
  qualityHD: '1080p',
  batchSize: 1,
} as const

/** Map a free-form aspect ratio to the nearest supported Soul `width_and_height`. */
const HF_ASPECT_TO_SIZE: Record<string, string> = {
  '1:1': '1536x1536',
  '16:9': '2048x1152',
  '9:16': '1152x2048',
  '4:3': '2048x1536',
  '3:4': '1536x2048',
}
const HF_DEFAULT_SIZE = '1536x1536'

// Async / timeout tuning.
const HF_POLL_INTERVAL_MS = 5_000      // poll cadence
const HF_DEFAULT_MAX_WAIT_MS = 240_000 // budget under Vercel's 300s ceiling

// ============================================================================
// Typed errors (so the router can branch / fall back cleanly)
// ============================================================================

export type HiggsfieldErrorCode =
  | 'HF_NO_KEY'
  | 'HF_SUBMIT_FAILED'
  | 'HF_POLL_FAILED'
  | 'HF_TIMEOUT'
  | 'HF_NSFW'
  | 'HF_FAILED'
  | 'HF_NO_OUTPUT'

export class HiggsfieldError extends Error {
  code: HiggsfieldErrorCode
  status?: number
  constructor(code: HiggsfieldErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'HiggsfieldError'
    this.code = code
    this.status = status
  }
}

// ============================================================================
// Transport seam — injectable so contract tests can mock HTTP (no real network)
// ============================================================================

export type HiggsfieldTransport = typeof fetch

let _transport: HiggsfieldTransport = (...args) => fetch(...args)

/** Override the HTTP transport (used by contract tests). Pass undefined to reset. */
export function __setHiggsfieldTransport(transport?: HiggsfieldTransport): void {
  _transport = transport ?? ((...args) => fetch(...args))
}

// ============================================================================
// Internal helpers
// ============================================================================

interface HiggsfieldResult {
  imageUrl: string
  jobId: string
}

function resolveBaseUrl(): string {
  const config = getConfig()
  return config.higgsfieldBaseUrl || HF_DEFAULT_BASE_URL
}

function authHeaders(apiKey: string, apiSecret: string): Record<string, string> {
  // VERIFIED LIVE (U0 live-verify FINAL): auth is a key:secret PAIR sent as TWO
  // headers — the official higgsfield-js V1 transport. `GET /v1/motions` with these
  // returns 200. (`Authorization: Key id:secret` also works; `Basic b64` → 401.)
  return { 'hf-api-key': apiKey, 'hf-secret': apiSecret }
}

/**
 * Submit a generation job and poll until it completes.
 * The ONLY place that speaks the Higgsfield REST contract.
 *
 * Live contract (VERIFIED U0 FINAL):
 *  - submit: `POST {submitPath}` body `{ params: {...} }` → JobSet `{ id, jobs }`
 *  - poll:   `GET /v1/job-sets/{id}` → `{ jobs:[{ status, results:{raw:{url}} }] }`
 */
async function submitAndPoll(
  submitPath: string,
  params: Record<string, unknown>,
  opts?: { maxWaitMs?: number }
): Promise<HiggsfieldResult> {
  const config = getConfig()
  const apiKey = config.higgsfieldApiKey
  const apiSecret = config.higgsfieldApiSecret
  // VERIFIED (U0 live-verify): the live API needs a key:secret PAIR. A key without
  // its secret 500s on the server. Treat a missing secret like a missing key so the
  // router cleanly falls back instead of burning a request on a guaranteed 500.
  if (!apiKey || !apiSecret) {
    // Typed error → the router falls back to existing providers.
    throw new HiggsfieldError(
      'HF_NO_KEY',
      !apiKey
        ? 'HIGGSFIELD_API_KEY not configured'
        : 'HIGGSFIELD_API_SECRET not configured (live API requires a key:secret pair)'
    )
  }

  const baseUrl = resolveBaseUrl()
  const maxWaitMs = opts?.maxWaitMs ?? config.higgsfieldTimeoutMs ?? HF_DEFAULT_MAX_WAIT_MS
  const headers = {
    ...authHeaders(apiKey, apiSecret),
    'Content-Type': 'application/json',
  }

  // --- 1. Submit (POST). VERIFIED: body is wrapped as `{ params: {...} }`. ---
  let submitRes: Response
  try {
    submitRes = await _transport(`${baseUrl}${submitPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ params }),
    })
  } catch (err) {
    throw new HiggsfieldError('HF_SUBMIT_FAILED', `Higgsfield submit request failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!submitRes.ok) {
    const body = await safeText(submitRes)
    throw new HiggsfieldError('HF_SUBMIT_FAILED', `Higgsfield submit error (${submitRes.status}): ${body}`, submitRes.status)
  }

  const submitJson = (await safeJson(submitRes)) as Record<string, unknown>
  const jobId = submitJson?.[HF_RES_FIELDS.jobId]
  if (typeof jobId !== 'string' || !jobId) {
    throw new HiggsfieldError('HF_SUBMIT_FAILED', 'Higgsfield submit returned no job-set id')
  }

  // --- 2. Poll (GET /v1/job-sets/{id}) until a job reaches a terminal status. ---
  const deadline = Date.now() + maxWaitMs
  // A submit can already include the output (synchronous-completed case).
  let statusJson: Record<string, unknown> = submitJson

  while (true) {
    const status = extractJobStatus(statusJson)

    if (HF_STATUS_NSFW.includes(status as (typeof HF_STATUS_NSFW)[number])) {
      throw new HiggsfieldError('HF_NSFW', `Higgsfield flagged content as NSFW (job ${jobId})`)
    }
    if (HF_STATUS_FAILED.includes(status as (typeof HF_STATUS_FAILED)[number])) {
      throw new HiggsfieldError('HF_FAILED', `Higgsfield job ${jobId} ${status}`)
    }
    if (HF_STATUS_COMPLETED.includes(status as (typeof HF_STATUS_COMPLETED)[number])) {
      const url = extractImageUrl(statusJson)
      if (!url) throw new HiggsfieldError('HF_NO_OUTPUT', `Higgsfield job ${jobId} completed with no image url`)
      return { imageUrl: url, jobId }
    }

    // Not terminal yet — check budget, then poll again.
    if (Date.now() >= deadline) {
      throw new HiggsfieldError('HF_TIMEOUT', `Higgsfield job ${jobId} did not complete within ${maxWaitMs}ms`)
    }
    await sleep(HF_POLL_INTERVAL_MS)

    let pollRes: Response
    try {
      pollRes = await _transport(`${baseUrl}${HF_STATUS_PATH}/${jobId}`, { method: 'GET', headers })
    } catch (err) {
      throw new HiggsfieldError('HF_POLL_FAILED', `Higgsfield poll request failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (!pollRes.ok) {
      const body = await safeText(pollRes)
      throw new HiggsfieldError('HF_POLL_FAILED', `Higgsfield poll error (${pollRes.status}): ${body}`, pollRes.status)
    }
    statusJson = (await safeJson(pollRes)) as Record<string, unknown>
  }
}

/** Pull the first job's status from a JobSet response (VERIFIED shape). */
function extractJobStatus(json: Record<string, unknown>): string {
  const jobs = json?.[HF_RES_FIELDS.jobs]
  if (Array.isArray(jobs) && jobs.length) {
    const first = jobs[0] as Record<string, unknown>
    return String(first?.[HF_RES_FIELDS.status] ?? '').toLowerCase()
  }
  // Fallback: a flat top-level status (defensive).
  return String(json?.[HF_RES_FIELDS.status] ?? '').toLowerCase()
}

function extractImageUrl(json: Record<string, unknown>): string | undefined {
  // VERIFIED shape: { jobs:[{ results:{ raw:{ url } } }] }.
  const jobs = json?.[HF_RES_FIELDS.jobs]
  if (Array.isArray(jobs) && jobs.length) {
    const first = jobs[0] as Record<string, unknown>
    const results = first?.[HF_RES_FIELDS.results] as Record<string, unknown> | undefined
    const raw = results?.[HF_RES_FIELDS.rawKey] as Record<string, unknown> | undefined
    const url = raw?.[HF_RES_FIELDS.imageUrl]
    if (typeof url === 'string' && url) return url
  }
  // Fallback: a flat `url` on the object (defensive).
  const flat = json?.[HF_RES_FIELDS.imageUrl]
  if (typeof flat === 'string' && flat) return flat
  return undefined
}

async function safeText(res: Response): Promise<string> {
  try { return await res.text() } catch { return '<no body>' }
}

async function safeJson(res: Response): Promise<unknown> {
  try { return await res.json() } catch { return {} }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Persist a transient Higgsfield output URL to Supabase storage. If persistence
 * fails (e.g. no storage in a test/CLI context) we degrade to returning the
 * original URL rather than failing the gen.
 */
async function persistToStorage(imageUrl: string): Promise<string> {
  try {
    const res = await _transport(imageUrl, { method: 'GET' })
    if (!res.ok) return imageUrl
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length < 100) return imageUrl

    const supabase = getSupabase()
    const filePath = `higgsfield/${Date.now()}.png`
    const { error } = await supabase.storage.from('media').upload(filePath, buffer, {
      contentType: 'image/png',
      upsert: false,
    })
    if (error) return imageUrl
    const { data } = supabase.storage.from('media').getPublicUrl(filePath)
    return data.publicUrl || imageUrl
  } catch {
    return imageUrl
  }
}

// ============================================================================
// Public API — matches the image-router's generateWithX signature shape
// ============================================================================

export interface HiggsfieldImageOpts {
  /** @deprecated The REST surface routes by ENDPOINT, not a `model` field — this is
   *  accepted for back-compat with capability-engine callers but IGNORED. Use
   *  `submitPath` to pick a different model-routed endpoint. */
  model?: string
  /** Override the Soul t2i submit endpoint (default `/v1/text2image/soul`). */
  submitPath?: string
  /** Override width_and_height (e.g. '2048x1152'); defaults from aspectRatio. */
  widthAndHeight?: string
  /** Quality tier: '720p' (cheapest, default) or '1080p'. */
  quality?: '720p' | '1080p'
  /** Persist the output to Supabase storage (default true). */
  persist?: boolean
  /** Override the wall-clock poll budget. */
  maxWaitMs?: number
  // soulId / brandKitStyleId / referenceImages land in a LATER rung (U2).
}

/**
 * Generate an image via Higgsfield Soul (text-to-image). Returns the same
 * normalized shape the other image-router providers return. Throws
 * HiggsfieldError on missing key / failure so the router can fall back.
 *
 * Cheapest live config: quality '720p', batch_size 1 (~1 credit). The REST
 * surface routes by ENDPOINT, not a `model` field — there is no `z_image` REST id.
 */
export async function higgsfieldGenerateImage(
  prompt: string,
  aspectRatio: string = '1:1',
  opts?: HiggsfieldImageOpts
): Promise<GeneratedImage> {
  const submitPath = opts?.submitPath || HF_SUBMIT_PATH
  const widthAndHeight = opts?.widthAndHeight || HF_ASPECT_TO_SIZE[aspectRatio] || HF_DEFAULT_SIZE
  const quality = opts?.quality || HF_SOUL_DEFAULTS.qualitySD

  const result = await submitAndPoll(
    submitPath,
    {
      [HF_REQ_FIELDS.prompt]: prompt,
      [HF_REQ_FIELDS.widthAndHeight]: widthAndHeight,
      [HF_REQ_FIELDS.quality]: quality,
      [HF_REQ_FIELDS.batchSize]: HF_SOUL_DEFAULTS.batchSize,
    },
    { maxWaitMs: opts?.maxWaitMs }
  )

  // GENERATION succeeded. Persistence is a POST-success, best-effort step — it must
  // NEVER surface as a generation failure (that would make the cascade re-generate on
  // a fallback engine and waste credits when the image already exists). So even though
  // persistToStorage already degrades internally, we belt-and-suspenders it here: any
  // throw degrades to the RAW Higgsfield URL with a warning. Mirrors how the image
  // router degrades persistence. `persist` defaults true for production; CLI proofs
  // pass persist:false to avoid any storage dependency entirely.
  const persist = opts?.persist ?? true
  let finalUrl = result.imageUrl
  if (persist) {
    try {
      finalUrl = await persistToStorage(result.imageUrl)
    } catch (err) {
      console.warn(
        `[higgsfield] persist failed after a SUCCESSFUL generation (job ${result.jobId}); ` +
        `returning raw Higgsfield URL (generation is NOT failed): ` +
        `${err instanceof Error ? err.message : String(err)}`
      )
      finalUrl = result.imageUrl
    }
  }

  return {
    url: finalUrl,
    prompt,
    enhancedPrompt: prompt,
  }
}
