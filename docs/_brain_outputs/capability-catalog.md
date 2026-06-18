# CAPABILITY CATALOG — SocialFly's Higgsfield-Primary Engine

**Brain:** AI / Capability · **Date:** 2026-06-16 · **For:** the capability-aware router (architecture brain, parallel)
**Method:** Higgsfield MCP exercised READ-ONLY this session (no `generate_*` / `virality_predictor` / `video_analysis` CREATE — those spend credits). Tool/param schemas + live catalog listings captured directly.

> **Status legend:** **[V]** = VERIFIED live from the MCP this session (model `get`, catalog `list`, or the tool's own JSON schema) · **[A]** = ASSUMED / inferred from prior R&D, schema descriptions, or pricing math — needs confirmation.
> **Goal of this doc:** make the router select from the FULL Higgsfield surface, not just `generate_image` / `generate_video`. Every capability below maps to: tool/model id → inputs/params → output → ~credit cost → quality tier → social use-case.
> **Workspace state [V]:** Ultra plan, ~2,824 cr. Soul-character library **EMPTY**, Reference-Element library **EMPTY**, brand_kit library **EMPTY** — clean slate. Nothing trained yet; intake builds all three.

---

## 0. HOW HIGGSFIELD IS SHAPED (the mental model the router needs)

Higgsfield is **not** "image API + video API." It is four layers:

1. **Generation models** — invoked via `generate_image` / `generate_video` / `generate_audio` / `generate_3d`, each call carries a `model` id + that model's params + optional `medias[]`. ~18 image, ~14 video, 3 audio, several 3D. [V via models_explore]
2. **Brand/identity primitives** (the moat) — `soul_id` (trained face), `<<<element_id>>>` (reference elements), `brand_kit_id`, `product_ids[]`, `avatars[]`, `ad_reference_id`. These are **injected INTO** generation calls; they are what make output on-brand *by construction*. [V]
3. **Marketing Studio** — a curated ad system on top of generation: video modes (UGC/Tutorial/…), `hook_id`, `setting_id`, `ad_reference_id` (video), and `style_id` ad-formats + `brand_kit_id` (static). [V]
4. **Finishing / intelligence tools** (their own MCP tools, NOT `model` ids) — `reframe`, `upscale_image`, `upscale_video`, `outpaint_image`, `remove_background`, `virality_predictor`, `video_analysis_*`. The router must call these as **distinct tools**, not as a `model` param. [V — confirmed `reframe` never appears in `models_explore` output; it is a standalone tool]

**Router implication:** the route key is not just `(type=image|video)`. It is `(capability, brand-primitives-to-inject, model, tier, finishing-steps)`. A single "make a post" intent fans out into: pick model → inject soul/element/brand_kit → generate → (gate) → reframe → upscale.

---

## 1. THE FULL HIGGSFIELD TOOL / FEATURE SURFACE

### 1A. BRAND / IDENTITY PRIMITIVES (the capabilities the current engine does NOT use — highest leverage)

| Capability | Tool / id | Inputs / params [V] | Output | ~Credit cost | Tier | Social use-case |
|---|---|---|---|---|---|---|
| **Soul training** (digital twin) | `show_characters` action=`train` | `name` + 5–20 ref images (media_id / image_job / https), `type` in {`soul`,`soul_2`,`soul_cinematic`} | a trained `soul_id`, ~10 min, non-blocking | ~30 cr / train [A] | one-time onboarding | Influencer / personal brand: the SAME face on every post forever |
| **Soul-ID reuse** | `generate_image` `model=soul_2` (also `soul_cinematic`) | `soul_id`, `quality` (1.5k\|2k), AR {1:1,16:9,9:16,4:3,3:4,3:2,2:3}, `medias[]` max 1 | on-identity image | ~1–2 cr [A] | standard/hero | Creator selfie/editorial, consistent face |
| **Soul constraint** | — | **ONE `soul_id` per generation**; usable ONLY with `soul_2` + `soul_cinematic`. No two-person shots. [V schema] | — | — | — | Multi-person → must use Elements instead |
| **Reference Elements** (char/env/prop) | `show_reference_elements` action=`create` / inject `<<<element_id>>>` in prompt | create from `medias[]` (Higgsfield-origin URL only), `category` auto\|character\|environment\|prop; **multiple** placeholders per prompt | reusable element; backend auto-injects image + rewrites to `@name` | instant, ~0 marginal [A] | all | Hero product / mascot / signature location reused across posts; multi-subject scenes |
| **Element supported models** [V schema] | — | Image: `nano_banana_2`, `nano_banana_flash`, `gpt_image_2`, `seedream_v4_5`, `seedream_v5_lite`, `cinematic_studio_2_5`. Video: Cinema Studio Video 2/3.0, **`seedance_2_0`**, **`kling3_0`**. **NOT** Soul V2/Cinema. | — | — | — | This is the multi-model brand-injection path (vs Soul's 2-model path) |
| **Brand Kit** | `show_marketing_studio` type=`brand_kit` (action `create`/`fetch`/`get`/`update`) | `scrap_url` (auto-scrape site) OR full payload: brand_name, business_overview, logo (CDN), images[], **colors[] (hex+usage)**, **fonts[] (name+usage)**, **tone_of_voice[]**, brand_values, keywords, products_or_services, social_links, tagline | a `brand_kit_id` (must reach `status:completed`) | ~0 (metadata) [A] | — | Logo/colors/fonts/tone folded into every DTC prompt automatically |
| **ad_reference** ("recreate this viral ad") | `show_marketing_studio` type=`ad_reference` create → `ad_reference_id` | created from `video_input_id` (a chat-uploaded video; **URL ingestion NOT supported** — must download+upload). Editable `edited_concept_text/json` after analysis | reusable scenario (scene comp, pacing, hook, narration) | analysis cost [A] | — | Clone a proven viral ad's STRUCTURE onto your product |
| **Avatars** (UGC presenter) | `show_marketing_studio` type=`avatar` | preset or custom (`name`+media, max 4); passed as `avatars:[{id,type:custom\|preset}]` | on-screen presenter | — | — | Face for UGC ad when no Soul (fast activation) |

### 1B. IMAGE GENERATION MODELS (`generate_image`, `model=…`)

| Model id [V] | Provider | Key params [V] | AR | ~Cost | Tier | Social use-case |
|---|---|---|---|---|---|---|
| `ms_image` ("DTC Ads") | Higgsfield | **`style_id` REQUIRED**, `brand_kit_id`, `product_ids[]` (≤4), `resolution` 1k/2k/4k, `quality` low/med/high, `batch_size` 1–20, `medias[]` ≤14 | 15 ARs incl 1:1,4:5≈(9:8/8:9),9:16,16:9 | ~1–2 cr/img [A] | standard | **Static conversion ads** (Special Offer, Star Review, Comparison…) — brand-kit-aware |
| `marketing_studio_image` | Higgsfield | one-click product image ad (no style picker) | — | ~1–2 cr [A] | standard | Quick product static, no ad-format choice |
| `recraft-v4-1` | Recraft | `model_type` standard/vector/utility/utility_vector, **`colors[]` ≤10 hex**, **`background_color`**, `resolution` 1k/2k, `batch_size` 1–4 | incl 4:5,1:1,9:16 | ~1–2 cr [A] | standard | **LinkedIn carousels, logos, icons, comparison/vector graphics, brand swatches** — native palette lock |
| `gpt_image_2` | OpenAI | best raw text rendering [A]; Element-compatible | — | ~2 cr [A] | standard | Text-heavy carousels / quote cards where copy MUST render perfectly |
| `nano_banana_2` | Google | `resolution` 1k/2k/4k; text-to-image + image-to-image; Element-compatible | 10 ARs incl 4:5,9:16,16:9,21:9 | ~0.25–2 cr [A] | draft→std | High-volume cheap realistic drafts, thumbnails, A/B variants |
| `nano_banana_flash` (="Nano Banana 2") | Google | budget tier; Element-compatible | — | ~0.25 cr [A] | draft | Cheapest volume drafts |
| `nano_banana_pro` | Google | 4K premium realistic | — | ~2 cr [A] | hero (static) | Premium 4K hero still |
| `seedream_v4_5` / `seedream_v5_lite` | Bytedance | 4K; Element-compatible | — | lite ~0.25 / 4.5 ~1–2 [A] | draft→std | 4K fashion/lifestyle hero stills (4.5); cheap drafts (lite) |
| `soul_2` | Higgsfield | `soul_id`, `quality` 1.5k/2k | 7 ARs | ~1–2 cr [A] | standard | UGC/fashion/editorial with consistent face |
| `cinematic_studio_2_5` | Higgsfield | Element-compatible | — | [A] | std/hero | Cinematic editorial stills |
| `flux_2` | BFL | `model` pro/flex/max, `resolution` 1k/2k | 5 ARs | [A] | std | Precise prompt adherence; flux_kontext for editing/style-transfer [A] |
| `recraft` vector/`autosprite` | Recraft/HF | (autosprite = game sprite sheets) | — | [A] | niche | Vector brand assets; sprites for gaming ICP |

### 1C. VIDEO GENERATION MODELS (`generate_video`, `model=…`)

| Model id [V] | Provider | Key params [V] | AR | Dur | ~Cost | Tier | Social use-case |
|---|---|---|---|---|---|---|---|
| `marketing_studio_video` | Higgsfield | `product_ids[]`, `avatars[]`, **`hook_id`**, **`setting_id`**, **`ad_reference_id`** (hook/setting ⟂ ad_reference, mutually exclusive), `generate_audio` bool, `resolution` 480/720/1080p | 7 ARs incl 9:16 | 4–15s | ~6 cr [A] | standard | **The one-click UGC/DTC product ad engine** (TikTok/Reels) |
| `seedance_2_0` | Bytedance | `resolution` 480/720/1080p, `mode` std/**fast**, `bitrate_mode`, `genre` hint; medias roles image/start/end/**video**/**audio**; Element-compatible | 7 ARs incl 9:16 | 4–15s | std ~6 / fast ~3 [A] | draft(fast)→std | **Identity-consistent talking-head creator reel; multi-SKU product video** |
| `kling3_0` | Kling | `mode` std/pro/**4k**, `sound` on/off (off = cheaper); start/end image; Element-compatible | 16:9,9:16,1:1 | 3–15s | ~6 cr (4k more) [A] | standard→hero | Multi-shot, synced audio, motion-transfer hero reels |
| `veo3_1` | Google | `quality` basic/high/ultra, `model` preview(best)/fast; start_image max 1 | 16:9,9:16 | 4/6/8s | ~12–20+ cr [A] | **HERO** | Top-tier cinematic launch films, flagship reels (native audio) |
| `minimax_hailuo` | Minimax | physics/emotion realism [A] | — | — | ~6 cr [A] | standard | Mid-tier reel needing physical/emotional realism |
| `wan2_7` / `wan2_6` | — | synced audio + character-consistent [A] | — | — | ~6 cr [A] | standard | Character-consistent reel with synced audio |
| `cinematic_studio_video_*` (2/v2/3.0) | Higgsfield | Element-compatible (v2/3.0) | — | — | [A] | std/hero | Higgsfield-native cinema look |
| `higgsfield_preset` | Higgsfield | **`preset_id` REQUIRED** (from `presets_show`), `medias[]` 1 image REQUIRED | 16:9,9:16,1:1 | — | ~6 cr [A] | standard | **Viral i2v templates** (Paparazzi/Red Carpet/Summer Haze) — 1 image → scroll-stopper |
| `grok_video`/`_v15`, `seedance_1_5`, `kling2_6` | xAI/BD/Kling | — | — | — | [A] | std | Alternates / fallback within Higgsfield |

### 1D. AUDIO MODELS (`generate_audio`, `model=…`)

| Model id [V] | Provider | Inputs [V] | Output | ~Cost | Use-case |
|---|---|---|---|---|---|
| `inworld_text_to_speech` | FAL/Inworld | **`voice` REQUIRED** — ~120 voices VERIFIED: EN (~73) + zh, nl, fr, de, it, ja, ko, pl, pt, es, ru, hi, he, ar | speech audio | [A] | Brand/creator voiceover, multilingual |
| `sonilo_music` | Higgsfield | text→music prompt | music bed | [A] | License-clean background music |
| `mirelo_text_to_audio` | Mirelo | text→SFX | SFX | [A] | Sound effects |

> **TTS voices [V — full list captured]:** EN includes Loretta, Hank, Liam, Callum, Hamish, James, Serena, Brian, Olivia, Sarah, Theodore, Luna … (73). Non-EN: Yichen/Xiaoyin/Xinyi/Jing (zh), Erik/Katrien/Lennart/Lore (nl), Alain/Hélène/Mathieu/Étienne (fr), Johanna/Josef (de), Gianni/Orietta (it), Asuka/Satoshi (ja), Hyunwoo/Minji/Seojun/Yoona (ko), Szymon/Wojciech (pl), Heitor/Maitê (pt), Diego/Lupita/Miguel/Rafael (es), Svetlana/Elena/Dmitry/Nikolai (ru), Riya/Manoj (hi), Yael/Oren (he), Nour/Omar (ar). **Router should map brand `voice_id` → one of these exact strings.**

### 1E. 3D MODELS (`generate_3d`, `model=…`) [A — not get-verified this session]

| Model id | Use-case |
|---|---|
| `image_to_3d` / `multi_image_to_3d` (Meshy) | Product spins, 3D brand objects (texturing, PBR, rigging, animation) |
| `sam_3_3d`, `3d_rigging` | Niche product showcase / game assets |
| `autosprite` (image model) | Game sprite sheets (gaming/creator ICP) |

### 1F. FINISHING & INTELLIGENCE TOOLS (standalone tools — NOT `model` ids) [V — distinct tools present]

| Tool | Inputs | Output | ~Cost | Social use-case |
|---|---|---|---|---|
| **`reframe`** | 1 asset + target AR | same asset re-composed to a new AR | cheap, << regenerate [A] | **1 hero → 9:16 + 1:1 + 4:5 + 16:9** for cross-posting (the credit-saver) |
| `upscale_image` / `upscale_video` | asset | higher-res asset | [A] | Promote a borderline draft to hero quality |
| `outpaint_image` | image + extend region | extended canvas | [A] | Extend a still to a new AR / add headroom for text |
| `remove_background` | image | cut-out (transparent) | [A] | Product cut-outs for static ads / compositing |
| **`virality_predictor`** | a confirmed/generated **video** (`create`); `preview` reopens | dashboard: virality, engagement, attention, audience response, **retention risk**, **hook strength**, creative performance | spends credits [V — CREATE not called] | **Pre-publish GATE** + "AI creative strategist" score |
| **`video_analysis_*`** | a video (`create`/`status`/`jobs`); accepts external/YouTube URLs [A] | scene-by-scene creative deconstruction | spends credits | Deconstruct a top performer → feed the learning loop |
| `personal_clipper_*` | long video | auto-clipped shorts [A] | [A] | Long-form → multiple shorts |
| `motion_control` / `animation_actions` | image/video | directed motion [A] | [A] | Precise motion direction on a clip |

### 1G. MEDIA PLUMBING (the router MUST use these, never raw URLs) [V from MCP instructions]
- `media_import_url` (web URL → `media_id`; **never** pass raw URLs into `medias[].value`), `media_upload` → PUT bytes → `media_confirm`, `media_upload_widget` (Apps-UI only).
- Job lifecycle: `job_status`, `job_display`, `reveal_generation`, `show_generations`, `show_medias`. Account: `balance`, `show_plans_and_credits`, `transactions`.

---

## 2. CAPABILITY → SOCIAL USE-CASE → PLATFORM/FORMAT → RECOMMENDED MODEL

| Social use-case | Platform / format | Brand primitives to inject | Recommended model / tool | Notes |
|---|---|---|---|---|
| Consistent-face creator reel (talking head) | TikTok/IG/Shorts 9:16 | `<<<soul-as-element>>>` OR start frame from `soul_2` | **`seedance_2_0`** (std) | seedance is the identity workhorse [V rec score 240 prior; 140 generic]. Soul itself can't drive video → render Soul still, save as Element, drive seedance/kling. |
| "Main character" viral flex reel | IG/TikTok 9:16 | a Soul/Element still as the input image | **`higgsfield_preset`** + preset_id (Paparazzi `d4b067de…`, Red Carpet `66eb1fd6…`, Summer Haze `94d1e8c6…`) | 1 image → template clip |
| DTC product ad (UGC) | TikTok/Reels 9:16 | `product_ids[]` + `avatars[]` + `brand_kit`(tone) + `hook_id` + `setting_id` | **`marketing_studio_video`** | hook/setting only for UGC/Tutorial/Unboxing/Product Review/UGC-VTO |
| "Recreate this viral ad" | 9:16 ad | `ad_reference_id` + explicit `product_ids[]`/`avatars[]` (NOT auto-pulled) | **`marketing_studio_video`** + `ad_reference_id` | ⟂ hook/setting |
| Static conversion ad | IG/FB 1:1 & 4:5, LinkedIn | `brand_kit_id` + `product_ids[]` + `style_id` | **`ms_image`** (style_id REQUIRED: Special Offer `c4c9ee3e…`, Star Review `c3884bf7…`, Comparison Table `4ac40ba6…`, Social Proof `30ab1615…`, Then vs Now `ad65db31…`) | brand-kit-aware by construction |
| LinkedIn thought-leadership carousel | LinkedIn 1:1 / 4:5 | `colors[]` = brand palette, `background_color` | **`recraft-v4-1`** (model_type vector/utility) | native palette lock; for heavy body copy use `gpt_image_2` |
| Hero / launch film | flagship 9:16 or 16:9 | start_image from on-brand still | **`veo3_1`** (ultra) or **`kling3_0`** (4k) | premium tier only (see §3) |
| Multi-SKU product video | 9:16 | `<<<element>>>` per SKU | **`seedance_2_0`** (multi-sku tag) | reference-driven |
| High-volume daily drafts / A/B | all feeds | brand palette in prompt / Element | **`nano_banana_flash`/`_2`**, `seedream_v5_lite`, `seedance_2_0 fast` | cheap tier |
| 4K hero still | hero post / paid static | Element | **`nano_banana_pro`** or `seedream_v4_5` | |
| Repurpose 1 hero → many ARs | cross-post all platforms | — | **`reframe`** (tool) | NOT a model; ~4–8× cheaper than regen |
| Voiceover (brand voice, multilingual) | reel/short VO | `voice_id` → exact Inworld voice string | **`generate_audio` `inworld_text_to_speech`** | |
| Music bed + SFX | all video | `music_vibe` seed | `sonilo_music`, `mirelo_text_to_audio` | |
| Pre-publish quality/virality gate | all video | finished draft | **`virality_predictor`** (tool) | gate threshold per Brand DNA |
| Deconstruct a top performer | analytics/learning | a legally-accessed top video | **`video_analysis_create`** (tool) | feeds endogenous + exogenous flywheels |
| Product cut-out / 3D spin | product showcase | product image | `remove_background`; `image_to_3d` | niche |

---

## 3. MODEL-SELECTION HEURISTICS (the router's decision logic)

### 3.1 Tiers + DEFAULT model id per capability
| Capability | DRAFT default | STANDARD default | HERO default |
|---|---|---|---|
| Image (general) | `nano_banana_flash` | `nano_banana_2` (2k) | `nano_banana_pro` (4k) / `seedream_v4_5` |
| Image (brand carousel/vector) | `recraft-v4-1` 1k | `recraft-v4-1` 2k | `gpt_image_2` (copy-heavy) |
| Image (DTC static ad) | `marketing_studio_image` | **`ms_image`** (+style+brand_kit) | `ms_image` quality=high 4k |
| Image (consistent face) | — | **`soul_2`** | `soul_cinematic` |
| Video (creator reel) | `seedance_2_0` **fast** 480/720 | **`seedance_2_0`** std 720 | `kling3_0` pro/4k |
| Video (DTC ad) | `marketing_studio_video` 480 | **`marketing_studio_video`** 720 | `marketing_studio_video` 1080 / `veo3_1` |
| Video (viral template) | — | **`higgsfield_preset`** | — |
| Video (hero film) | — | `kling3_0` std | **`veo3_1`** ultra |
| Audio VO | `inworld_text_to_speech` | `inworld_text_to_speech` | (same) |

### 3.2 "Predict cheap, generate premium" — the credit governor (ties to virality gate)
1. **Draft cheap first:** 3–5 variants in DRAFT tier (`nano_banana_flash` / `seedance_2_0 fast`).
2. **Score all** with `virality_predictor` (cheaper than re-shooting premium). Inspect **hook strength** + **retention risk**.
3. **Spend premium only on the proven winner:** regenerate the top-scoring variant in HERO tier (`kling3_0`/`veo3_1`/`soul_cinematic`) ONLY if `predicted_score ≥ premium_threshold` (≈0.75) AND the slot is flagged hero/launch/paid.
4. **Budget cap:** Brand DNA `premium_share` (~20%) hard-limits premium share; auto-refill (threshold 300 cr) keeps autopilot alive. [A]
5. **Reframe, don't regenerate:** approved hero → `reframe` into every platform AR. Default this path; it is the single biggest credit saver.

### 3.3 Per-capability default + override rule
- **Default** = the STANDARD column above, chosen by `(capability, platform-AR)`.
- **Override up to HERO** when: slot.flag ∈ {launch, paid, pinned} OR predicted_score ≥ premium_threshold.
- **Override down to DRAFT** when: generating variants for the gate, daily filler, or `monthly_credit_budget` is >80% spent.
- **Honest caveat [A]:** cheap statics are near-premium now (Nano Banana Pro ≈ 2cr). The gap that still justifies premium is **video motion coherence + audio sync** (Kling/Veo). Rarely pay premium for statics.

---

## 4. WHAT FAL (and the existing routers) SHOULD STILL DO — fallback / commodity lane

The existing `image-router` / `video-router` / `audio-router` (fal, replicate, elevenlabs, google genai, openai) stay as the **failover + supplier kill-switch** (Higgsfield reputation/single-supplier risk). Mapping:

| Capability | FAL/commodity fallback exists? | Notes |
|---|---|---|
| Generic text-to-image | **YES** (fal flux/SDXL, replicate, gpt-image) | Commodity; route here if Higgsfield down or for cheapest bulk |
| Generic text-to-video | **YES** (fal kling/veo/luma if available, replicate) | Commodity i2v/t2v |
| TTS | **YES** (elevenlabs) | elevenlabs is a clean swap for `inworld_text_to_speech` |
| Music / SFX | **PARTIAL** (fal music models) | swap for sonilo/mirelo if needed |
| Upscale / remove-bg / outpaint | **YES** (fal/replicate have these) | commodity finishing |
| **Soul training + Soul-ID reuse** | **NO — HIGGSFIELD-ONLY** ⚠️ | persistent trained identity is the moat; no drop-in fal equivalent |
| **Reference Elements** (`<<<id>>>`) | **NO — HIGGSFIELD-ONLY** ⚠️ | multi-reference brand injection is HF-specific |
| **Brand-kit-aware DTC** (`ms_image`+`brand_kit_id`) | **NO — HIGGSFIELD-ONLY** ⚠️ | brand kit auto-injection is HF-specific |
| **Marketing Studio video** (hooks/settings/ad_reference) | **NO — HIGGSFIELD-ONLY** ⚠️ | the curated UGC ad engine has no fal equivalent |
| **Viral i2v presets** (`higgsfield_preset`) | **NO — HIGGSFIELD-ONLY** ⚠️ | preset library is HF-specific |
| **virality_predictor** | **NO — HIGGSFIELD-ONLY** ⚠️ | pre-publish virality scoring is HF-specific (could be approximated by a custom model later) |
| **video_analysis** | **PARTIAL** | could rebuild on a VLM, but HF's is turnkey |

⚠️ = **flag for the router:** these capabilities have NO fallback. If Higgsfield is unavailable, the engine must **degrade gracefully** (e.g. drop to a generic reel via fal + skip the virality gate) rather than fail the post — but the *differentiated* product surface goes dark. This is the single-supplier risk made concrete.

---

## 5. BRAND DNA INJECTION POINTS (on-brand by construction)

For each generative capability, WHERE the brand identity enters:

| Brand attribute | Injected as | Into which call | Capabilities it covers |
|---|---|---|---|
| **Face / identity** (single person) | `soul_id` | `generate_image` `model=soul_2`/`soul_cinematic` | Consistent-face stills. For VIDEO: render Soul still → save as Element → `<<<element>>>` into seedance/kling (Soul can't drive video directly) |
| **Face / subject(s)** (any model, multi) | `<<<element_id>>>` in `params.prompt` | any Element-supported model (nano_banana_2, gpt_image_2, seedream 4.5/5lite, cinema 2.5, **seedance_2_0**, **kling3_0**, cinema video 2/3.0) | Multi-subject scenes, mascots, hero product, environments |
| **Logo / colors / fonts / tone** | `brand_kit_id` | `generate_image` `model=ms_image` | DTC statics (auto-folded into prompt) |
| **Palette (non-MS models)** | `colors[]` (≤10 hex) + `background_color` | `generate_image` `model=recraft-v4-1` | Carousels, vector/brand graphics |
| **Hero product / SKU** | `product_ids[]` | `ms_image` (≤4), `marketing_studio_video` | DTC static + video ads |
| **Presenter** | `avatars[{id,type}]` | `marketing_studio_video` | UGC ad on-screen face |
| **Proven ad structure** | `ad_reference_id` | `marketing_studio_video` | Clone viral scenario |
| **Attention mechanic + scene** | `hook_id` + `setting_id` | `marketing_studio_video` | UGC composition |
| **Ad-format / headline layout** | `style_id` | `ms_image` | Static ad template |
| **Voice (audio)** | `voice` = exact Inworld voice string | `generate_audio inworld_text_to_speech` | VO |
| **Music vibe** | text prompt seed | `generate_audio sonilo_music` | Music bed |
| **Caption voice / banned terms** | `tone_of_voice[]` + `do_not[]` | LLM caption stage (not Higgsfield) | Captions/hashtags |
| **Virality floor** | `virality_min_score` | `virality_predictor` gate | Publish decision |

**Intake builds all primitives once, then freezes them:** scrape site → `brand_kit` (`action=fetch scrap_url=…`); upload 5–20 photos → `Soul train`; upload product/logo/mascot → `Reference Elements`. Every downstream stage READS these; nothing invents brand attributes.

---

## VERIFIED-THIS-SESSION vs ASSUMED (audit trail)

**VERIFIED live this session (read-only):**
- Model param schemas via `models_explore action=get`: `seedance_2_0`, `marketing_studio_video`, `ms_image`, `soul_2`, `recraft-v4-1`, `kling3_0`, `higgsfield_preset`, `inworld_text_to_speech` (full 120-voice list), `veo3_1`, `nano_banana_2`.
- `models_explore action=recommend` (reframe-repurpose query) → confirms `reframe` is NOT a model id (it's a standalone tool); top video models seedance_2_0 / kling3_0 / marketing_studio_video.
- Catalog `list`: **9 hooks** (full IDs+prompts), **14 settings** (full IDs+prompts), **42 ad-formats** (40 usable + 2 internal `librarian`/`picker`), **9 video preset modes** (ugc/tutorial/ugc_unboxing/hyper_motion/product_review/tv_spot/wild_card/ugc_virtual_try_on/virtual_try_on).
- Library state: `brand_kit` EMPTY, `show_characters` EMPTY, `show_reference_elements` EMPTY.
- Tool schemas (their own JSON): Soul constraints (1 soul/gen, soul_2+cinema only), Element supported-model list, brand_kit full field set, ad_reference (video_input_id only, no URL ingest), marketing_studio mutual-exclusivity rules.

**ASSUMED (needs confirmation):** all per-unit CREDIT COSTS (derived from prior pricing math, not a live price call this session); ~30cr Soul train; 3D model params (not get-verified); flux_kontext editing; that `higgsfield_preset` invocation matches the schema (not test-generated); virality_predictor real-world accuracy; reframe exact cost.

---

## TOP 3 RECOMMENDATIONS
1. **Route on capability, not on `type`.** Build the router key as `(capability, brand-primitives, model, tier, finishing[])` and make Soul/Element/Brand-Kit/Marketing-Studio first-class branches — not afterthoughts on top of `generate_image`/`generate_video`. The 5 ⚠️ Higgsfield-ONLY capabilities (Soul, Elements, brand-kit DTC, Marketing-Studio video, virality_predictor) ARE the product; the router must reach them by default.
2. **Wire the "Soul-still → Element → video" bridge explicitly.** Soul cannot drive video and allows only one face per gen. The consistent-face REEL path (the headline "your face on every post" promise) requires: generate Soul still → auto-save as Reference Element → inject `<<<element>>>` into `seedance_2_0`/`kling3_0`. Bake this as a standard pipeline, or the persona-consistency promise breaks on video.
3. **Make `reframe` + the virality gate the two non-negotiable router stages.** Default every multi-platform post to generate-once → gate (`virality_predictor`) → `reframe` to all ARs. This is both the credit governor (4–8× cheaper) and the anti-slop quality wall — the two things that keep unit economics solvent and the brand reputation safe.

## OPEN QUESTIONS FOR RIO
1. **Live credit prices** — approve ONE `show_plans_and_credits`/`balance` + a tiny proof-gen so we can replace all [A] cost estimates with real per-model numbers? (All §3 budgeting is currently assumed.)
2. **Soul vs Element default for "personal brand" ICP** — require 5–20 photos + ~10-min Soul training at onboarding (best fidelity), or default to instant single-image Element and offer Soul as an upgrade? (Affects activation friction.)
3. **REST surface** — are `soul_id` / marketing-studio / `virality_predictor` on Higgsfield's public REST API or MCP-only? Decides whether the router calls a server SDK or an agent-worker. (Still blocking per CEO synthesis.)
4. **Fallback posture** — when a Higgsfield-ONLY capability is unavailable, degrade to a generic fal post (skip the differentiated surface) or hold the slot? (Governs the router's failure mode.)
5. **virality_predictor as hard gate vs advisory** — block publish below threshold, or advisory-only until we A/B its scores vs real engagement?
