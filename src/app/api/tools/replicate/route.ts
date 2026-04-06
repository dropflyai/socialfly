import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { deductCredits } from '@/lib/credits'
import {
  removeBackground,
  upscaleImage,
  styleTransfer,
  faceSwap,
  generateWithCustomModel,
} from '@/lib/engine/replicate-tools'

type ReplicateTool = 'remove_background' | 'upscale' | 'style_transfer' | 'face_swap' | 'custom'

interface ReplicateRequest {
  tool: ReplicateTool
  imageUrl: string
  options?: {
    scale?: 2 | 4
    stylePrompt?: string
    targetUrl?: string
    modelId?: string
    inputs?: Record<string, unknown>
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateCheck = checkRateLimit(`${user.id}:replicate-tool`, RATE_LIMITS.imageGenerate)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before running more tools.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    )
  }

  // Replicate tools cost the same as image editing
  const creditResult = await deductCredits(user.id, 'image_edit')
  if (!creditResult.success) {
    return NextResponse.json(
      { error: 'Insufficient credits. Please upgrade your plan.', creditsRemaining: creditResult.creditsRemaining },
      { status: 402 }
    )
  }

  const body: ReplicateRequest = await request.json()
  const { tool, imageUrl, options } = body

  if (!tool) {
    return NextResponse.json({ error: 'Missing tool parameter' }, { status: 400 })
  }

  if (!imageUrl && tool !== 'custom') {
    return NextResponse.json({ error: 'Missing imageUrl parameter' }, { status: 400 })
  }

  const validTools: ReplicateTool[] = ['remove_background', 'upscale', 'style_transfer', 'face_swap', 'custom']
  if (!validTools.includes(tool)) {
    return NextResponse.json(
      { error: `Invalid tool. Must be one of: ${validTools.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    let result

    switch (tool) {
      case 'remove_background':
        result = await removeBackground(imageUrl)
        break

      case 'upscale':
        result = await upscaleImage(imageUrl, options?.scale || 2)
        break

      case 'style_transfer':
        if (!options?.stylePrompt) {
          return NextResponse.json({ error: 'Missing options.stylePrompt for style_transfer' }, { status: 400 })
        }
        result = await styleTransfer(imageUrl, options.stylePrompt)
        break

      case 'face_swap':
        if (!options?.targetUrl) {
          return NextResponse.json({ error: 'Missing options.targetUrl for face_swap' }, { status: 400 })
        }
        result = await faceSwap(imageUrl, options.targetUrl)
        break

      case 'custom':
        if (!options?.modelId) {
          return NextResponse.json({ error: 'Missing options.modelId for custom model' }, { status: 400 })
        }
        result = await generateWithCustomModel(options.modelId, {
          ...(options.inputs || {}),
          ...(imageUrl ? { image: imageUrl } : {}),
        })
        break

      default:
        return NextResponse.json({ error: 'Unknown tool' }, { status: 400 })
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Tool execution failed', tool: result.tool, model: result.model },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      tool: result.tool,
      model: result.model,
    })
  } catch (error) {
    console.error(`[Replicate API] ${tool} error:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Replicate tool failed' },
      { status: 500 }
    )
  }
}
