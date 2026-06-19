# SocialFly — Funnel Diagnosis & 30-Day Revenue Growth Plan

**Author:** growth_brain (DropFly x1000 engine)
**Date:** 2026-06-19
**Product:** https://socialfly.io (live, freemium AI social-media autopilot)
**Scope:** Revenue-growth diagnosis + plan. Analysis only — no media generation.
**Locked thesis:** "An always-on brand operator." Moat = closed-loop creative-performance data, not generation.

> Companion docs: `02-positioning-landing.md` (marketing_brain), `03-seo-geo.md` (seo_brain).
> This doc owns the **full funnel + the revenue bottleneck**, and it overrules the optimistic
> framing in those docs on one point: **the product is not conversion-ready today.** See §2.

---

## 0. TL;DR

I grounded this in the live site and the repo, not theory. The honest verdict:

**The funnel is not leaking — it's amputated.** Two structural cuts make paid revenue
literally impossible to capture right now, regardless of traffic:

1. **No payment path is live.** `STRIPE_PRICE_ID_*` env vars are **absent** from `.env.local`,
   and Stripe keys are `sk_test` / `pk_test` (test mode). `/api/billing/checkout` calls
   `isValidPriceId(priceId)` — with no price IDs configured, every upgrade attempt 400s.
   **A free user who wants to pay you cannot.**
2. **No platform can actually be connected.** Every OAuth credential in `.env.local` is a
   placeholder (`META_APP_ID=your_m...`, `TIKTOK_CLIENT_KEY=your_t...`, etc.). The "always-on
   operator" core promise — it posts for you — **cannot be delivered to a real user.**

On top of that: **zero product analytics** (a `grep` for posthog/mixpanel/amplitude/segment/
plausible/gtag returns only false positives). You are flying completely blind on the funnel —
you cannot see where users drop, so you cannot optimize.

**The #1 bottleneck is therefore not acquisition. It's that the product cannot convert a
motivated buyer even if one shows up.** Week 1 is about making the funnel *exist* (wire payments,
wire 1 platform, wire analytics). Only then does driving traffic make sense.

---

## 1. The funnel — mapped to actual code

Every stage below maps to a real file. This is what a real visitor/new user experiences.

### Stage A — Acquisition (top of funnel)
- **Where:** `src/app/page.tsx` (landing), `src/app/pricing/page.tsx`.
- **State:** Landing is clean but generic (5/10 per `02`). SEO/GEO-invisible: no blog, no
  sitemap, no structured data (per `03`). No paid ads, no audience (solo operator).
- **Verdict:** There is effectively **no acquisition engine** today. Traffic ≈ direct/word-of-mouth.

### Stage B — Signup
- **Where:** `src/app/auth/signup/page.tsx`.
- **Flow:** Full name + email + password → Supabase `signUp` → **email-confirmation gate**
  (`if (data.user && !data.session) → "Check your email"`).
- **Friction found:**
  - **Email-confirmation wall** before any product value. Every confirmation step costs
    20–40% of signups industry-wide. No Google/OAuth social login — password only.
  - Asks for password (6-char min) before showing a single moment of value.
- **Verdict:** Higher friction than necessary for a no-audience product that needs every signup.

### Stage C — Activation / first value
- **Where:** dashboard `src/app/(app)/dashboard/page.tsx` → onboarding checklist
  `src/app/api/onboarding/route.ts` → brand setup `src/app/(app)/brand/setup/page.tsx`.
- **Flow:** Dashboard shows a single primary action that adapts to state
  (set up brand → connect platform → create content) + a 6-step onboarding checklist
  (brand, platform, media, first post, automation, analytics).
- **The genuine "aha":** `brand/setup` → enter URL → `/api/brand/analyze` returns voice,
  audience, visual style in ~30s. **This is the one delightful, differentiated moment in the
  whole product** and it works without any external OAuth. Protect it.
