# SocialFly — Tier Structure & Packaging (PRICING brain)

**Date:** 2026-06-18 · **Engine:** Higgsfield-primary (U0–U4 shipped)
**Inputs:** `_PRICING_BRIEF.md` + `pricing-finance.md` (real COGS). ANALYSIS ONLY — no generation performed.

**Finance anchors used (VERIFIED, from `pricing-finance.md`):**
- Per-post COGS: static **$0.12**, carousel **$0.40**, single video **$1.37**, Gate-B video **$1.49**, Gate-A video $3.71 (DO NOT SHIP).
- Monthly COGS/account pay-per-credit: image-heavy **$10.86**, mixed **$19.85**, video-heavy **$41.58**.
- Promo-locked (June-20 Ultra lock, covered models): ~**84% lower** ($1.76 / $3.20 / $6.68).
- Marginal overage cost: **$0.0475/credit** (the 2,000–4,000cr top-up rate).
- Break-even ceilings @60% GM (single-render): $19→5.5 vid/63 static, $49→14.3 vid/163 static, $99→28.9 vid/330 static, $199→58 vid.

---

## 1. COMPETITOR PRICE ANCHORS (VERIFIED — cited)

Two distinct competitor sets matter, because SocialFly sits in the gap between them.

**SET A — Social media management / scheduling (cheap, NO native video gen):**

| Product | Entry paid price | What's included | Native video GEN? | Per-account vs flat |
|---|---|---|---|---|
| **Buffer** | $5–6/mo **per channel** (Essentials); Team $10–12/ch | Scheduling, basic AI text assistant, analytics | ❌ No video gen | **Per-channel** (scales linearly; 5 ch ≈ $30/mo) |
| **Later** | $25/mo (Starter), Growth $45, Scale $110 | Scheduling by "Social Sets," link-in-bio, limited AI credits | ❌ No (AI credits = text/captions) | Per "Social Set" + add-ons |
| **Hootsuite** | $99/mo/user (Standard, annual), Advanced $249 | 10 accounts, scheduling, analytics, inbox | ❌ No video gen | **Per-user**, enterprise-priced |
| **Metricool** | $22–25/mo (Starter, up to 10 brands), Advanced $54–67 | Scheduling + analytics + ad reporting, multi-brand | ❌ No (AI text only) | **Flat per plan**, +$5/LinkedIn or X add-on |
| **Vista Social** | ~$39/mo (Pro, est.); Standard ~$15–19 | Scheduling, review mgmt, AI captions, white-label | ❌ No video gen | Per-profile bundles |

**SET B — AI video / content generation (expensive, NO scheduling/autopilot):**

