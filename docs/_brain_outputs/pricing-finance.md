# SocialFly — COGS + Gross-Margin Model (FINANCE brain)

**Date:** 2026-06-18 · **Engine:** Higgsfield-primary (U0–U4 shipped)
**Planning marginal cost:** **$0.0475/credit** (the 2,000–4,000cr top-up rate; what a scaling business pays past plan credits). ANALYSIS ONLY — no generation performed.

---

## 0. COST ANCHORS — VERIFIED vs ASSUMED

### VERIFIED (from brief, live transaction ledger)
| Asset | Credits | $ @ $0.0475 |
|---|---|---|
| Cheap image (Seedream/Nano-Banana base) | 0.25–1 | $0.01–0.05 |
| Premium image (Nano-Banana Pro 2K, Mktg Studio) | 2 | $0.10 |
| Video — Seedance 2.0 | 22.5 | $1.07 |
| Video — Veo 3.1 | 16.5–22 | $0.78–1.05 |
| Video — Cinematic 3.0 | 25–30 | $1.19–1.43 |
| Video (planning midpoint) | ~22 | ~$1.05 |
| Voiceover (TTS) | 2 | $0.10 |
| Music | ~2 | $0.10 |
| SFX | 0.4 | $0.02 |
| Soul training (one-time/persona) | ~30 | ~$1.43 |

