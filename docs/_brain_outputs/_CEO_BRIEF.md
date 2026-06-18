# CEO BRIEF — SocialFly × Higgsfield rework + strategic rethink (Phase 0 R&D)

**Date:** 2026-06-16 · **Orchestrator:** x1000 CEO Brain (in-session fan-out) · **Repo:** `~/dropfly_projects/socialfly` (dropflyai/socialfly, main @ 680fd36)

## The mission (Rio's brief, verbatim intent)
1. **Dogfood:** SocialFly should run DropFly's OWN social media (we are customer #0).
2. **Higgsfield MCP becomes THE content engine.** Wire it in; rework the engine to reflect that.
3. **Extensive R&D on Higgsfield + the Higgsfield MCP** — what it can do, push the limits.
4. **Reposition:** "a content creator's DREAM to find SocialFly." Help grow an **influencer, brand, or company's** social media **on autopilot**.
5. **Back to basics — rethink some things.**
6. **Acquirability:** What makes us acquirable by another company? Who would acquire us & why? What must we do to get there?
7. **ICP:** Who wants this product and why?
8. **Innovation envelope:** earnings tracker, AI mentor / creative strategist, and "how does this make it effortless for people to automate their posting?"

R&D-FIRST. No engine rewrite this phase — we produce the plan + decision gates for Rio, then build incrementally with an E2E gate per increment.

## GROUND TRUTH — Higgsfield MCP (verified live in this session, read-only)
- Plan **Ultra**, **2,824 credits**, private workspace (owner). MCP authenticated and responding.
- **Image models:** nano_banana / _2 / _pro (Google), **soul_2** (UGC/fashion/character, accepts `soul_id`), **soul_cinematic**, **soul_cast** (consistent cinematic character identity / persona), **soul_location** (environments), seedream_v4_5 / v5_lite (Bytedance, 4K), z_image, flux_2 (+ kontext editing/style-transfer), gpt_image / _2 (best text rendering), grok_image, **recraft-v4-1** (logos, vectors, icons, product mockups, brand palettes), cinematic_studio_2_5, **marketing_studio_image** (one-click product ads), **ms_image = "DTC Ads"** (brand-kit-aware prompts + avatars + products + curated ad formats; requires `style_id` from show_marketing_studio), image_auto (router), **autosprite** (game sprite sheets).
- **Video models:** **seedance_2_0** (reference-driven, consistent identity, multi-SKU, image/video/audio refs), seedance_1_5, minimax_hailuo (physics/emotion), wan2_6 / **wan2_7** (synced audio + character-consistent), kling2_6 / **kling3_0** (multi-shot, audio sync, motion transfer, up to 4K), grok_video / _v15, **veo3 / veo3_1 / veo3_1_lite** (Google, top-tier cinematic, audio), cinematic_studio_video / _v2 / _3_0 (Higgsfield cinema), **marketing_studio_video** (one-click UGC product ads, TikTok/Reels-ready; supports `hook_id`, `setting_id`, and **`ad_reference_id` = "recreate this viral ad's scenario"**), **higgsfield_preset** (preset-routed image-to-video = viral templates from presets_show).
- **Audio:** sonilo_music (text→music), mirelo_text_to_audio (SFX), **inworld_text_to_speech** (~120 voices, EN + ~20 languages).
- **3D:** sam_3_3d, image_to_3d / multi_image_to_3d (Meshy; texturing, PBR, rigging, animation), 3d_rigging.
- **Key creative primitives for social:** (a) **Soul-ID / Soul Cast** → the SAME face/persona/character across every post (identity consistency — huge for influencer & personal-brand autopilot); (b) **brand-kit-aware DTC ad generation** (logo/colors/fonts/tone folded into the prompt); (c) **ad_reference** → clone the structure of a proven viral ad; (d) full native pipeline image→video→audio in ONE provider; (e) viral **presets** + **hooks/settings** for UGC.
- **Tools available in-session (read-only used for discovery):** balance, models_explore, presets_show, show_marketing_studio (avatar/product/webproduct/brand_kit/hook/setting/ad_format), show_characters, show_reference_elements, virality_predictor, video_analysis_*, generate_image/video/audio/3d, upscale/reframe/outpaint/remove_background, job_status/display, media_upload/import_url.
- **virality_predictor** exists — predicts video virality / engagement / hook strength. (Directly relevant to "creative strategist" + "AI mentor".)

## CRITICAL ARCHITECTURE QUESTION (must be resolved, do not hand-wave)
This Claude session can call the Higgsfield MCP because Rio OAuth'd it interactively. **SocialFly's deployed Next.js server CANNOT use this chat's MCP connection.** For production the engine needs one of: (a) Higgsfield's REST/HTTP API + API key (server-side), (b) a server-side MCP client with stored OAuth/credentials, or (c) an agent/worker that holds the Higgsfield session. Architecture + research brains MUST find out which of these Higgsfield actually offers and design to it. If only interactive MCP exists, the honest near-term path may be an operator/agent worker, not a direct server call. Flag the truth; don't assume.

## CURRENT SOCIALFLY ENGINE (files to read — `src/lib/`)
- `engine/`: autopilot.ts (741 lines — the autopilot loop), orchestra.ts (multi-agent), generate.ts, pipeline.ts, publish.ts, image-router.ts, video-router.ts, audio-router.ts, video-composer.ts, brand.ts, campaigns.ts, calendar.ts, analytics.ts, assets.ts, prompt-engineer.ts, replicate-tools.ts, newsletter-transformer.ts, config.ts, types.ts, index.ts.
- `ai/`: claude.ts, openai.ts. `platforms/`: facebook, instagram, linkedin, tiktok, twitter, index.
- API routes: `src/app/api/{automations,content,image,video,audio,caption,campaigns,brand,growth,analytics,posts,platforms,credits,billing,tier,orchestra,cron,...}`.
- Cron (vercel.json): /api/cron/{publish (every min), engagement (6h), automations (1h), growth (daily 6am)}.
- DB: Supabase, 19 migrations (autopilot tables, brand intelligence, multi-tenant security/RLS, campaigns, stripe billing, credit system, link redirects).
- Stack: Next 16, React 19, TS, Tailwind, Supabase, Stripe. Current AI media providers: fal, replicate, elevenlabs, google genai, openai, anthropic.

## OUTPUT CONTRACT (every brain)
- Write your raw output to `docs/_brain_outputs/<brain>-rd.md`. **Write incrementally** (section by section) so a crash never loses everything.
- Cite sources (URLs) for any external claim — no fabricated stats, repos, or comps. Separate VERIFIED from ASSUMED.
- Be honest about what you DON'T know. Flag risks and red lines.
- End with a short "TOP 3 RECOMMENDATIONS" + "OPEN QUESTIONS FOR RIO".
- Return to CEO a ~10-line summary (your file is the full artifact).
