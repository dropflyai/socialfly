# AI R&D — Higgsfield Capability Map + AI Creative Pipeline Design

**Brain:** AI / R&D · **Date:** 2026-06-16 · **Scope:** Parts A–D of the SocialFly × Higgsfield rework
**Method:** Higgsfield MCP exercised READ-ONLY (no `generate_*` calls — those spend credits; proof gen deferred to Rio approval).

> Status legend: **[VERIFIED]** = observed live from the MCP this session · **[ASSUMED]** = inferred / needs confirmation.
> Workspace: **Ultra plan**, individual workspace, ~2,824 credits (per brief; pricing widget confirms Ultra = 3,000 credits/mo). Soul-character library and Reference-Element library are both **EMPTY** [VERIFIED] — clean slate, no personas trained yet.

---

## PART A — HIGGSFIELD CAPABILITY SURFACE (read-only discovery)

### A.1 Credits & economics [VERIFIED via show_plans_and_credits]
- Ultra plan = **3,000 credits/mo**. Tooltip math: **~12,000 images OR ~500 videos OR ~100 character (Soul) trainings** per 3,000 credits.
- Implied unit costs (derived): **image ≈ 0.25 cr**, **video ≈ 6 cr**, **Soul train ≈ 30 cr**. Promo cards: "3,000 cr = 1,500 Nano Banana Pro gens ≈ 2 cr each" and "~500 Kling 3.0 videos ≈ 6 cr each". So premium image (NB Pro 2K) ≈ 2 cr, budget image (NB / Seedream lite) ≈ 0.25 cr, premium video (Kling/Veo) ≈ 6 cr.
- Top-up packs: 500 cr=$26, 1,000=$49, 2,000=$95, 4,000=$190 (≈ **$0.045–0.052 per credit**). So a premium video ≈ **$0.30**, a budget image ≈ **$0.012**. **This is the cost backbone for Part D.**
- Auto-refill exists (threshold 300 cr) — relevant for server-side autopilot so generation never stalls mid-run.

### A.2 Viral image-to-video presets [VERIFIED via presets_show — 47 presets returned]
These are **one-shot viral templates** (image → video). The big social-relevant ones with real IDs:

| Preset | ID | Social use |
|---|---|---|
| 2000'S PAPARAZZI | `d4b067de-0200-490b-a44c-e9c8edac35a0` | Personal-brand "main character" flex reel |
| CANDID PAPARAZZI | `d8b437dd-7b5c-4b42-9669-8ec6b24f48d8` | Creator/influencer airport-style clip |
| RED CARPET | `66eb1fd6-d795-45c2-babd-a4731180896a` | Launch / event hype |
| SUMMER HAZE | `94d1e8c6-6efd-4a8b-9dd6-014286918e26` | Lifestyle / aesthetic brand mood reel |
| DROWN IN MUSIC | `f1821f84-945b-4cd1-9085-1f479db0028e` | Music/artist promo, zine-rhythm |
| ENDING FAIRY | `7741be0f-18f3-4504-88bc-cbac4ac38fd2` | K-pop-style creator sign-off |
| OFFICE CCTV | `f58ed219-84e8-4edc-ac72-a2b63c2af357` | B2B/SaaS "relatable office chaos" hook |
| TUSCAN YOGA | `a8deccdb-0e45-4475-a274-e8639da6fedd` | Wellness / lifestyle brand |
| NIGHT VISION | `0b8cb55f-1475-4229-a8ce-974a8f369f2f` | Edgy product reveal |
| DRIFT RACING | `c292001b-68e6-41af-a3a7-4177fef263e9` | Auto / energy / hype brand |

> ~30 more are gaming/action/sci-fi (CGI BREAKDOWN, STORM GIANT, ANDROID ASSEMBLE, SOUL FIGHTER + a "superhero-gen-preset" family of 14 — Magic Spell, Superfast flight, Disintegration, etc.). These are niche for most social accounts but gold for gaming/creator/entertainment ICPs. **Model name to invoke a preset = `higgsfield_preset` with the preset id.** [ASSUMED from brief — not test-generated.]

