# SocialFly Pricing & Margin Model — CEO Synthesis (real Higgsfield costs)

**Date:** 2026-06-18 · Fan-out: finance + pricing + mba (analysis-only). Raw: `_brain_outputs/pricing-{finance,tiers,mba}.md`. Supersedes the assumed-cost economics in `mba-rd.md`.

## Answer to Rio's 3 questions
1. **Has pricing been updated?** NO — the engine (U0–U4) was built; pricing was untouched. But we now have a **validated, real-cost tier model ready to implement** (below).
2. **Do we meet margin expectations?** **At the right prices, yes (≥60–70% GM); at naive/flat pricing for video, no.** Real costs are ~45% higher than the prior model assumed, which removed all the cushion — margin now *requires* discipline (cheap-draft gate + per-tier video caps).
3. **Adjusted for real Higgsfield cost?** In the model, **yes now** — real **$0.0475/credit** (vs assumed $0.033), real per-asset costs from the live ledger.

## Real unit costs (VERIFIED this session)
- **$/credit:** $0.0475 (4,000-pack) → use as planning marginal cost. ~20 cr/$.
- **Per asset:** static image $0.12 · carousel $0.40 · **single video post $1.37** · **video w/ cheap-draft gate (Gate-B) $1.49** · video w/ full-video-draft gate (Gate-A) **$3.71 ← banned** · Claude caption+judge ~$0.03 (immaterial).
- **Monthly COGS / account (pay-per-credit):** image-heavy **$10.86** · mixed **$19.85** · video-heavy **$41.58**. Promo-locked: ~84% lower ($1.76 / $3.20 / $6.68).

## Margin map (finance)
- **$19 flat is insolvent** for mixed (−4%) and video-heavy (−119% GM).
- **Video-heavy needs $99+** to clear 60% on pay-per-credit.
- **≥60–70% GM lands at $49 (image/mixed) and $99 (all cadences)** without any promo.

## Recommended tiers (pricing — solvent by construction)
| Tier | Price/mo | Video cap/mo | Accounts | GM @ target |
|---|---|---|---|---|
| **Starter** | $29 | 6 | 1–2 | 63–68% |
| **Creator** | $59 | 20 | 3 | 63–68% |
| **Studio** | $129 | 55 | 6 | 63–68% |
| **Agency** | $299 | 160 | 15 | 63–68% |
- **The video sub-cap is the margin-binding lever** (not total "credits"). Present to users as "Posts + Video credits," never raw Higgsfield credits.
- **Overage = $1.49–1.99/video, default OFF**, priced above the next tier's per-video cost so upgrading is always rational. (Pricing brain caught that a $0.40–0.55 overage would resell video *below cost*.)
- Packaging = hybrid included-allowance + metered pass-through. Anti-abuse: hard video cap + Gate-B default + re-roll fair-use cap.
- **Market context:** SocialFly is the only product doing on-brand autopilot **+** native video gen — schedulers (Buffer/Later/Hootsuite) have no video; AI-video tools (HeyGen/Creatify/Arcads/Predis) have no autopilot. It replaces a ~$60–80/mo 3-tool stack → $29 wedge is strong.

## TWO decisive strategic findings (mba)
1. **🚧 The multi-tenant ToS wall (VERIFIED, load-bearing).** Higgsfield Ultra is a shared *internal* workspace; ToS §§1.2/2.3/5.2 **prohibit account sharing, multi-tenant use, and serving external customers.** → **One Higgsfield plan CANNOT run N customer accounts.** Customer economics MUST be built on **pay-per-credit ($0.0475)**, not the promo. Compliant scaling at volume needs a **Higgsfield API/enterprise/reseller agreement** — a real BD item, not a config flag. (This caps the "near-zero COGS" upside to our own use.)
2. **🔥 Cost-runaway is the #1 killer — and it's LIVE.** This session burned **~1,300 credits (~$62) in unsanctioned subagent generation.** That is exactly the failure mode that kills margin in production (a loop/abuse/over-generation). Mitigation is **mandatory hard in-code budget caps + kill-switches** (the `generation_jobs.hf_credits_spent` + per-tenant daily cap from the U2 schema must be enforced before any customer touches it).

## The June-20 promo — GO, but scoped
**Lock the Ultra annual before June 20 for DropFly's OWN dogfood (customer #0, single workspace — ToS-clean).** It cuts our internal content COGS ~84% for a year (great for the dogfood proving phase). **Do NOT price customers on promo economics** (it expires + doesn't scale + ToS). Treat it as an internal bridge, not the business model.

## Decisions for Rio
1. **Adopt the $29/$59/$129/$299 + video-cap tier structure?** (replaces "flat" thinking; implement in Stripe/credits later)
2. **Lock the June-20 Ultra annual for DropFly dogfood?** (time-sensitive — 2 days)
3. **Acknowledge customer scaling = pay-per-credit economics + open a Higgsfield API/enterprise/reseller conversation** for compliant multi-account at volume.
4. **Prioritize the in-code budget caps / kill-switch** (cost-runaway is the live #1 risk) before any external user.

## Honest caveats
Cadence mixes are ASSUMED; competitor prices VERIFIED+cited; the ~$0.23/video un-covered tail (VO+music+Claude) persists even promo-locked; LTV:CAC ~3–10× is directional. The acquirable-dataset thesis still requires *retained* accounts feeding `soul_memory` — don't buy video-heavy users onto cheap tiers (negative LTV).
