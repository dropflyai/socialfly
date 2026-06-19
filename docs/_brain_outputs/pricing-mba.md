# MBA BRAIN — SocialFly Pricing/Margin Verdict (real Higgsfield costs)

**Date:** 2026-06-18 · **Brain:** MBA / strategy verdict · **Supersedes:** the unit-economics section of `mba-rd.md` (which assumed $0.033/cr — now wrong by ~45%)

> Verification key: **[V]** = verified this session against a cited source or the live finance model · **[A]** = assumed / my analysis. Cost anchors are from `pricing-finance.md` + the brief's verified ledger ($0.0475/cr planning rate). Strategic/buyer framing carries over from `mba-rd.md` and is unchanged by the cost update.

---

## 1. MARGIN VERDICT — does it still clear ≥60–70% blended GM + NRR ≥110%?

### What changed vs the earlier conclusion
The prior model said "flat unlimited is insolvent, use hybrid sub + credit pass-through, target 60–70% GM." That conclusion **survives and gets stronger** — the direction was right, but the cushion is thinner than the $0.033/cr math implied. Real marginal cost is **$0.0475/cr (~45% higher)**, so every video-bearing tier is closer to the margin line than the old model showed. The earlier headline COGS for a daily-video poster ($62 mid / $136 premium) was actually *pessimistic on multiplier, optimistic on price*: with the **Gate-B "draft-cheap-render-premium-once" design**, a video-heavy account is ~$41–45/mo pay-per-credit, not $136. So the cost discipline the prior model demanded (don't draft on premium video) is what saves the economics — and it now matters more, not less.

### The honest verdict (pay-per-credit, no promo)

| Question | Answer |
|---|---|
| Does an **image/light** account clear 60–70% GM? | **Yes** at $49 (76–78%). Easily fundable. |
| Does a **mixed** (3 vid + 4 img/wk) account clear it? | **Only at $49+ and only barely** (56–59% — at/just-below the 60% line single-render). Clean at $99 (80%). |
| Does a **video-heavy** (daily video) account clear it? | **No below $99.** It sells at a **loss at $19 (−119%)**, 15% at $49, ~58% at $99. Daily-video must be a $99+ product. |
| Is **flat "unlimited video"** viable at $19–49? | **No.** Confirms the prior verdict — flat-unlimited video is structurally insolvent on pay-per-credit. |
| Gate-A (drafting on full videos)? | **Dead.** Negative-to-sub-60% across nearly the whole grid. Must ship Gate-B. |

**Blended-GM call (the number that matters for fundability):** Blended GM clears the **60–70% bar IF AND ONLY IF (a) Gate-B is shipped, (b) video is metered/capped per tier (not flat-unlimited), and (c) the book is image/mixed-skewed, not video-heavy-skewed.** It does **not** clear the bar if you sell a flat $19–49 plan to daily-video users on pay-per-credit — that book is a reseller at <50% GM, which earns a reseller multiple (1–2× rev), not a SaaS/strategic one. **So: economics did NOT materially worsen the strategy — they tightened the execution constraints.** The 45% cost increase converts "you should use Gate-B and meter video" from a recommendation into a **non-negotiable margin requirement.**

### NRR ≥110%
Unchanged and achievable — the credit-overage/video-allowance line is the natural NRR engine (customers add accounts/brands and buy more video over time). **Caveat the cost update introduces:** with higher marginal cost, NRR-from-overage is only *accretive* if overage is billed at true pass-through ($0.0475 + markup), not absorbed. If you cap-and-absorb, you get NRR from seats/accounts only. **Recommendation: bill video overage at pass-through (≥1.5× cost) so NRR growth is margin-positive, not margin-dilutive.**

**Verdict: Fundable/acquirable margin shape is still reachable, but the real costs leave NO room for sloppy execution.** The earlier "comfortable hybrid" is now a "disciplined hybrid." Gate-B + metered video + image/mixed ICP skew = 60–70%+ blended GM. Anything else = reseller economics.

---

## 2. JUNE-20 PROMO GO / NO-GO — and the decisive workspace question

### The COGS swing (verified, large)
Promo-locked collapses covered-model marginal cost to ~$0, cutting per-account COGS **~84%** for a year (finance §5): image-heavy $10.86→$1.76, mixed $19.85→$3.20, video-heavy $41.58→$6.68. At $49/mixed, GM goes **59%→93%**; at $49/video-heavy, **15%→86%**. It is the single biggest margin lever available and it makes a **$19 video product viable (65–91% GM)** for one year. On COGS alone it's an obvious yes.

### The decisive caveat: does ONE Ultra plan cover N customer accounts? — **NO. [V]**
This is the question the brief flagged as swinging blended COGS 3–10×, and I researched it to a hard answer:

- **The Ultra/Team plan is a *shared internal workspace*, not a multi-tenant container.** [V] It is 2–15 *members* sharing one credit pool (1,500 cr/seat), explicitly built to "mirror your organization's structure" with role-based admin controls. It is an **internal-team** construct, not a customer-account construct.
- **"Unlimited" is gated by concurrency + fair-use, not truly uncapped.** [V] Ultra allows ~8 parallel videos / 8 parallel images at the account level, and access "depends on plan, model badge, resolution, queue availability, concurrency limits, and fair-use rules." Routing 50–100 customer accounts' generation through one workspace **will hit concurrency/fair-use throttling** — the "unlimited" does not scale linearly to N tenants.
- **The Higgsfield ToS explicitly PROHIBITS the multi-account scaling we'd want. [V]** Section 1.2 limits use to "your own personal or internal business purposes"; §5.2 forbids "license, sell, rent, lease, transfer…or otherwise commercially exploit the Service"; §2.3 prohibits account/password sharing and >1 account. **Using one Ultra account to serve external SocialFly customers is a direct ToS violation** (resale + multi-tenant + sharing). This is not a gray area.

**Conclusion on scaling:** The promo does **NOT** give us cheap COGS across a paying customer base on one plan. One Ultra plan = one internal workspace for DropFly's own use. To serve N paying customers compliantly you need either (a) a plan **per customer workspace** (COGS scales linearly with customers — the promo's per-seat economics still help, but you pay per workspace), or (b) **Higgsfield's API/Creator tier or an enterprise/reseller agreement** (the only sanctioned multi-tenant path). The brief's "3–10× COGS swing" risk is real and resolves **against** the one-plan-covers-everyone fantasy.