### A.3 Marketing Studio building blocks (UGC ad engine) [VERIFIED]

**Video modes** (`preset_type` / slug — the "what kind of ad"):
`UGC` (ugc), `Tutorial` (tutorial), `Unboxing` (ugc_unboxing), `Hyper Motion` (hyper_motion), `Product Review` (product_review), `TV Spot` (tv_spot), `Wild Card` (wild_card), `UGC Virtual Try On` (ugc_virtual_try_on), `Pro Virtual Try On` (virtual_try_on).

**Hooks** (the "attention mechanic", `hook_id`) — 9 verified, two flavours `stunt` / `subtle`:
| Hook | ID | Type |
|---|---|---|
| Product Hit | `3d45fb46-254f-4c83-9685-8e3d28945a67` | stunt |
| Spicy | `75b6d501-be0e-4416-a7ed-52f04f180574` | subtle |
| Interview (Erewhon-style) | `26cac2dd-99cb-4818-a678-509b0dab2c32` | subtle |
| Random Object Mic | `d50eb41c-fcfa-4f4d-93aa-473cdc6bc3b2` | stunt |
| Product Crash | `8101cd3e-3cc9-4607-a171-3582daa2f6ee` | subtle |
| Blizzard | `31976cc7-e597-4be2-9753-4a80153b0cc7` | stunt |
| Camera Bump | `2db84ed8-7082-4981-9c9c-9d61b3c28668` | subtle |
| Product Dodge | `5443eff1-d940-4ad3-9413-957bb048a6b0` | stunt |
| Epic Fail | `ec9fdf99-314d-480d-a656-10d9861341e7` | subtle |

**Settings** (the "where", `setting_id`) — 14 verified, `realistic` vs `unrealistic`:
- Realistic: Bedroom `b8368076…`, Nature `10f47b85…`, Gym `6bfbe372…`, Bathroom `189fa1ac…`, Kitchen `a0eb0be9…`, In Car `fdfa032c…`, Street `8c95f9ba…`, Office `d39dda10…`.
- Unrealistic (scroll-stoppers): Airplane Wing `b03705e5…`, Roofing `3cf2164e…`, Volcano Rim `e99c2ee8…`, Tiny Reviewer `f495493f…`, Car Roof `d6992aea…`, Train Surf `71f61bb0…`.
> **Constraint [VERIFIED]:** hooks/settings only supported for presets **UGC, Tutorial, Unboxing, Product Review, UGC Virtual Try On**. `hook_id`/`setting_id` are independent (use either/both/neither) but **mutually exclusive with `ad_reference_id`**.

**Ad formats / image styles** (DTC static-ad headline templates, `style_id` for `ms_image`) — **42 total** [VERIFIED]. The conversion-driving ones: Headline `18e9f327…`, Special Offer `c4c9ee3e…`, Customer Quote `e961f13c…`, Key Features `4b71d6d0…`, Benefits `fd9b886c…`, Social Proof `30ab1615…`, Then vs Now `ad65db31…`, Star Review `c3884bf7…`, Comparison Table `4ac40ba6…`, Bold Statement `bccb652b…`, Mystery Hook `c5012751…`, plus Magazine Style, App/Press Screenshot, UGC Side-by-Side, Whiteboard Explainer, Hero Statement, etc.

### A.4 Model recommender output [VERIFIED via models_explore action=recommend]

**Use-case 1 — "9:16 talking-head creator reel, consistent face":**
→ Top rec **`seedance_2_0`** (Bytedance, score 240). Tags: reference, identity, consistent, product, multi-sku, audio-reference, start/end-frame. AR includes 9:16. Duration 4–15s. Res 480/720/1080p; `mode` std/fast; `genre` hint. **This is the identity-consistency workhorse.**
→ Runner-up **`kling3_0`** (multi-shot, audio sync, motion-transfer, up to 4k, 9:16). Then Grok Imagine 1.5 (image-to-video, native audio direction).