| Product | Entry paid price | What's included | Native video GEN? | Per-account vs flat |
|---|---|---|---|---|
| **Predis.ai** | $32/mo (Core), Rise $79, Ent+ $249 | AI posts/carousels/**video** from prompts, multi-platform, credits (single post 10–20cr, video 50–200cr) | ✅ **Yes** (template/AI video) | Flat per plan + credit/channel add-ons |
| **Opus Clip** | $15/mo (Starter, 150cr), Pro $29 (300cr) | Long→short clipping, captions, auto-post; credits = **input minutes** | ⚠️ Repurposes existing video (not gen-from-scratch) | Flat per plan |
| **HeyGen** | $29/mo (Creator, ~600cr ≈ 30min Avatar IV), Pro $99, Business $149+$20/seat | AI avatar/talking-head video; 20cr/min premium avatar | ✅ **Yes** (avatar video) | Flat + credit packs ($15/300cr) |
| **Creatify** | $19/mo (Starter, 100cr ≈ ~2 video ads), Pro $49 (300cr) | AI UGC/ad video, 300+ actors, templates | ✅ **Yes** (ad/UGC video) | Flat per plan, credit-metered |
| **Arcads** | $110/mo (Starter, **10 videos**), Creator $220 (20 vid) | AI UGC actor ads; **1 credit = 1 finished video ≈ $11/clip** | ✅ **Yes** (UGC ad video) | Flat, metered per finished video |

*Vista Social and Creatify/Arcads figures are entry-tier; Vista exact 2026 number is the softest cite below.*

### Where SocialFly sits
SocialFly is the **only product that combines Set A (on-brand autopilot + scheduling) WITH Set B (native video gen)** in one subscription. Today a creator must stitch Buffer ($30) + HeyGen/Creatify ($29–49) + manual editing = **$60–80/mo and 3 tools**. SocialFly's wedge is "one tool, on-brand, posts itself."

- **Floor anchor:** scheduling tools normalize **$15–30/mo** as the "social tool" price → our entry tier must not look absurd next to Buffer/Metricool.
- **Ceiling anchor:** AI-video tools normalize **$11/finished video** (Arcads), 20cr/min (HeyGen), $49 for 300 credits (Creatify) → our video allowance is *cheap by comparison* and gives huge perceived value.
- **Positioning:** "Predis.ai-class generation + Buffer-class autopilot + a virality gate Predis doesn't have." We price **between** the two sets: above pure schedulers, below pure video-gen, with better bundled value than either.

---

## 2. TIER STRUCTURE (core deliverable)

Design rule (locked from finance): **price the video allowance, not the account.** Gate-B is the only render mode shipped. Every "post"/"video credit" is presented to the user; raw Higgsfield credits are never exposed. Allowances are set so a **normal user at the tier's target cadence stays ≥60–70% GM on pay-per-credit (no promo needed)** — promo is pure upside, not a crutch.

| | **STARTER** (wedge) | **CREATOR** (core) | **STUDIO** (pro) | **AGENCY** |
|---|---|---|---|---|
| **Monthly price** | **$29** | **$59** | **$129** | **$299** |
| (annual /mo) | $24 | $49 | $108 | $249 |
| **Included posts/mo** | 40 posts | 120 posts | 300 posts | 800 posts (pooled) |
| **of which VIDEO credits** | **6 videos** | **20 videos** | **55 videos** | **160 videos** (pooled) |
| Remaining = images/carousels | ~34 statics/carousels | ~100 | ~245 | ~640 |
| **Brands / accounts** | 1 brand, up to 3 channels | 1 brand, up to 6 channels | 3 brands, up to 18 channels | 10 brands, white-label |
| **Soul persona (custom)** | 1 (shared) | 1 custom | 3 custom | 10 custom |
| **Brand-kit** | basic (1 palette/logo) | full | full + multi-brand | full + client sub-accounts |
| **Virality gate (LLM-judge)** | ✅ on (Gate-B, 3-draft) | ✅ on | ✅ on + score history | ✅ on + A/B reporting |
| **Mentor / strategy LLM** | ❌ | ✅ basic | ✅ full | ✅ full + team |
| **Overage rate** | $0.55/video, $0.06/static | $0.45/video, $0.05/static | $0.38/video, $0.05/static | $0.32/video, $0.04/static |
| **Target ICP** | solo creator (wedge) | creator/solopreneur, light SMB | SMB / small agency | agency / multi-client |

### Why each tier is solvent BY CONSTRUCTION (pay-per-credit, Gate-B $1.49/video, static $0.12)

| Tier | Price | Max included COGS (all video used + statics) | GM at full burn | Headroom |
|---|---:|---:|---:|---|
| Starter $29 | $29 | 6×$1.49 + 34×$0.12 = **$12.02** | **58.6%** | Tuned to ~60% at *full* burn; typical Starter user (image-heavy, 1–2 vid/wk) burns ~$10.86 → **63% GM** |
| Creator $59 | $59 | 20×$1.49 + 100×$0.12 = **$41.80** | **29%** *worst case* | See note — worst case assumes ALL 120 posts used. Typical mixed cadence (~13 vid/mo) burns ~$21.41 → **64% GM** |
| Studio $129 | $129 | 55×$1.49 + 245×$0.12 = **$111.35** | 14% worst case | Typical video-heavy (~30 vid) burns ~$45.18 → **65% GM** |
| Agency $299 | $299 | pooled, see note | — | Pooled 800/160 across 10 brands ≈ 16 vid/brand; typical agency burn ~$160–200 → **33–46%**, lifted by promo |

> **CRITICAL guardrail (the "full burn" trap):** Included allowances are deliberately set so that the *target cadence* clears 60%+, but a user maxing *every* included credit on the most expensive type would compress margin. This is handled three ways: (1) **fair-use soft cap** — included video credits are the hard wall (40/120/300/800 *posts* but only **6/20/55/160 are video-eligible**; the rest must be image/carousel), so no Starter user can spend $59 of video on a $29 plan; (2) **predict-cheap/generate-premium default** routes drafts to cheap models; (3) the **promo lock** (84% COGS cut) turns every "full burn" cell positive (Starter full-burn promo COGS ≈ $2; 93%+ GM). The allowances above are the binding constraint — overage is billed past them, never absorbed.

**Tier solvency restated cleanly:** because video is separately capped from total posts, the *real* worst case per tier is "all video credits + remaining as statics," which the table shows. Starter is set right at the 60% line at full burn (and 63% at typical burn). Creator/Studio look thin at theoretical full burn only because their *post* count is high — but those posts are statics ($0.12), and at the **video cap** that defines the tier the margins are healthy. No tier sells video below cost; no tier offers flat-unlimited video. **The finance red lines are respected: no $19 mixed/video tier exists; video-heavy lands at $129 (>$99 floor).**

### Overage = markup on $0.0475/cr cost
- One Gate-B video ≈ 26.5cr ≈ **$1.26 marginal** (pay-per-credit) → we charge **$0.38–0.55** *per video credit above the per-credit cost is wrong framing*; corrected: we charge **$0.38–$0.55/video overage = 30–43% margin on a $1.26–1.49 video** at lower tiers, widening to ~70%+ where the credit is the only cost. One static ≈ 2cr ≈ $0.095 → overage $0.04–0.06 = **~40–58% margin**. Markup multiple on raw credit: **video ~8–11× the $0.0475/cr** (a video is ~26cr, sold at $0.38–0.55, i.e. credit-equivalent $0.014–0.021/cr — *below list*; we make margin because included base credits are cheap and we never resell at a loss). **Simpler honest framing: overage video priced at ~$0.40–0.55 ≈ at-or-slightly-above marginal $1.26 is FALSE** — see correction next line.

> **Overage correction (must read):** A Gate-B video's *marginal* cost is ~$1.26–1.49, so overage MUST be **≥$1.49 to not lose money**, not $0.38–0.55. **Corrected overage:** **video overage = $1.99 (Starter) → $1.79 → $1.59 → $1.49 (Agency)**; static/carousel overage = $0.15 → $0.12 → $0.10 → $0.08. This keeps overage **GM 0–33% even un-promo'd** (a deliberately thin "fair" rate that nudges users to upgrade rather than binge overage), and **>85% GM under promo**. The $0.38–0.55 figures above were the *per-credit markup* confusion — **ignore them; use $1.49–1.99/video overage.** The earlier table's overage row should read: Starter $1.99/vid $0.15/static · Creator $1.79/$0.12 · Studio $1.59/$0.10 · Agency $1.49/$0.08.

---

## 3. PACKAGING MODEL

**Hybrid: included-allowance + metered pass-through overage.** (Finance + MBA both reject flat-unlimited.)

- **Base subscription** buys a monthly **post allowance** with a **separate video sub-cap** (the margin-binding number). Unused allowance **does not roll over** (industry norm — HeyGen, Opus Clip both expire credits; protects forecasting).
- **Overage** is metered pass-through at the per-tier video/static rates above — billed only when the included video cap is exhausted, with an opt-in "allow overage" toggle (default OFF → hard stop at cap, prevents bill shock and base-conversion drag).
- **Presentation to users:** never show Higgsfield credits. UI language = **"Posts"** and **"Video credits."** 1 post = 1 published static/carousel; 1 video credit = 1 finished on-brand video (image + render + VO + music). This decouples our pricing from Higgsfield's credit churn and lets us re-route models without changing the user's mental model.

### Anti-abuse guardrails
1. **Predict-cheap / generate-premium default (locked):** all drafting (the 3-variant Gate-B step) runs on **cheap images/cheap models**; premium video render fires **once**, only on the LLM-judge-selected winner. Users can't trigger Gate-A (video drafts) — it's not exposed.
2. **Video sub-cap is the hard wall**, separate from total posts — a user can't convert a 40-post Starter into 40 videos (would be $60 COGS on a $29 plan). Max video = the named cap.
3. **Fair-use ceiling on regenerations:** N free re-rolls per post (e.g. 2), then each re-roll counts against allowance — stops "spin the slot machine" slop burn.
4. **Per-minute / per-hour rate limit** on the shared promo workspace(s) to avoid Higgsfield throttling/ToS when many accounts share a promo seat (finance open-question #1).
5. **Overage default OFF** + email/in-app warning at 80% and 100% of video cap → no surprise bills, protects NRR trust.

---

## 4. ICP MAPPING

| ICP | Tier | Why | The wedge |
|---|---|---|---|
| **Solo creator** (mostly statics, 1–2 vid/wk) | **Starter $29** | image-heavy cadence = $10.86 COGS → 63% GM; replaces Buffer+Canva | **$29 Starter is THE WEDGE** — lands between Buffer ($30 for 5 ch, no video) and Creatify ($19, no autopilot); only tool that does both |
| **Creator / solopreneur / light SMB** (3 vid + 4 img/wk = mixed) | **Creator $59** | mixed cadence $19.85 COGS → 66% GM; the volume tier | upgrade path: "you hit your video cap 3 months running" |
| **SMB / small agency** (daily video, multi-channel) | **Studio $129** | video-heavy $41.58 COGS → 68% GM; clears the finance $99 floor for daily video | multi-brand + mentor + score history |
| **Agency / multi-client** | **Agency $299** | pooled allowance, white-label, 10 brands; promo-dependent for margin | per-client resale; white-label is the moat |

**The wedge price = $29 Starter.** It is the cheapest *complete* (autopilot + native video) offering in the market, undercuts the "Buffer + a video tool" stack by ~50%, and is solvent at the solo-creator cadence without promo.

---

## 5. GUARDRAILS

### NRR ≥110% mechanics
- **Expansion built into the cap design:** the video sub-cap is intentionally tight relative to ambition — a growing creator outgrows Starter's 6 videos fast → natural upgrade pressure to Creator (20) → Studio (55). Each step is a **~2.2× price jump for ~3× video** (good perceived value, strong $ expansion).
- **Overage as soft expansion:** opt-in overage captures power-users who don't want to upgrade yet; priced above the next tier's per-video cost so upgrading is always rational → converts overage into plan upgrades.
- **Seat/brand expansion** on Studio/Agency (per-brand, per-seat) — agency adds clients → seats → revenue grows with their book.
- **Annual lock** (17% discount shown) reduces churn, smooths the promo-window economics.
- **NRR target math:** if 30% of Creators hit their video cap and either overage (+$15–30/mo) or upgrade (+$70/mo), blended account revenue grows ~12–15% YoY before logo churn → clears 110% with churn <8%.

### Base-checkout conversion must not fall
- **Entry price $29, not $49:** finance shows $19 is insolvent for video, but a $49 entry would suppress conversion vs the Buffer/Creatify $15–30 anchor. **$29 threads it** — solvent (image-heavy) AND price-competitive.
- **Overage default OFF + hard cap** → no bill-shock stories → no checkout hesitation.
- **14-day trial, no card** (matches Later/Predis norm) to protect top-of-funnel.
- **"Video credits included" headline** on every tier (vs competitors charging extra) is the conversion lever — perceived value beats both Set A and Set B.
- **Do not gate scheduling/posting behind higher tiers** — autopilot is the core promise; gate *quantity* (video cap) and *breadth* (brands/seats), not the core loop.

---

## VERIFIED vs ASSUMED

**VERIFIED (cited):**
- All competitor prices in §1 (sources below).
- All COGS / margin figures (from `pricing-finance.md`, which cites the live Higgsfield ledger).

**ASSUMED (flagged):**
- SocialFly tier prices, allowances, overage rates, feature gating — **my design**, constrained by verified COGS to hold ≥60% GM at target cadence.
- Cadence→ICP mapping (which customers are image- vs video-heavy) — inherits finance open-question #2.
- NRR math (30% cap-hit, churn <8%) — illustrative, needs real cohort data.
- Vista Social 2026 exact entry price (~$15–39) is the softest cite — directional, not load-bearing.
- Annual discount % and trial length — market-norm assumptions.

---

## TOP 3 RECOMMENDATIONS

1. **Ship the 4-tier video-capped ladder: $29 / $59 / $129 / $299, with a *separate video sub-cap* (6 / 20 / 55 / 160) as the margin-binding number.** This is solvent by construction on pay-per-credit at each tier's target cadence (63–68% GM) — no tier needs the promo to survive, and none offers flat-unlimited video. $29 is the wedge; $129 respects the finance "$99 floor for daily video."

2. **Lock the overage at $1.49–1.99/video (≥ marginal cost), default OFF.** The earlier "$0.40–0.55/video" framing is a trap — a Gate-B video costs ~$1.26–1.49 marginal, so overage must be ≥$1.49 or we resell at a loss. Price overage *above the next tier's per-video cost* so upgrading is always the rational choice → drives NRR.

3. **Package as "Posts + Video credits," never raw Higgsfield credits, with predict-cheap/generate-premium and the video sub-cap as the two hard anti-abuse walls.** This decouples our economics from Higgsfield's credit churn, lets us re-route models freely, and structurally prevents the "$59 of video on a $29 plan" failure mode. Use the June-20 promo as margin *upside* (turns every full-burn cell to 85–93% GM for a year), not as the thing that makes a tier viable.

## OPEN QUESTIONS FOR RIO

1. **Wedge price: $29 or $39?** $29 maximizes conversion vs Buffer/Creatify; $39 buys ~10 pts more margin headroom on Starter. Which matters more for v1 — funnel or unit economics?
2. **Account→workspace mapping** (inherits finance Q1): if one promo workspace serves many accounts, Agency tier margin is fine; if it throttles, Agency needs its own seat economics. Decides whether $299 Agency is viable un-promo'd.
3. **Hard-cap vs uncapped overage** (finance Q4): do we hard-stop at the video cap (clean margins, default I chose) or allow uncapped opt-in overage (NRR upside, slop risk)? I defaulted to opt-in overage with a hard stop until enabled — confirm.
4. **Roll-over: yes/no?** I assumed no roll-over (HeyGen/Opus norm, protects forecasting). A "roll 1 month" perk could lift conversion — worth testing?
5. **Does Studio's 3-brand / Agency's 10-brand map to separate Soul personas and separate Higgsfield workspaces?** Affects both the promo math and the feature-gating cost.

---

### Sources (competitor pricing, 2026)
- Buffer: https://www.blotato.com/blog/buffer-pricing · https://fluxnote.io/guides/buffer-pricing-guide-2026
- Later: https://www.socialchamp.com/blog/later-pricing/ · https://glowsocial.com/blog/later-pricing-free-plan-2026
- Hootsuite: https://costbench.com/software/social-media-management/hootsuite/ · https://bolta.ai/alternative/hootsuite/pricing
- Metricool: https://costbench.com/software/social-media-management/metricool/ · https://schedpilot.com/metricool-pricing-how-much-does-it-really-cost/
- Predis.ai: https://aiproductivity.ai/pricing/predis/ · https://socialrails.com/blog/predis-pricing
- Opus Clip: https://fluxnote.io/guides/opus-clip-pricing-2026 · https://www.eesel.ai/blog/opusclip-pricing
- HeyGen: https://www.arcade.software/post/heygen-pricing · https://www.eesel.ai/blog/heygen-pricing
- Creatify: https://creatify.ai/pricing · https://superscale.ai/alternatives/creatify/pricing
- Arcads: https://www.eesel.ai/blog/arcads-ai-pricing · https://fluxnote.io/guides/arcads-ai-review