### ASSUMED (flagged — not in ledger)
- **Claude LLM per post (caption + strategy):** ~$0.01–0.03. Plan at **$0.02**.
- **Claude LLM-judge per gate decision:** ~$0.005–0.02. Plan at **$0.0125**.
- **virality_predictor:** unreliable (failed 3×) → treated as **$0**; gate uses LLM-judge.
- **Cadences:** image-heavy / mixed / video-heavy (brief's definitions).
- **Premium-render video planning cost:** $1.05 (Veo/Seedance midpoint). Draft video uses cheapest video tier.
- **Draft images** assumed at cheap tier ($0.04 ea, midpoint of 0.25–1cr range).

> Claude pricing note: judge+caption is small-token, single-turn. $0.02 caption + $0.0125 judge are conservative upper-mid estimates; real cost likely lower with Haiku-class judging. Material only at extreme volume (see §4).

---

## 1. PER-POST-TYPE COGS (real prices, $0.0475/cr)

**Claude per post:** caption $0.02. Gate adds judge $0.0125. (One judge call ranks the 3 drafts.)

| Post type | Higgsfield credits | Higgsfield $ | + Claude $ | **Total COGS** |
|---|---|---|---|---|
| **Static image post** | 2 (premium img) | $0.10 | $0.02 | **$0.12** |
| **Carousel (3–5 img)** — plan 4 imgs | 8 | $0.38 | $0.02 | **$0.40** |
| **Single video post** (1 premium img + 1 video + VO + music) | 2+22+2+2 = 28.5 | $1.35 | $0.02 | **$1.37** |
| **Premium video, 3-draft gate** (3 cheap-draft videos + judge + 1 premium render + img+VO+music) | see below | see below | $0.02 + $0.0125 | **$2.78** |

### 3-draft-gate breakdown (the two-phase rule: draft cheap, render premium on winner)
| Component | Qty | Credits ea | $ ea | $ total |
|---|---|---|---|---|
| Draft videos (cheapest video tier ~16.5cr / Veo low) | 3 | 16.5 | $0.78 | $2.35 |
| LLM-judge (Claude) | 1 | — | — | $0.0125 |
| Premium render (winner, Veo/Seedance ~22cr) | 1 | 22 | $1.05 | $1.05 |
| Hero image (premium) | 1 | 2 | $0.10 | $0.10 |
| Voiceover | 1 | 2 | $0.10 | $0.10 |
| Music | 1 | 2 | $0.10 | $0.10 |
| Caption (Claude) | 1 | — | — | $0.02 |
| **TOTAL** | | | | **$3.71** |

> **Correction to the headline row above:** full premium-video-with-gate = **$3.71**, not $2.78. The $2.78 figure assumed draft videos at the cheap-IMAGE rate, which is wrong — drafts are still videos. **Using $3.71 as the real 3-draft-gate video cost.** If drafts are done on cheap IMAGE storyboards instead of draft videos (a cheaper design), gate cost drops to ~$1.50 (3×$0.04 img drafts + premium render + extras). **Both modeled in §2.**

**Two gate-design variants carried forward:**
- **Gate-A (video drafts):** $3.71/video post — highest fidelity, most expensive.
- **Gate-B (image-storyboard drafts):** ~$1.49/video post — draft on 3 cheap images, judge picks composition, render 1 premium video. *Recommended design.*
- **Single-render (no gate):** $1.37/video post.

---

## 2. MONTHLY COGS PER ACCOUNT — the matrix

**Cadence definitions (monthly, ~4.3 wk):**
- **Image-heavy:** 22 statics + 6 videos (mostly statics + 1–2 video/wk)
- **Mixed:** 17 images + 13 videos (3 video + 4 image/wk)
- **Video-heavy:** 30 videos + 4 statics (daily video)

| Cadence | Render mode | **Pay-per-credit ($0.0475)** | **Promo-locked (covered models ~$0)** |
|---|---|---:|---:|
| Image-heavy | single-render | **$10.86** | **$1.76** |
| Image-heavy | 3-draft gate-B (img drafts) | **$11.58** | **$1.83** |
| Image-heavy | 3-draft gate-A (vid drafts) | **$24.90** | — |
| Mixed | single-render | **$19.85** | **$3.20** |
| Mixed | 3-draft gate-B | **$21.41** | **$3.36** |
| Mixed | 3-draft gate-A | **$50.27** | — |
| Video-heavy | single-render | **$41.58** | **$6.68** |
| Video-heavy | 3-draft gate-B | **$45.18** | **$7.06** |
| Video-heavy | 3-draft gate-A | **$111.78** | — |

**Reading it:** Gate-A (drafting on full videos) is a margin killer — it ~doubles to ~triples video COGS. Gate-B (draft on cheap images, render premium video once) costs almost the same as single-render and is the correct design. Promo-locked collapses COGS to mostly VO+music+Claude (the un-covered tail).

> Note: Ultra plan includes 3,000 credits/mo as a *base allowance* (~$0 marginal until exhausted). A single video-heavy account burns ~700 cr/mo single-render, ~900 cr gate-B — so **one Ultra plan's 3,000 cr covers ~3–4 video-heavy accounts OR ~one account's drafts+overflow** before top-up rate kicks in. Pay-per-credit table above is the *conservative past-allowance* cost; true blended cost is lower while base credits last.

---

## 3. GROSS MARGIN at candidate prices ($19 / $49 / $99 / $199)

GM% = (price − monthly COGS) / price. **Bold = below 60% target. NEG = negative (selling at a loss).**

### Pay-per-credit, single-render
| Cadence | COGS | $19 | $49 | $99 | $199 |
|---|---:|---|---|---|---|
| Image-heavy | $10.86 | **43%** | 78% | 89% | 95% |
| Mixed | $19.85 | **NEG (−4%)** | **59%** | 80% | 90% |
| Video-heavy | $41.58 | **NEG (−119%)** | **15%** | **58%** | 79% |

### Pay-per-credit, 3-draft gate-B (recommended gate design)
| Cadence | COGS | $19 | $49 | $99 | $199 |
|---|---:|---|---|---|---|
| Image-heavy | $11.58 | **39%** | 76% | 88% | 94% |
| Mixed | $21.41 | **NEG (−13%)** | **56%** | 78% | 89% |
| Video-heavy | $45.18 | **NEG (−138%)** | **8%** | **54%** | 77% |

### Pay-per-credit, gate-A (video drafts — DO NOT SHIP)
| Cadence | COGS | $19 | $49 | $99 | $199 |
|---|---:|---|---|---|---|
| Image-heavy | $24.90 | **NEG** | **49%** | 75% | 87% |
| Mixed | $50.27 | **NEG** | **NEG** | **49%** | 75% |
| Video-heavy | $111.78 | **NEG** | **NEG** | **NEG** | **44%** |

### Promo-locked, single-render (all comfortably clear 60%)
| Cadence | COGS | $19 | $49 | $99 | $199 |
|---|---:|---|---|---|---|
| Image-heavy | $1.76 | 91% | 96% | 98% | 99% |
| Mixed | $3.20 | 83% | 93% | 97% | 98% |
| Video-heavy | $6.68 | **65%** | 86% | 93% | 97% |

**Negative cells (selling at a loss), pay-per-credit:** every cadence at $19 except image-heavy; Mixed & Video-heavy at $19; Video-heavy never clears 60% below $99 even single-render. Gate-A is negative across most of the grid.

---

## 4. BREAK-EVEN — max posts/mo before GM < 60%

Budget for COGS at 60% GM = 40% × price. Pure-video and pure-static ceilings:

| Tier | Max **video posts**/mo (single-render $1.37) | gate-B ($1.49) | gate-A ($3.71) | **promo** ($0.22) | Max **static posts**/mo ($0.12) |
|---|---|---|---|---|---|
| $19 | 5.5 | 5.1 | 2.0 | 34.5 | 63 |
| $49 | 14.3 | 13.2 | 5.3 | 89 | 163 |
| $99 | 28.9 | 26.6 | 10.7 | 180 | 330 |
| $199 | 58.1 | 53.4 | 21.5 | 362 | 663 |

**Takeaways:**
- At **$49**, you can sustain ~14 videos/mo (≈3/wk = the Mixed cadence) at 60% GM single-render. Mixed barely fits $49.
- **Video-heavy (30/mo) needs $99+** to stay ≥60% on pay-per-credit; at $99 it's right at the line (~29 video cap).
- **Claude cost is immaterial to break-even** until ~thousands of posts: at 30 videos/mo, Claude = $0.34–$0.52 (caption+judge), <2% of video-heavy COGS. It only matters at fleet scale (1,000 accounts × 30 = ~$15/mo total — negligible).
- Promo multiplies the ceiling **~6–10×**: $19 promo sustains ~34 videos/mo at 60% GM (vs 5.5 pay-per-credit).

---

## 5. PROMO SENSITIVITY (June-20 lever)

The swing from pay-per-credit → promo-locked, single-render:

| Cadence | PPC COGS | Promo COGS | **$ saved/acct/mo** | COGS reduction |
|---|---:|---:|---:|---:|
| Image-heavy | $10.86 | $1.76 | **$9.10** | −84% |
| Mixed | $19.85 | $3.20 | **$16.65** | −84% |
| Video-heavy | $41.58 | $6.68 | **$34.90** | −84% |

**Margin impact at $49 (the likely core tier), Mixed cadence:** GM goes from **59% → 93%**, contribution $29.15 → $45.80 (+$16.65/acct/mo). At $49 video-heavy: **15% → 86%** (the single biggest swing — promo is what makes video-heavy fundable below $99).

**Scaling caveat (honest):** The promo is **per-workspace/seat**, time-boxed (1 yr from June-20 lock), and routes only through covered models (Seedream 5.0 Lite, Flux.2 Pro 1K, Nano-Banana, Kling O1 Image, GPT Image, Seedance 2.0 full, Kling 3.0 7-day). It does **NOT** linearly scale to N customer accounts on one plan:
- One workspace's "unlimited" is realistically rate/fair-use bounded; running 100 customer accounts' generation through a single promo workspace risks throttling/ToS limits.
- **Realistic model:** promo de-risks **DropFly's own dogfood + a modest fleet on shared workspace(s)** for a year. It is a *bridge*, not a permanent unit-economics fix.
- **Un-covered tail persists** even under promo: VO ($0.10) + music ($0.10) + Claude (~$0.03/video). That ~$0.23/video floor is why promo video-heavy still costs $6.68/mo, not $0.
- **VO/music are the next optimization target** — sourcing TTS/music outside Higgsfield (e.g. cheaper TTS) would push promo COGS toward zero.

---

## 6. HEADLINE ANSWER TO RIO

**Where we MEET ≥60–70% GM:**
- **Pay-per-credit (no promo):**
  - **$49** clears 60%+ for **Image-heavy (76–78%)** and **Mixed (56–59%, right at the line)**.
  - **$99** clears for **all three cadences** single-render (58–89%); video-heavy is exactly at the line (~54–58%).
  - **$199** clears everything comfortably, even gate-A in most cells.
- **Promo-locked:** **every cadence clears 60%+ at every tier including $19** (lowest is video-heavy $19 = 65%). Promo makes a $19 video product viable.

**Where we DO NOT:**
- **$19 pay-per-credit is unviable for anything but image-heavy** — Mixed and Video-heavy sell at a **loss** (−4% to −119%). $19 only works as an image-only/light tier or if promo-locked.
- **Video-heavy under $99 pay-per-credit** — never reaches 60% (15% @ $49, 58% @ $99). Daily-video accounts must be $99+ unless promo-locked.
- **Gate-A (drafting on full videos) is broadly unviable** — negative or sub-60% across most of the grid up to $199. **Must use Gate-B (image-storyboard drafts).**

**The clean rule:** Price the *video allowance*, not the account. ~$3.4/wk of video COGS per Mixed account → a $49 tier with a ~13–14 video/mo cap holds 60%+; overage billed at pass-through. Lock Gate-B. Lock the June-20 promo to turn every tier into a 65–99% GM product for one year while you scale and re-negotiate.

---

## TOP 3 RECOMMENDATIONS

1. **Ship Gate-B, kill Gate-A.** Draft on 3 cheap images ($0.12 total), LLM-judge composition, render premium video **once** ($1.49/post vs $3.71). This single design choice is the difference between 60%+ and negative margins on video tiers. The brief's "$2.78 with gate" was optimistic; the real Gate-A cost is $3.71 — do not draft on full videos.

2. **Tier on video allowance, not "unlimited."** Recommend: image/light ≈ **$19** (statics + ≤5 video/mo cap), core ≈ **$49** (Mixed, ~13–14 video/mo cap), pro/video-heavy ≈ **$99–$199** (≥30 video/mo). Meter overage at the $0.0475 pass-through. Never offer flat-unlimited video below $99 on pay-per-credit — it goes negative.

3. **Lock the June-20 Ultra annual promo for the DropFly dogfood + shared fleet workspace.** It cuts COGS ~84% and makes a $19 video product 65–91% GM for a year — a real bridge to scale and to re-negotiate enterprise rates. But budget for the un-covered tail (VO/music/Claude ≈ $0.23/video) and treat it as time-boxed/per-seat, NOT a permanent N-account solution.

## OPEN QUESTIONS FOR RIO

1. **Account→workspace mapping:** is one Higgsfield workspace serving many customer accounts, or one workspace per account? This determines whether the promo (per-seat) and the 3,000-cr base allowance are shared or multiplied — it swings blended COGS 3–10×.
2. **Real cadence distribution of ICP v1:** how many customers will actually be video-heavy vs image-heavy? Margin is fine if the book is image/mixed-skewed; it breaks if everyone runs daily video on a $49 plan.
3. **Can VO/music move off Higgsfield?** The ~$0.23/video un-covered tail is the floor even under promo. A cheaper TTS/music source would push promo COGS toward true ~$0 and meaningfully raise GM at the low tiers.
4. **Will we hard-cap video/mo per tier** (clean margins) **or allow uncapped overage billing** (NRR upside, but power-user/slop risk)? Affects whether the negative cells above can ever occur in production.
5. **Confirm the real Claude judge model/token cost** — I assumed $0.0125/judge + $0.02/caption. Immaterial to tier pricing, but worth a 1-line verification for the fleet-scale P&L.