**Use-case 2 — "DTC product ad video from a product photo, TikTok/Reels":**
→ Dominant rec **`marketing_studio_video`** (Higgsfield, score **1800**). Accepts `product_ids[]`, `avatars[]`, `hook_id`, `setting_id`, `ad_reference_id`, `generate_audio`, res to 1080p, AR 9:16. **The one-click UGC ad engine.**
→ For statics: **`marketing_studio_image`** (score 1720) and **`ms_image` / "DTC Ads"** (brand-kit-aware; **requires `style_id`**; optional `brand_kit_id`, `product_ids[]` up to 4, `quality` low/med/high, `batch_size` 1–20, res to 4K).

**Use-case 3 — "LinkedIn thought-leadership carousel image with crisp text":**
→ Top rec **`recraft-v4-1`** (Recraft, score 170). `model_type`: standard / vector / utility / utility_vector; accepts `colors[]` (hex palette up to 10) + `background_color` → **native brand-palette control**. Best for typography, logos, comparison graphics, vector brand assets.
→ Then `ms_image`, `nano_banana` / `nano_banana_2` (budget realistic, 4K). (Note: per brief, **gpt_image_2 is the best raw text-rendering model** — for headline-heavy carousels with lots of body copy, gpt_image_2 is the safer pick; Recraft wins on vector/brand-locked layouts.)

### A.5 Persona / reference primitives [VERIFIED]
- **Soul Characters** (`show_characters`): trained reusable identity. Train = name + **5–20 ref images, ~10 min**, non-blocking. Trained Soul usable **ONLY** with `text2image_soul_v2` (model `soul_2`) and `soul_cinema_studio`. **ONE soul_id per generation** (no two-person shots). Library currently **EMPTY**.
- **Reference Elements** (`show_reference_elements`): instant, single-image, **multiple references per generation** (`<<<element_id>>>` placeholders in the prompt), works with Nano Banana Pro/2, GPT Image 2, Seedream 4.5/5-lite, Cinema Studio 2.5, Cinema Studio Video 2/3.0, **Seedance 2.0, Kling 3.0**. Categories: character / environment / prop. Library currently **EMPTY**.
- **Decision rule:** Soul = identity-faithful single-person digital twin (influencer/personal brand). Elements = multi-subject scenes, props, environments, non-person brand objects, instant. **Both inject the persona/brand object into generation — this is how output stays on-brand BY CONSTRUCTION.**
- **Brand Kit** (`show_marketing_studio type='brand_kit'`): structured object holding brand_name, business_overview, logo (CDN URL), images, **colors[] (hex+usage)**, **fonts[] (name+usage)**, **tone_of_voice[]**, brand_values, brand_aesthetics, keywords, products_or_services, social_links, tagline. Can be auto-populated by scraping a website (`action='fetch'`, `scrap_url`). When passed as `brand_kit_id` to `ms_image`, logo/colors/fonts/tone are **folded into the prompt automatically**.

### A.6 Other relevant tools [VERIFIED present]
- **virality_predictor** — `create` (from a confirmed/generated video) → dashboard scoring virality potential, engagement, attention, audience response, retention risk, **hook strength**, creative performance. `preview` re-opens a job. **This is the quality/virality GATE.**
- **video_analysis_*** — deeper per-video creative analysis (jobs/status).
- Editing/finishing: `upscale_image`, `upscale_video`, `reframe` (aspect re-targeting → repurpose one asset to 9:16 + 1:1 + 16:9), `outpaint_image`, `remove_background`.
- Audio: `generate_audio` → `sonilo_music` (text→music), `mirelo_text_to_audio` (SFX), `inworld_text_to_speech` (~120 voices, EN + ~20 langs) — native VO/music, no ElevenLabs needed.
- Media plumbing: `media_upload`/`media_confirm`, `media_import_url` (web URL → media_id; **never pass raw URLs into params**), `media_upload_widget` (local files, Apps-UI only).
- Job lifecycle: `job_status`, `job_display`, `show_generations`, `show_medias`.

---

## PART B — CAPABILITY → SOCIALFLY USE-CASE MAP

