# PRODUCT R&D — SocialFly "Effortless Autopilot Posting"

**Brain:** Product · **Date:** 2026-06-16 · **Repo:** `~/dropfly_projects/socialfly`
**Scope:** ICP + the Effortless Autopilot UX + the three floated features (Earnings Tracker, AI Mentor, plus priority) + MVP cut.

> Grounding: read `_CEO_BRIEF.md`, the `src/app/(app)` route surface, `src/lib/engine/autopilot.ts` (741-line autopilot loop), `src/lib/links.ts` + migration `019_link_redirects.sql` (short-links with per-post click attribution ALREADY EXIST), `src/lib/engine/brand.ts` + migration `012_brand_intelligence_engine.sql` (brand profiles ALREADY carry colors/fonts/image_style/pillars/audience/pain-points), `src/lib/engine/analytics.ts` (post-level metrics aggregation EXISTS), `src/app/api/onboarding/route.ts` (6-step onboarding checklist EXISTS).

**Legend:** [EXISTS] already in repo · [BUILD] net-new · [HIGGSFIELD] capability verified in CEO brief.

---

## 1. ICP — WHO WANTS THIS & WHY

The CEO brief names the target as "influencer, brand, or company." That is three different buyers with three different jobs. Below are 4 concrete personas, then the v1 pick.

### Persona A — "The Solo Creator" (Maya, 24, personal-brand influencer)
- **Job-to-be-done:** "Stay top-of-mind and grow my following without living inside the apps." She IS the product; her face/persona is the brand.
- **Pain today:** Burnout. The hamster wheel of daily posting. Inconsistency tanks reach. She can't afford an editor. Generic AI tools produce "slop" that doesn't look like her, which would kill her credibility.
- **Why she'd pay:** A tool that keeps a *consistent on-brand persona* (same face, same vibe) posting daily so she stays relevant while she sleeps. The Soul-ID/Soul-Cast identity-consistency [HIGGSFIELD] is the unlock here — it is the ONE thing generic schedulers cannot do.
- **Success looks like:** Follower + engagement growth with <30 min/week of her time; content that her own audience can't tell she didn't make.
- **Honest objection:** "If it doesn't sound/look exactly like me, it'll embarrass me — and my audience will smell automation."

### Persona B — "The Local SMB Owner" (Dave, 47, owns a gym / dental practice / restaurant)
- **Job-to-be-done:** "Show up consistently online so I look legit and stay found, without thinking about it."
- **Pain today:** Zero time, zero skill, hates it, posts twice then ghosts for 3 months. Currently pays a $500–2k/mo agency that gives mediocre output, or does nothing.
- **Why he'd pay:** This is the clearest willingness-to-pay. He wants to NEVER think about it. Set brand once → it just runs. Replaces a line item he already pays (the agency).
- **Success looks like:** A steady stream of professional-looking posts, occasional foot traffic/calls he can attribute, and never opening the app.
- **Honest objection:** "I've been burned by 'set and forget' before — and I don't want it posting something dumb about my business."

### Persona C — "The DTC / Ecommerce Brand" (Priya, runs a Shopify skincare line)
- **Job-to-be-done:** "Pump out high-volume product/UGC creative across channels to drive sales."
- **Pain today:** Creative is the bottleneck and the cost. UGC ads, product shots, hooks — all expensive and slow.
- **Why she'd pay:** Higgsfield's **marketing_studio / ms_image "DTC Ads"** (brand-kit-aware product ads + avatars), **ad_reference** ("recreate this viral ad"), and one-provider image→video→audio [HIGGSFIELD] map almost 1:1 to her needs. ROI is measurable (sales).
- **Success looks like:** Lower CAC, more creative volume, attributable revenue.
- **Honest objection:** "I need this to plug into my ad account and my Shopify revenue, not just organic posts — and brand safety on product claims is non-negotiable."

### Persona D — "The Agency / Operator" (the multi-account power user)
- **Job-to-be-done:** "Run 10–50 client accounts with 2 people."
- **Pain today:** Labor doesn't scale; margins die on content production.
- **Why he'd pay:** Per-seat/per-account pricing; autopilot is a margin multiplier. This is also the SiteFly tie-in — SiteFly's scraped/built sites can be handed to SocialFly autopilot as a bundled offering.
- **Success looks like:** More accounts per operator, retained clients, white-label.
- **Honest objection:** "I need multi-account dashboards, approval workflows, and white-label before I bet my agency on you." (Repo already has multi-tenant RLS — migration 015 — so the floor exists.)