- **The activation cliff:** The checklist's steps 2–6 (connect platform → first post →
  automation → analytics) **all depend on a working OAuth platform connection, which is not
  wired** (placeholder creds). So a new user hits the "aha" at the brand scan, then slams into
  a wall the moment they try to do the thing they signed up for. Activation **dead-ends at ~step 1 of 6.**
- **Verdict:** First value (brand scan) is strong. **Full activation (a post actually going
  live) is currently impossible.** This is the retention-and-revenue killer.

### Stage D — Free → Paid conversion
- **Where:** paywall logic `src/lib/tier-gates.ts`, `src/lib/credits.ts`; checkout
  `src/app/api/billing/checkout/route.ts`; UI CTAs in `src/app/(app)/settings/page.tsx` +
  `src/app/pricing/page.tsx`.
- **What's built:** Credit metering (caption 1 / image 5 / video 25–50 / publish free), tier
  gates (video_generation, autopilot, advanced_analytics gated to Pro+; content_calendar to
  Creator+), Stripe checkout with a **14-day trial** baked in, webhook handler at
  `/api/webhooks/stripe`.
- **What's broken:**
  - **No live price IDs → checkout 400s → 0% conversion is the structural ceiling.** (§0.1)
  - Test-mode Stripe keys → no real charge even if prices existed.
  - **No in-product upgrade triggers at the moment of need.** Upgrade lives passively on
    `/pricing` and `/settings`. The natural upsell moments — hitting the 50-credit wall, hitting
    the 2-platform cap, trying a gated feature (video/autopilot) — return `reason`/`upgradeRequired`
    from the tier-gate functions but there's no evidence those surface as a contextual
    "Upgrade to continue" CTA in the flow. The paywall *knows* why you're blocked and doesn't sell you.
- **Verdict:** Conversion machinery is ~70% built and **0% functional** for revenue.

### Stage E — Retention / expansion
- **Where:** automations `src/app/(app)/automations`, cron `src/app/api/cron/*`, growth engine
  `src/lib/growth-engine.ts`.
- **State:** The retention thesis is sound — automations + cron mean the product does work while
  the user is away, which is the whole "always-on operator" stickiness loop. **But it can't run
  without connected platforms.** Expansion (more brands/platforms/credits) is gated correctly but
  unreachable because of §0.1.
- **Verdict:** Strong design, zero current realized retention because the loop can't close.

### Funnel at a glance

| Stage | Built? | Functional today? | Bottleneck |
|---|---|---|---|
| Acquisition | Partial | Weak | No engine, no audience, SEO-invisible |
| Signup | Yes | Yes (high friction) | Email wall, no social login |
| Activation (brand scan) | Yes | **Yes — strong** | — |
| Activation (post goes live) | Yes | **NO** | OAuth placeholders |
| Free→Paid | ~70% | **NO (0%)** | No price IDs, test keys, no contextual upsell |
| Retention/Expansion | Yes | **NO** | Depends on platform connect |

---

## 2. The single biggest revenue bottleneck (honest + specific)

**The product is not conversion-ready, and the binding constraint is that the core value loop
cannot complete.** Concretely, in priority order:

> **#1 — There is no live, working path from "free user" to "posted content" to "paid plan."**

This is one connected failure, not three separate bugs:
- A user can sign up and get a brand profile (good).
- They **cannot connect a platform** (OAuth = placeholder creds) → they never experience the
  product's actual job → no reason to stay → no reason to pay.
- Even the rare user who *wanted* to pay anyway **cannot** (no Stripe price IDs, test mode).
- And you **can't even measure any of this** (no analytics) to know how bad it is.

**Why this is THE bottleneck and not "marketing":** every dollar and hour spent driving traffic
right now pours into a bucket with no bottom. The conversion rate of a funnel that cannot accept
payment is mathematically 0%. No headline rewrite, SEO play, or ad spend changes 0%. You must
make the funnel *capable of converting* before optimizing what flows into it.