| Higgsfield capability | SocialFly content use-case | Platform / format | Model id(s) |
|---|---|---|---|
| **Soul Character** (trained identity) | Influencer/personal-brand: SAME face on every post, on autopilot | IG/TikTok 9:16 reels, profile imagery | `soul_2`, `soul_cinema_studio` (train via `show_characters`) |
| **Reference Elements** | Brand mascot/product/environment reused across posts; multi-subject scenes | All formats | inject `<<<id>>>` into `seedance_2_0`, `kling3_0`, `nano_banana_2`, `gpt_image_2`, `seedream_v4_5` |
| **Brand Kit** | On-brand color/font/logo/tone enforced by construction | All static ads | `brand_kit_id` → `ms_image` (DTC Ads) |
| **marketing_studio_video** + hook/setting | DTC UGC product ad from a product photo | TikTok/Reels/Shorts 9:16 | `marketing_studio_video` (+ `product_ids`, `hook_id`, `setting_id`, `avatars`) |
| **ad_reference** | "Recreate this viral ad's structure" for a brand's product | 9:16 ad | `marketing_studio_video` + `ad_reference_id` |
| **ms_image / DTC Ads** + ad_format styles | Static conversion ads (Special Offer, Star Review, Comparison, Social Proof) | IG/FB feed 1:1 & 4:5, LinkedIn | `ms_image` (`style_id` + `brand_kit_id` + `product_ids`) |
| **marketing_studio_image** | One-click product image ad (no style picker) | Feed statics | `marketing_studio_image` |
| **recraft-v4-1** (vector/palette) | LinkedIn carousels, infographics, logos, comparison graphics, brand assets | LinkedIn 1:1 / 4:5, brand kit | `recraft-v4-1` (`model_type`, `colors[]`, `background_color`) |
| **gpt_image_2** | Text-heavy carousels/quote cards where copy must render perfectly | LinkedIn/IG carousel | `gpt_image_2` |
| **nano_banana / _2 / _pro** | High-volume cheap realistic image drafts; thumbnails; A/B variants | All feeds | `nano_banana`, `nano_banana_2`, `nano_banana_pro` |
| **seedream_v4_5 / v5_lite** | 4K hero stills, fashion/lifestyle imagery | Hero posts, ads | `seedream_v4_5`, `seedream_v5_lite` |
| **higgsfield_preset** (viral templates) | Personal-brand "main character" reels (Paparazzi, Red Carpet, Summer Haze) | IG/TikTok 9:16 | `higgsfield_preset` + preset_id |
| **seedance_2_0** | Talking-head creator reel w/ consistent identity; multi-SKU product video | 9:16 reels | `seedance_2_0` (reference/identity) |
| **kling3_0 / veo3_1** | HERO cinematic video, multi-shot, synced audio, up to 4K | Launch films, flagship reels | `kling3_0`, `veo3_1` (premium) |
| **minimax_hailuo / wan2_7** | Mid-tier video w/ physics/emotion or synced audio + character consistency | 9:16 reels | `minimax_hailuo`, `wan2_7` |
| **inworld_text_to_speech** | Voiceover in creator/brand voice, multilingual | Reels/Shorts VO | `generate_audio` (`inworld_text_to_speech`) |
| **sonilo_music / mirelo** | Background music + SFX, license-clean | All video | `generate_audio` (`sonilo_music`, `mirelo_text_to_audio`) |
| **virality_predictor** | Pre-publish virality/hook/retention GATE; "AI creative strategist" score | All video before scheduling | `virality_predictor` |
| **video_analysis** | Post-mortem creative analysis to feed the learning loop | Analytics | `video_analysis_create` |
| **reframe / upscale / remove_background / outpaint** | One asset → many platform aspect ratios; finishing/cleanup | Cross-post repurposing | `reframe`, `upscale_image/video`, `remove_background`, `outpaint_image` |
| **3D (image_to_3d, etc.)** | Product spins / 3D brand objects (niche) | Product showcase | `image_to_3d`, `multi_image_to_3d` |

---

## PART C — THE AI CREATIVE PIPELINE (autopilot, end-to-end)