### PRIMARY ICP FOR v1 → **Persona A, The Solo Creator**, with Persona B (Local SMB) as the fast-follow.

**Why A first, not the higher-ARPU B/C/D:**
1. **It's the only persona where SocialFly's deepest moat (Higgsfield Soul-ID persona consistency) is the headline feature, not a nice-to-have.** "Same face, same voice, every post, on autopilot" is a product no incumbent scheduler (Buffer, Later, Hootsuite) can ship. That's the wedge.
2. It matches the CEO repositioning verbatim: **"a content creator's DREAM."**
3. Creators are a viral, self-propagating distribution channel — they post ABOUT the tools they use. Lower CAC.
4. Dogfooding fit: DropFly is customer #0 running its own brand accounts — that's literally Persona A/B behavior.

**Why B is the fast-follow, not v1:** B has higher/clearer willingness-to-pay (replaces an agency) but needs trust/brand-safety guardrails and local-business polish. The same autopilot engine serves B; we lead with A's magic, monetize B's pain.

**Defer C and D** to later phases (they need ad-account/Shopify integrations and multi-account ops UI respectively — real work, not v1).

---

## 2. THE EFFORTLESS AUTOPILOT FLOW

Design principle: **the user makes ~5 decisions, ONCE, then never has to again.** Everything after onboarding is opt-in oversight, not required input. The product's promise is removal of the daily decision, not a better editor.

### What EXISTS today (don't rebuild)
- [EXISTS] 6-step onboarding checklist (`/api/onboarding`): brand → connect platform → media → first post → automation → analytics.
- [EXISTS] Brand profile that scans a URL and infers voice/audience/colors/fonts/`image_style`/`content_pillars`/`pain_points`/`posting_schedule` (migration 012). This is the on-brand backbone.
- [EXISTS] Autopilot loop (`autopilot.ts`): calendar execution → repurpose top performers → smart gap-fill by content mix + product weighting → insights → weekly digest. Quiet hours, max-posts/day, draft-vs-autoPublish.
- [EXISTS] Short-links with click attribution (`links.ts`, migration 019) wired to `conversion_url` on the brand.
- [EXISTS] Per-post metrics aggregation, best-time inference (`analytics.ts`).
- [EXISTS] Platform publishers for IG/FB/LinkedIn/TikTok/Twitter; cron publishes every minute.