**The adversarial truth for a no-audience solo operator:** the `02` and `03` docs (positioning,
SEO) are correct that the *top* of the funnel is weak — but fixing the top while the bottom is
amputated is premature optimization. Sequence is: **make it work → make it convert → then make it
get found.**

---

## 3. North-star metric + input metrics

**North-star:** **Weekly Paying-Active Brands** — the count of distinct brands on a paid plan
(trial-converted or beyond) that had ≥1 piece of content published in the last 7 days.

Why this one: it fuses the three things that actually equal revenue for an "always-on operator" —
(a) money is changing hands, (b) the product is delivering its core job (publishing), (c) it's
*recurring* (weekly active, not a one-time post). A vanity "signups" or "MRR" number would let you
celebrate a dead funnel; this one can't be faked while the loop is broken.

**Three input metrics that move it:**

1. **Activation rate = % of signups that publish their 1st post within 48h.**
   This is the make-or-break leading indicator. Today it is structurally **0%** (no OAuth).
   Target after Week-1 fixes: get *any* nonzero number, then push toward 25–40%.
2. **Free→Trial start rate = % of activated free users who start a paid trial.**
   Driven by contextual upgrade prompts at the credit/platform/feature walls. Today: 0% (no checkout).
3. **Trial→Paid conversion = % of 14-day trials that convert to a charge.**
   Driven by whether the product actually ran on autopilot during the trial (retention loop §E).

If activation is 0, nothing downstream matters — which is exactly why Week 1 attacks activation first.

---

## 4. The 30-day plan (week by week)

Constraints respected: lean solo operator, no audience, cheap/organic first, no media generation.
The spine is **"make it work → make it convert → then drive cheap organic traffic → then optimize."**

### Week 1 — Make the funnel physically exist (UNBLOCK)
Goal: a brand-new user can sign up → scan brand → **connect one real platform → publish one post**,
and a free user **can pay you.** Plus: you can finally *see* the funnel.
- **Wire ONE platform end-to-end** (recommend **LinkedIn** or **Facebook/Instagram via Meta** — pick
  the one whose OAuth app you can approve fastest; LinkedIn is usually the least gated for a solo dev).
  Real `CLIENT_ID/SECRET`, callback, token storage. Mark the rest `comingSoon` honestly.
- **Wire Stripe for real revenue:** create the 3 products/prices in Stripe, set
  `STRIPE_PRICE_ID_CREATOR/PRO/AGENCY` (+ `_YEARLY`), flip to live keys, verify the webhook updates
  `subscription_tier`. Test one real $19 charge end-to-end and refund it.
- **Install product analytics** (PostHog free tier — generous, ideal for solo). Instrument the 6
  funnel events: `signup`, `brand_analyzed`, `platform_connected`, `post_published`,
  `upgrade_clicked`, `trial_started`. **Without this, Weeks 2–4 are guesswork.**
- **Dogfood:** connect DropFly's / SocialFly's own brand to its real social accounts and let it run.
  This is Phase-1's whole point — be customer #1.

### Week 2 — Make it convert (in-product monetization)
Goal: motivated users hit a *sell*, not a dead end.
- **Add contextual upgrade prompts at the three natural walls** (the tier-gate functions already
  return `reason` + `upgradeRequired` — surface them): out of credits, platform cap hit, gated
  feature attempted (video/autopilot). Each → one-click to checkout with the right price preselected.
- **Lower signup friction:** add Google OAuth login; consider making email-confirmation
  non-blocking (let them into the brand-scan "aha" first, confirm async).
- **Reorder onboarding so "connect platform + publish" is the hero step** (the activating action),
  not buried at step 2–4. Move the brand-scan win → immediately into "now connect & post."
- **Add a "publish your first post" nudge** (email + in-app) for users stuck post-brand-scan.

### Week 3 — Cheap/organic acquisition (now that the bucket holds water)
Goal: first non-founder signups, $0 ad spend.
- **Build-in-public + dogfood proof:** post SocialFly's *own* autopilot results publicly (it's
  literally running your socials now). This is the case study and the acquisition channel at once.