### C.0 The "Brand DNA" object (single source of truth, injected at every stage)
```jsonc
{
  "brand_id": "uuid",
  "kind": "influencer | brand | company",
  // --- IDENTITY (who is on screen) ---
  "soul_id": "uuid | null",            // trained Soul for personal brand / single creator face
  "reference_elements": [              // mascots, signature props, hero product, environments
    { "element_id": "uuid", "role": "character|prop|environment", "name": "hero-product" }
  ],
  // --- HIGGSFIELD BRAND KIT (on-brand by construction) ---
  "higgsfield_brand_kit_id": "uuid",   // logo + colors[] + fonts[] + tone fed into ms_image
  "palette": ["#RRGGBB", ...],         // mirror for recraft colors[] / non-MS models
  "fonts": [{ "name": "...", "usage": "headline|body" }],
  "logo_url": "cdn...",
  // --- VOICE / STRATEGY ---
  "tone_of_voice": ["...", "..."],
  "brand_values": ["..."],
  "positioning": "one-liner",
  "audience_icp": "who + pains + desires",
  "pillars": ["education","behind-the-scenes","social-proof","offer"],
  "do_not": ["claims to avoid","banned words","competitor mentions"],
  "voice_id": "inworld voice id | null",   // VO voice
  "music_vibe": "text prompt seed for sonilo",
  // --- PLATFORM POLICY ---
  "platforms": {
    "tiktok":   { "ar": "9:16", "len_s": [7,30], "caption_style": "punchy+hook", "hashtags": 3-5 },
    "instagram":{ "ar": ["9:16","4:5","1:1"], "caption_style": "story+CTA", "hashtags": 5-10 },
    "linkedin": { "ar": ["1:1","4:5"], "caption_style": "POV+insight", "hashtags": 3 },
    "youtube":  { "ar": "9:16", "format": "shorts" },
    "x":        { "ar": ["16:9","1:1"], "caption_style": "thread-hook" }
  },
  // --- GUARDRAILS ---
  "virality_min_score": 0.6,           // gate threshold
  "monthly_credit_budget": 1500,
  "premium_share": 0.2                 // % of posts allowed to use premium models
}
```
Brand DNA is built once at **intake** (scrape site → `brand_kit fetch`; upload 5–20 photos → `Soul train`; upload product/logo → `Reference Elements`) and then **frozen + versioned**. Every downstream stage reads it; nothing invents brand attributes.

### C.1 Pipeline stages

```
1. INTAKE  → 2. STRATEGY (LLM) → 3. PROMPT-ENGINEER (per model) → 4. GENERATE (img/vid)
   → 5. VOICEOVER + MUSIC → 6. CAPTION + HASHTAGS (per platform) → 7. GATE (virality_predictor)
   → 8. REFRAME (multi-AR) → 9. SCHEDULE / PUBLISH → 10. LEARN (analytics + video_analysis)
```

**1. Intake → Brand DNA.** Scrape website (`show_marketing_studio action=fetch type=brand_kit scrap_url=...`) → auto brand kit. Train Soul from creator photos (`show_characters action=train`). Save product/logo/mascot as Reference Elements. Output = the Brand DNA object above. **[Injection point: Soul-ID + Brand Kit are created here.]**

**2. Strategy / idea generation (Claude LLM).** Input = Brand DNA + content pillars + calendar slot + trend signals. Output = a structured **content brief** per post: `{pillar, format(image|video|carousel), hook_angle, core_message, cta, target_platform, suggested_higgsfield_route}`. The LLM picks the *route* (UGC ad vs viral preset vs talking-head vs carousel) but NOT the brand attributes (those come from DNA).

**3. Prompt engineering (per model).** A model-specific prompt compiler turns the brief → exact `generate_*` params:
   - Always inject Brand DNA: `<<<element_id>>>` placeholders for elements; `brand_kit_id`/`colors[]` for palette; `soul_id` for face; tone into the textual prompt.
   - Route table: talking-head reel → `seedance_2_0` (+soul/element); DTC ad → `marketing_studio_video` (+product_ids+hook_id+setting_id); viral flex → `higgsfield_preset`; static conversion ad → `ms_image` (+style_id+brand_kit_id); LinkedIn carousel → `recraft-v4-1`/`gpt_image_2`; hero film → `kling3_0`/`veo3_1`.