### What's MISSING for "effortless" (the gaps)
1. **Persona/Soul-ID capture in onboarding.** Brand profile captures voice/colors but NOT a visual identity (the creator's face/character). Higgsfield Soul-ID/Soul-Cast needs a `soul_id` reference. **[BUILD]** Add a "Your face / your look" step: user uploads 3–5 photos (or picks a generated persona) → we mint a `soul_id` and store it on the brand profile. This is the single most important new field.
2. **Higgsfield as the content engine.** Today `generate.ts` routes to fal/replicate/etc. **[BUILD per arch brain]** route image/video generation through Higgsfield models, passing `soul_id` + brand-kit (colors/fonts/tone) so every asset is identity-consistent and on-brand by construction.
3. **Strategy auto-config.** Autopilot config defaults are generic. **[BUILD]** On brand-setup completion, an LLM proposes a starter strategy (platforms, posting cadence, content-mix, 2-week calendar) that the user accepts in one tap.
4. **A real "go live" moment.** Currently config defaults to `enabled:false, autoPublish:false`. **[BUILD]** A single autopilot ON switch with a clear preview of the next 7 days.

### The end-to-end flow (the design)

**Step 0 — Connect (2 min).** Connect 1+ social account (OAuth, [EXISTS]). That's the only hard dependency.

**Step 1 — Define brand/persona ONCE (3 min).** The decisions, all of them:
- **Decision 1:** Paste your website/IG handle → we auto-fill brand voice, audience, colors, pillars [EXISTS via URL scan]. User confirms or tweaks.
- **Decision 2:** Upload 3–5 photos of yourself (Persona A) OR your product (Persona C) OR skip and pick a generated persona/aesthetic → we mint the `soul_id` [BUILD].
- **Decision 3:** What are you trying to do? (Grow audience / Drive traffic-sales / Stay consistent). This sets the content-mix weights.
- **Decision 4:** How often + which platforms. (We pre-fill a sane default; one tap to accept.)
- **Decision 5:** Where should clicks go? (`conversion_url` [EXISTS]) — optional.

**Step 2 — Autopilot proposes a strategy [BUILD].** Instantly generates: a 2-week content calendar (topics × pillars × platforms), recommended cadence, and **3 sample posts fully rendered** (caption + on-brand image/video via Higgsfield with their face). User sees their persona already producing content.

> **★ THE MAGIC MOMENT ★** = seeing **yourself (your face / your brand) in 3 finished, scroll-stopping posts you didn't make**, within ~5 minutes of signing up — before paying, before lifting a finger. Not "here's a caption" (every tool does that). It's "here's *you*, on-brand, ready to post." That is the demo that converts and the screenshot creators will share.

**Step 3 — One switch: Autopilot ON.** From here the cron-driven loop [EXISTS] runs: executes calendar → posts on optimal schedule → repurposes winners → fills gaps on-brand. autoPublish flips from draft to live.

**Step 4 — Measure & learn [EXISTS + EXTEND].** Metrics ingested per post; short-link clicks tracked; weekly digest generated. **[BUILD]** Feed `virality_predictor` [HIGGSFIELD] BEFORE posting so low-scoring drafts get regenerated, and feed real engagement back to shift the content mix.

**Step 5 — Minimal-touch oversight (opt-in).** Default mode = fully autonomous. Optional "Approve before posting" mode for nervous users (Persona B) → a daily/weekly batch of drafts they thumbs-up in 60 seconds. One global pause button.

### How few decisions, and how it stays non-sloppy
- **Decisions required after onboarding: zero.** Everything else is optional oversight.
- **On-brand by construction, not by review.** Slop comes from generic models with no identity. We avoid it three ways: (1) `soul_id` locks the *same* face/character across every asset [HIGGSFIELD Soul-Cast]; (2) the brand-kit (colors/fonts/`image_style`/tone — all [EXISTS] on the profile) is injected into every Higgsfield prompt so output matches the brand visually and verbally; (3) `virality_predictor` acts as an automated quality/virality gate — if a draft scores low on hook strength, the autopilot regenerates instead of shipping. The user never sees the misses.
- **Guardrails:** quiet hours, max-posts/day [EXISTS], a brand-safety denylist of claims/topics [BUILD — critical for Persona B/C], and a "never post twice the same thing" dedup [EXISTS in repurpose logic].

### The Soul-ID → on-brand pipeline (concrete)
`brand_profiles.soul_id` (new) + existing `voice_tone`, `voice_vocabulary`, `color_*`, `font_*`, `image_style`, `content_pillars` →
prompt-builder composes `{pillar topic} + {brand voice} + {soul_id reference} + {brand colors/style}` →
Higgsfield `soul_2`/`soul_cast` (image) or `seedance_2_0`/`veo3` (video, identity-consistent) →
caption via Claude with brand voice →
`virality_predictor` gate →
schedule + short-link → publish. **The user touched none of it after Step 1.**

---

## 3. THE THREE FLOATED FEATURES — make them real or kill them

### 3A. EARNINGS TRACKER — **MAKE IT REAL, but as a phased "ROI Tracker," not full accounting.**

**What it would actually track (creator revenue streams):**
- **Click attribution [EXISTS — ship now].** Short-links (`link_redirects`) already log `click_count`, `first/last_clicked_at`, per `post_id`/`platform`/`brand`. We can already show "this post drove N clicks to your link." This is the free, honest, zero-integration foundation.
- **Sponsorships [BUILD — manual entry].** Let the creator log "Brand X paid me $800 for these 3 posts." We tie spend to those posts' reach/engagement → an effective CPM and "value delivered" they can show the sponsor. High value: creators chronically under-price and under-prove sponsorships.
- **Affiliate revenue [BUILD — phased].** Phase 1: manual entry of affiliate earnings tagged to a campaign. Phase 2: pull from Amazon Associates / ShareASale / Impact APIs (real integration work — defer).
- **Product / DTC sales [BUILD — Persona C].** Shopify/Stripe webhook → revenue, with our short-link click as the attribution touch. Stripe MCP is available in this stack; Shopify is an integration to scope later.
- **Ad-rev / creator-fund [BUILD — manual or platform API].** YouTube/TikTok payouts; mostly manual entry early (platform APIs are gated).

**Is it valuable or vanity?** **Valuable — IF framed as "what is my content WORTH," not a vanity dollar counter.** The honest insight is: *clicks → conversions → revenue per post, and which content pillar earns.* That closes the loop the whole product promises ("grow your brand"). It directly answers the creator's real anxiety: "is any of this making money?" Vanity risk is real if we slap a fake "$" on engagement — so the rule is: **only count money the user can verify (logged or integrated), never estimate revenue from impressions.**

**How it works concretely (v1):**
- Every CTA in an autopilot post gets a tracked short-link [EXISTS].
- Dashboard card: "Top earning posts" = posts ranked by clicks (now) → by attributed revenue (after manual logging / Stripe-Shopify integration).
- "Sponsorship value" calculator: pick posts → see total reach/engagement → suggested rate-card price (benchmarked CPM). This is a *get* for creators and a sticky reason to stay.
- Feeds the AI Mentor: "Your 'behind the scenes' pillar earns 3x your 'promotional' pillar — make more of it."

**Verdict:** Ship the **click-attribution + sponsorship-value** layer in MVP (cheap, builds on existing tables). Defer affiliate/Shopify/ad-rev integrations. Brand it **"ROI" / "Worth"** to avoid vanity-metric trap.

### 3B. AI MENTOR / CREATIVE STRATEGIST — **MAKE IT REAL. This is the differentiator that turns a tool into a "dream."**

There are two halves and they have very different value:
- **The autonomous half (high value, runs silently):** the mentor IS the autopilot's brain — it sets the strategy, picks pillars, gates drafts with `virality_predictor`, shifts the mix from results. This already half-exists in `generateInsights` + `generateWeeklyDigest`. The value is real because it's *acting*, not just talking.
- **The conversational/coaching half (high value IF specific, gimmick IF generic):** a weekly check-in the creator actually reads.

**What it says/does for the user weekly (concrete, non-gimmick):**
1. **Scorecard:** "This week: 7 posts, +312 followers, 4.1% engagement (up from 2.8%), 89 link clicks, est. $X sponsorship value." (All from [EXISTS] analytics + links.)
2. **What worked / what didn't, with the WHY:** "Your Tuesday Reel hit 12k views — `virality_predictor` flagged its hook as strong. Your Friday carousel underperformed; weak hook." (Uses [HIGGSFIELD] `video_analysis_*` + `virality_predictor`.)
3. **A concrete next move, already queued:** "I've drafted 3 posts in your top-performing 'POV' format for next week — approve or let them auto-post." (Action, not advice.)
4. **One strategic nudge:** "You haven't posted to TikTok in 9 days; it's your highest-growth channel. Want me to shift 2 posts there?" (One-tap yes.)

**Where's the real value vs gimmick:**
- **Real:** it predicts virality *before* posting (regenerate the dud), it ties content → revenue, and every recommendation comes with a one-tap action that the autopilot executes. A coach that does the work, not just nags.
- **Gimmick risk:** generic "post more consistently!" advice with no data, or a chatbot that just rephrases analytics. Kill that. **Rule: every mentor statement must cite a number from THIS account and end in a button.**

**Verdict:** Real. The autonomous half ships in MVP (it's the autopilot brain). The weekly conversational digest ships in MVP too (extends `generateWeeklyDigest`). A free-form "ask my strategist" chat is a fast-follow, not MVP.

### 3C. PRIORITY ORDER ACROSS THE THREE + AUTOPILOT

1. **AUTOPILOT (incl. Higgsfield content engine + Soul-ID).** This IS the product. Nothing else matters if "set it and forget it" with on-brand persona output doesn't work. Highest priority by far.
2. **AI MENTOR (autonomous brain + weekly digest).** It's not a separate feature — it's the intelligence layer of the autopilot. Ships alongside #1; the `virality_predictor` gate is part of making autopilot non-sloppy.
3. **EARNINGS / ROI TRACKER (click-attribution + sponsorship value).** Cheapest to ship (tables exist), real retention/upsell hook, but the product is compelling without it. Ships in MVP as a lightweight card; deep revenue integrations deferred.

> Mental model: **Autopilot is the engine, the Mentor is the driver, the Earnings tracker is the speedometer.** Build engine + driver first; the speedometer is a fast add.

---

## 4. THE MVP CUT — smallest version that delivers the "creator's dream" feeling

**Target user:** Persona A (Solo Creator). **Promise:** "Connect your account, upload 5 photos, and watch yourself post on-brand every day — on autopilot."

**The MVP is mostly WIRING what already exists + ONE new capability (Soul-ID → Higgsfield).** Don't rebuild the autopilot loop, analytics, links, brand profiles, publishers, or cron — they exist.

### IN scope (MVP)
1. **[BUILD-small] Soul-ID capture** in brand setup: upload 3–5 photos → mint `soul_id` (Higgsfield) → store on `brand_profiles`. *One new field + one upload step + one Higgsfield call.*
2. **[BUILD per arch brain] Higgsfield content engine** for image (`soul_2`/`soul_cast`) and short video (`seedance_2_0`/`veo3_lite`), passing `soul_id` + brand-kit. Replaces/augments current `generate.ts` routing. *This is the heaviest lift and depends on the architecture brain resolving the server-side Higgsfield access question (REST API vs worker/agent — see CEO brief's critical architecture question).*
3. **[BUILD-small] The Magic Moment:** after brand setup, generate 3 finished on-brand posts (their face) + a 2-week calendar in one screen. Reuses existing generate + calendar code.
4. **[BUILD-small] Autopilot ON switch** with a 7-day preview. Flips `enabled`/`autoPublish`. Loop already exists.
5. **[EXISTS] Schedule → publish** via existing cron + publishers (start with IG + 1 more platform; don't need all 5 for MVP).
6. **[BUILD-small] virality_predictor quality gate** in the generation pipeline (regenerate low scorers).
7. **[BUILD-small] Weekly digest = AI Mentor v1** (extend `generateWeeklyDigest`: add the scorecard + one queued next-step).
8. **[EXISTS + tiny UI] ROI card v1:** "clicks per post" from `link_redirects`. Sponsorship-value calc if time allows.

### OUT of scope (explicitly deferred)
- Affiliate / Shopify / ad-rev revenue integrations (manual logging only, if at all, in MVP).
- Free-form "chat with my strategist."
- Persona C ad-account/DTC deep features; Persona D multi-account ops UI / white-label.
- All 5 platforms — ship 2, prove the loop.
- 3D, games, music, advanced video composition.

### The MVP "dream" test
A creator signs up, connects IG, uploads 5 selfies, taps "looks right" twice, flips Autopilot ON — and over the next week IG fills with on-brand posts of *them* they didn't make, plus a Sunday digest that says "you grew +X and here's next week, already drafted." If that loop works end-to-end for ONE real account (DropFly's own — dogfood / customer #0), the MVP is done.

---

## TOP 3 RECOMMENDATIONS

1. **Lead with Persona A (Solo Creator) and make Soul-ID persona consistency the headline.** It's the one feature incumbents (Buffer/Later/Hootsuite) structurally cannot copy, it matches the "content creator's DREAM" repositioning, and creators self-distribute. Monetize Persona B (SMB, replaces an agency) as the fast-follow on the same engine.
2. **Engineer the "Magic Moment" deliberately: 3 finished, on-brand posts of the user's own face within ~5 minutes, before paywall.** This single screen is the demo, the conversion event, and the viral screenshot. Everything in onboarding should drive toward it.
3. **Ship the Mentor as the autopilot's brain (with the `virality_predictor` gate), not as a chatbot.** Every recommendation cites this account's numbers and ends in a one-tap action the autopilot executes. Ship the ROI/Earnings tracker as a thin click-attribution card on day one (tables exist) and defer revenue integrations — frame it as "what your content is WORTH" to dodge the vanity-metric trap.

## OPEN QUESTIONS FOR RIO

1. **Architecture dependency (blocking):** MVP item #2 hinges on how SocialFly's *server* reaches Higgsfield (REST API + key vs. a worker/agent holding the session — see CEO brief's critical architecture question). Product MVP timeline is gated on the architecture brain's answer. Acceptable to ship a human/agent-in-the-loop "operator" worker for v1 if no server REST API exists?
2. **Trust posture / autoPublish default:** For Persona A, do we default to fully autonomous posting (max wow, some risk) or "approve-the-batch" (safer, more friction)? Recommendation: autonomous default for A, approve-mode default for B — confirm.
3. **Soul-ID consent & authenticity:** Are we comfortable, brand-wise, with AI-generated images of a *real creator's face* posting as "them"? Where's the line between "on-brand persona" and "deepfake of myself"? Need a disclosure/consent stance before we ship the headline feature.
4. **Pricing & willingness-to-pay:** Persona A (creators) are price-sensitive; Persona B (SMB) pays more. Do we lead with a low creator price for distribution/virality, or anchor on SMB pricing? Affects which persona's UX we polish first.
5. **Earnings tracker depth:** Is the manual sponsorship/affiliate logging worth building in MVP, or is click-attribution-only enough until we have paying users asking for it?
6. **Scope of "all platforms":** OK to ship MVP on just IG + one more, or is multi-platform table-stakes for the positioning?