### Lock-in / dependency risk
Locking a 365-day annual deepens the single-supplier dependency (Killer #2 from mba-rd). But it's a **time-boxed, one-year** commitment at a steep discount, and the multi-provider router still exists as fallback — so it's a bounded bet, not a permanent lock. The real risk isn't the annual term; it's **building the product to *assume* near-zero COGS and then hitting the expiry cliff** (see premortem).

### RECOMMENDATION — GO, scoped tightly (dogfood ≠ scaling)

**LOCK the June-20 Ultra annual — but ONLY as a dogfood/internal-fleet bridge, NOT as the customer-serving cost model.**

| Use case | Verdict | Why |
|---|---|---|
| **Customer #0 = DropFly dogfood, 1 workspace** | **GO — lock it.** | This is exactly "personal/internal business" use. ToS-clean, 84% COGS cut, de-risks our own posting for a year. No downside. |
| **Scaling to paying customers on the SAME plan** | **NO-GO.** | ToS violation (resale/multi-tenant), plus concurrency/fair-use throttling. Do not architect the pricing model on this. |
| **Scaling compliantly** | Plan-per-workspace OR Higgsfield API/enterprise/reseller deal. | COGS then scales ~linearly with customers; model the business on **pay-per-credit ($0.0475) economics**, treating promo only as internal upside. |

**Conditions on the lock:** (1) Confirm covered-model list + 1-year term in writing at purchase. (2) Use it for DropFly's own accounts only. (3) **Do NOT price customer tiers on promo COGS** — price on pay-per-credit so the business is solvent the day the promo expires and the day customer #2 arrives on a separate plan. (4) Open the Higgsfield partnership/reseller/API conversation now (this also warms the most-likely acquirer — see mba-rd buyer map).

---

## 3. LTV:CAC — does it support the acquirable-dataset thesis?

**At the pricing that holds margin** (image/light $19, core $49, pro/video-heavy $99–199, Gate-B, metered video), contribution margin per account:

| Tier | Price | ~COGS (PPC, Gate-B) | Contribution/mo | Annual contribution |
|---|---|---|---|---|
| Light/image | $19 | $1.83 | ~$17 (90% GM) | ~$205 |
| Core/mixed | $49 | $21.41 | ~$28 (56% GM) | ~$330 |
| Pro/video | $99 | $45.18 | ~$54 (54% GM) | ~$650 |

**LTV [A]:** At SMB churn ~3–4%/mo (mba-rd target) → ~24–33 mo lifetime. Core-tier LTV ≈ $28 × ~28 mo ≈ **~$780 contribution LTV** (gross-margin LTV, the number that should drive CAC, not revenue LTV). Pro-tier ≈ **~$1,500**.

**CAC [A]:** For a product-led SMB/creator motion (self-serve + light content marketing, no enterprise sales), blended CAC in this category runs **$80–250**. At core-tier $780 LTV that's **LTV:CAC ≈ 3–10×** — comfortably above the 3× fundability floor, *provided* churn stays at target and the book isn't video-heavy-skewed.

**Tie to the dataset thesis + staged scope:** LTV:CAC ≥3× is necessary but NOT sufficient for the *acquirable* (vs merely *fundable*) outcome. The acquisition premium (mba-rd Asset #1) comes from **retained, connected accounts generating labeled performance data over time** — which is precisely what a healthy LTV (long lifetime) produces. So the staged scope is right: **stage 1 (dogfood, promo-locked) proves the loop cheaply; stage 2 (creator vs SMB paid, pay-per-credit pricing) must hold ≥3× LTV:CAC AND ≥60% blended GM simultaneously** — if you can only hit one, you have a revenue business (PE multiple), not a strategic-data business (acquirer multiple). The cost update doesn't break LTV:CAC; it raises the bar for *which customers you can afford to acquire* — **do not pay $200 CAC to acquire a video-heavy user onto a $49 plan; that LTV is negative.**

---

## 4. PREMORTEM — where pricing/margins break (ranked killers)

**KILLER #1 — Over-generation / slop / cost runaway. HIGHEST probability, and already happening. [V]**
This very session burned **~1,300 credits ≈ $62** in *unsanctioned* subagent generation — a live, real-money example of the exact failure mode. If an agent (or a customer's autopilot) over-generates, retries, or drafts on premium models, COGS explodes with no revenue attached. At $0.0475/cr this is 45% more dangerous than the old model assumed. **Mitigations (must-ship):** (a) Gate-B only — draft on cheap images, render premium video once; (b) hard per-account/per-day credit budgets enforced in code, not policy; (c) kill-switch on agent generation loops; (d) draft-tier model defaults, premium only on the gated/approved winner; (e) treat *internal/agent* generation with the same budget caps as customer generation (this session proves internal runaway is the near-term threat).

**KILLER #2 — Promo expiry cliff. HIGH.**
If the product is built and priced assuming ~$0 covered-model COGS, then on day 366 (or on customer #2 needing a separate plan) COGS jumps ~6×. A $19 video product that was 65% GM under promo becomes **−119% GM** on pay-per-credit. **Mitigation:** price every customer tier on pay-per-credit economics *from day one*; treat promo savings as a one-year internal-margin bonus, never as the cost basis for customer pricing. Diarize the renewal/expiry and the renegotiation 60 days out.

**KILLER #3 — Multi-account scaling collides with Higgsfield ToS. HIGH (now verified). [V]**
The instinct to run all customers through one cheap Ultra plan is a ToS violation (resale/multi-tenant) AND throttled by concurrency/fair-use. If we scale this way we risk account termination (taking the whole customer fleet down at once) plus the dependency-concentration of Killer #2. **Mitigation:** plan-per-workspace or a sanctioned API/enterprise/reseller agreement with Higgsfield before scaling past dogfood; model COGS at pay-per-credit; never single-account-multi-tenant.

**KILLER #4 — Video power-users on a flat/low tier. MEDIUM-HIGH.**
A daily-video user on a $49 flat plan is −119% to 15% GM. A handful of these can erase the margin from dozens of image-heavy accounts. **Mitigation:** hard video caps per tier (≤5/mo on $19, ~13–14 on $49, ≥30 on $99+), overage billed at pass-through, auto-upgrade prompts. Never offer flat-unlimited video below $99.

**KILLER #5 — Higgsfield price changes. MEDIUM, exogenous.**
We are downstream of one vendor's credit price; a hike flows straight to GM (the whole reason the $0.033→$0.0475 update mattered). **Mitigation:** the multi-provider router as live fallback; pass-through pricing so hikes pass to customers; own the data/account/brand layer so an engine swap doesn't kill the asset (mba-rd Killer #2 mitigation, unchanged).

**Ranking:** #1 slop/runaway (live, internal, immediate) > #2 promo cliff (self-inflicted if mispriced) ≈ #3 ToS multi-tenant (verified hard limit) > #4 video power-users (capped away) > #5 vendor price (hedged by router + pass-through).

---

## VERIFIED vs ASSUMED

**VERIFIED [V]:** $0.0475/cr planning cost and the full COGS/GM/break-even matrix (finance model, this session). Ultra = shared 2–15-member internal workspace, ~1,500 cr/seat, ~8 parallel video/image, "unlimited" gated by concurrency + fair-use. Higgsfield ToS prohibits account sharing, >1 account, resale/sublicense, and multi-tenant/external-customer use (§§1.2, 2.3, 5.2). This session burned ~1,300 cr ≈ $62 in unsanctioned generation.

**ASSUMED [A]:** Churn 3–4%/mo → 24–33-mo lifetime; CAC $80–250 (category PLG pattern, not sourced to SocialFly data); LTV:CAC 3–10×; Claude judge/caption cost (~$0.03/video, immaterial per finance §4); cadence mix of the future book. Treat all LTV:CAC figures as model inputs, not facts.

---

## TOP 3 RECOMMENDATIONS

1. **GO on the June-20 Ultra annual — but ONLY as a dogfood/internal bridge, and price customers on pay-per-credit anyway.** It cuts internal COGS ~84% for a year (real, large). But it is ToS-locked to internal use and concurrency-throttled, so it CANNOT be the cost basis for a paying customer fleet. Lock it for customer #0; build the business model on $0.0475/cr economics so you're solvent at expiry and at customer #2.

2. **Make Gate-B + per-tier video caps + pass-through overage non-negotiable.** The 45% cost increase removed the margin cushion: 60–70% blended GM is reachable ONLY with draft-cheap/render-premium-once, metered video (never flat-unlimited below $99), and overage billed at ≥1.5× cost. This is the difference between SaaS economics (strategic multiple) and reseller economics (1–2× multiple).

3. **Treat cost-runaway as the #1 live risk and ship hard budget caps NOW.** This session's ~$62 unsanctioned burn is the premortem coming true in real time. Enforce per-account/per-day credit budgets and agent-generation kill-switches in code before any scaling — internal runaway, not customer behavior, is the immediate threat.

## OPEN QUESTIONS FOR RIO

1. **Compliant scaling path:** plan-per-customer-workspace, or do we open a Higgsfield API/enterprise/reseller agreement? This is the gating decision for unit economics past dogfood — and it warms the most-likely acquirer. (The one-plan-covers-all option is OFF the table — ToS-prohibited and verified.)
2. **ICP cadence mix:** will the paying book skew image/mixed (margins fine) or video-heavy (needs $99+)? Margin viability hinges on this — confirm before pricing the core tier at $49.
3. **Will we hard-cap video/mo per tier (clean margins, capped NRR) or allow uncapped pass-through overage (NRR upside, slop risk)?** Given Killer #1 is live, my lean is caps + explicit upgrade, not uncapped autopilot.
4. **Funded bet vs dogfood-that-sells (carried from mba-rd, still the #1 strategic question):** the acquirable-dataset thesis and the ≥3× LTV:CAC both require sustained investment in retention + the performance dataset. A part-time build yields the commodity-wrapper outcome regardless of how good the promo COGS look this year.
5. **Can VO/music move off Higgsfield?** The ~$0.23/video un-covered tail is the floor even under promo and the only thing keeping promo video-heavy at $6.68 instead of ~$0. Cheaper TTS/music would meaningfully raise low-tier GM.