**4. Generate.** Submit job(s) (`generate_image`/`generate_video`), poll `job_status`. For drafts, generate N cheap variants (Part D).

**5. Voiceover + music.** `inworld_text_to_speech` (voice_id from DNA) for VO; `sonilo_music` (music_vibe seed) for bed; `mirelo` for SFX. Compose onto the video (existing `video-composer.ts`).

**6. Caption + hashtags (per platform, LLM).** From the brief + Brand DNA `platforms` policy → platform-native caption, CTA, hashtag set, alt-text. Tone enforced from DNA `tone_of_voice`; `do_not` list applied.

**7. GATE — on-brand + quality + virality.** Three checks before anything schedules:
   - **Virality:** `virality_predictor create` on the video → require score ≥ `virality_min_score`; inspect **hook strength** + **retention risk**. Fail → regenerate (new hook/setting) up to K retries, then route to human or downgrade slot.
   - **On-brand:** brand kit + soul/element injection means it's on-brand by construction, but a lightweight LLM vision check verifies logo/palette presence and `do_not` compliance.
   - **Quality:** resolution / artifact / face-consistency check (LLM vision); optional `upscale` if borderline.

**8. Reframe.** One approved hero asset → `reframe` into each platform's required AR (9:16 / 1:1 / 4:5 / 16:9) so one generation feeds every channel. Saves credits massively.

**9. Schedule / publish.** Hand approved + captioned + reframed assets to the existing `publish.ts` + platform adapters + cron. Slot by optimal-time logic.

**10. Learn.** Pull post-performance analytics; run `video_analysis` on winners/losers; feed back into the strategy LLM's few-shot context and into per-brand hook/setting preference weights. **This closes the loop and is the "AI mentor / creative strategist" surface.**

### C.2 Where the brand stays on-brand BY CONSTRUCTION
| Brand attribute | Injected via | At stage |
|---|---|---|
| Face / identity | `soul_id` (Soul) or `<<<element_id>>>` (Element) | 3,4 |
| Logo / colors / fonts / tone | `brand_kit_id` (ms_image) + `colors[]` (recraft) | 3,4 |
| Hero product / mascot / props | Reference Elements `<<<id>>>` | 3,4 |
| Voice (audio) | `voice_id` → inworld | 5 |
| Caption voice / banned terms | `tone_of_voice` + `do_not` | 6 |
| Virality floor | `virality_min_score` | 7 |

---

## PART D — MODEL SELECTION STRATEGY (cheap volume vs premium hero)

### D.1 Tiering
| Tier | Use | Models | ~Credits | ~$ |
|---|---|---|---|---|
| **Draft / volume** | Many variants, A/B, daily filler, thumbnails | `nano_banana`, `nano_banana_2`, `seedream_v5_lite`, Seedance 2.0 **fast** mode | img ~0.25–2; vid ~3 | $0.01–0.30 |
| **Standard** | Default published post | `ms_image`/`marketing_studio_image`, `seedance_2_0` std, `recraft-v4-1`, `marketing_studio_video` 720p | img ~1–2; vid ~6 | $0.05–0.30 |
| **Premium / HERO** | Flagship/launch, high-stakes, paid-ad creative | `kling3_0` (4K, multi-shot), `veo3_1`, `soul_cinema_studio`, Seedance 1080p, `nano_banana_pro` 4K | vid ~12–20+ | $0.30–$1+ |

### D.2 How virality_predictor governs premium spend
1. **Draft cheap first.** For each brief, generate **3–5 cheap variants** (Nano Banana / Seedance fast).
2. **Score all variants** with `virality_predictor` (cheaper than re-shooting in premium).
3. **Spend premium only on proven winners.** Rule: only regenerate the **top-scoring variant** in a premium model (Kling/Veo/Soul Cinema), and only if `predicted_score ≥ premium_threshold` (e.g. 0.75) AND the post is flagged hero/launch/paid. Everything else ships at standard tier.
4. **Budget cap:** `premium_share` in Brand DNA hard-limits premium to ~20% of monthly posts, so credits don't blow out. Auto-refill (threshold 300) keeps autopilot alive without manual top-ups.
5. **Feedback:** real post analytics vs predicted score calibrates the threshold per brand over time — the predictor's threshold becomes adaptive.