- **Founder-led organic:** answer "AI social scheduler / autopilot" questions in 3–5 communities
  (r/socialmedia, Indie Hackers, relevant Discords/X). Link the brand-scan demo, not a generic pitch.
- **Ship the highest-leverage SEO quick-wins from `03`:** sitemap, robots, one comparison/landing
  page targeting a real query. Cheap, compounding.
- **Cold-start the moat:** the brand-scan is shareable — let users share their generated brand
  profile (light virality, zero cost).

### Week 4 — Measure, optimize, decide
Goal: turn the now-visible funnel into a learning loop.
- **Read the PostHog funnel.** Find the biggest real drop (now that data exists) and fix that one thing.
- **Optimize the worst converting step** of {signup → brand → connect → publish → upgrade}.
- **Tighten the trial:** make sure trials experience autopilot actually *running* (retention §E) —
  a trial where nothing posts will never convert. Add a day-10 "your trial ends in 4 days, here's
  what we published for you" email showing real output.
- **Decide pricing reality:** with ≥a handful of real trials, confirm whether the $19 Creator wall
  (only 2 platforms, no calendar) is too thin to convert; consider moving the autopilot gate down a tier.

---

## 5. Week-1 concrete actions (ship in the next 7 days)

Ordered by leverage. Items 1–3 are non-negotiable; the funnel does not exist without them.

1. **Wire Stripe live + price IDs.** Create products/prices, set `STRIPE_PRICE_ID_*` (and `_YEARLY`)
   in env, swap to live keys, verify `/api/webhooks/stripe` flips `subscription_tier`. Run one real
   charge + refund. *(Without this, conversion = 0% structurally.)*
2. **Wire ONE real platform OAuth end-to-end** (LinkedIn or Meta). Replace placeholder creds, test:
   connect → schedule → **post actually appears on the live network.** *(Without this, activation = 0%.)*
3. **Install PostHog** and fire 6 events: `signup`, `brand_analyzed`, `platform_connected`,
   `post_published`, `upgrade_clicked`, `trial_started`. *(Without this, you optimize blind.)*
4. **Self-test the whole funnel as a stranger:** new email → sign up → scan a brand → connect the
   live platform → publish → hit a credit/feature wall → upgrade → confirm the charge + tier change.
   Write down every point of friction. This dry-run *is* your first funnel dataset.
5. **Dogfood:** point SocialFly at its own brand + real socials and let autopilot run for the week.
   You become customer #1 and generate the build-in-public proof for Week 3.

---

## 6. Honest flags — what I could not verify / what still blocks growth

- **Could not verify checkout actually succeeds end-to-end** — I can confirm from code+env that
  price IDs are missing and keys are test-mode, which is sufficient to conclude conversion is
  currently impossible, but I did not run a live transaction.
- **Could not verify OAuth is truly non-functional in *production*** — env in the repo is
  placeholder; it's *possible* (but unlikely, given the placeholders) that Vercel prod env has real
  creds. **Verify this first thing** — if prod OAuth *is* live, activation jumps the queue and the
  bottleneck reorders, but the Stripe gap remains.
- **No analytics = no historical funnel data exists.** All drop-off rates above are inferred from
  structure, not measured. The very first deliverable of Week 1 (PostHog) is what converts this doc
  from diagnosis into a measurable loop.
- **The `/api/brand/analyze` quality** (does the scan actually produce *good*, on-brand profiles?)
  was not load-tested here; it's the one differentiated asset, so its quality is worth a separate audit.
- **Strategic flag:** even fully unblocked, a no-audience solo operator's binding constraint becomes
  acquisition (Week 3+). The realistic early-revenue path is **founder-led + build-in-public +
  dogfood proof**, not ads. Set expectations: first paid customers in weeks, not days, and likely
  from the founder's own network and communities — not organic search (which is a 3–9 month game per `03`).