**Net rule of thumb:** *predict on the cheap, generate on the proven.* The predictor is the credit-allocation governor, not just a vanity score.

### D.3 Honest quality vs cost notes
- **Cheap models are genuinely good now** (Nano Banana Pro at ~2 cr is "premium-ish"); the gap that still matters is **video motion/coherence/audio-sync** — that's where Kling/Veo/Seedance-std earn their cost. Statics rarely need premium.
- **virality_predictor is a model, not ground truth.** Treat its score as a *prior*, calibrate against real engagement; do not let it auto-publish unsupervised in early phases. [ASSUMED — its real-world correlation is unverified; we should A/B its predictions vs outcomes before trusting it as a hard gate.]
- **Soul training (~30 cr, ~10 min) is a fixed per-brand cost**, amortized over every future post — cheap at scale, but it's a real onboarding step (5–20 photos) the product must collect.
- **Reframe >> regenerate.** Generating once and reframing into 4 ARs is ~4–8× cheaper than generating per platform. The pipeline should default to this.

---

## ⚠️ CRITICAL ARCHITECTURE TRUTH (flagged, not hand-waved)
Everything above was exercised through **this chat's interactive OAuth'd MCP**. SocialFly's deployed Next.js server **cannot** reuse this connection. Before any of this ships, the architecture brain must confirm Higgsfield offers one of: (a) a server-side **REST/HTTP API + API key**, (b) a server-side MCP client with stored credentials, or (c) an agent/worker holding the session. **I found no evidence in the MCP surface of a public REST key path** — the tooling is MCP-native. If only interactive MCP exists, the honest near-term path is an **operator/agent worker** (a headless Claude/agent process holding the Higgsfield session and driven by SocialFly's queue), NOT a direct server SDK call. This gates the entire build — do not assume a REST API exists.

---

## TOP 3 RECOMMENDATIONS
1. **Make Brand DNA + injection the spine of the engine.** Soul-ID + Brand Kit + Reference Elements injected at generation = on-brand *by construction*. This is the single highest-leverage design decision and the moat vs generic "AI post" tools. Build intake (scrape→brand_kit, photos→Soul, product→Element) first.
2. **Adopt "predict cheap, generate premium" as the credit governor.** Draft 3–5 cheap variants → score with virality_predictor → spend Kling/Veo/Soul-Cinema only on the top winner, capped by `premium_share`. This keeps autopilot inside ~1,500–3,000 cr/mo per brand and makes the unit economics defensible.
3. **Lead the product with the UGC ad + viral-preset engine** (`marketing_studio_video` + hooks/settings/ad_reference, and `higgsfield_preset`). It's the most differentiated, lowest-effort "creator's dream" surface — one product photo or one selfie → a scroll-stopping 9:16 reel — and maps directly to the influencer/brand/company ICP.

## OPEN QUESTIONS FOR RIO
1. **Server access:** Does Higgsfield offer a REST API key / server SDK, or is it MCP-only? (Decides build path: direct calls vs agent-worker. **Blocking.**)
2. **Proof-gen budget:** Approve a small credit spend (~50–100 cr) to actually generate 1 talking-head reel + 1 DTC UGC ad + 1 carousel + run virality_predictor, to validate the pipeline end-to-end before we design around it?
3. **Soul vs Element default for "personal brand" ICP** — are we comfortable requiring 5–20 photos + ~10-min training at onboarding (best identity fidelity), or do we default to instant single-image Elements for faster activation and offer Soul as an upgrade?
4. **virality_predictor trust level** — gate hard (block publish below threshold) or advisory only until we've A/B-validated its scores against real engagement?
5. **Premium policy** — what `premium_share` and `virality_min_score` defaults do we ship (drives cost per brand/month)?
