# SocialFly — Content & Dogfood Engine (Customer #0 Top-of-Funnel)

**Author:** content_brain (DropFly x1000 engine)
**Date:** 2026-06-19
**Product:** https://socialfly.io (live, freemium AI social autopilot)
**Scope:** Content strategy + dogfood/customer-#0 plan + Week-1 calendar + repeatable weekly engine.
**Constraint:** PLANNING ONLY — concepts + copy. No image/video/audio generation (zero credit spend).

> Companion docs: `01-funnel-growth-plan.md` (funnel/blockers), `02-positioning-landing.md`
> (ICP + messaging), `03-seo-geo.md` (organic), `02-PRICING-MODEL.md` (tiers).
> Grounded in: live socialfly.io, `docs/brand-dna-dropfly.md`, `src/lib/engine/virality-gate.ts`.
> **Locked thesis:** "An always-on brand operator." Moat = closed-loop creative-performance dataset, not generation.

---

## 0. TL;DR

The content engine's one job: **make SocialFly run SocialFly's own social presence in public, and turn every
post into both top-of-funnel content AND living proof the product works.** We don't market a generator
(commoditized, slop-fatigued category). We market an **operator you can watch operate** — on us, first.

Three things make this work and they're inseparable:
1. **The narrative is the product.** "We let our own tool run our brand for 30 days — here's every post,
   every metric, every piece of slop it caught before publish." Build-in-public IS the dogfood mandate.
2. **The proof loop is structural.** Each post carries a "made & scheduled by SocialFly" stamp. The content
   is the case study. The case study is the content. No separate marketing-content factory needed.
3. **Anti-slop is the credibility unlock.** 2026 = peak AI-slop fatigue. Our edge is the **virality/quality
   gate** (`src/lib/engine/virality-gate.ts`, LLM-judge, threshold 0.6) + **human approve-once**. We show the
   gate rejecting our own drafts — that's the most differentiating content we can possibly post.

**Honest constraint (from `01`):** platform-publishing is currently blocked — every OAuth credential in
`.env.local` is a placeholder, and no analytics exist. **Wiring ONE real platform is a Week-1 eng task.**
So this engine is designed in two modes:
- **Mode A (now, pre-OAuth):** "build-in-public" — we post *manually* from drafts SocialFly generates, and
  narrate the build itself ("here's the operator we're wiring up"). Still 100% honest, still on-brand.
- **Mode B (the moment OAuth is live):** flip autopilot on; the same calendar runs *through* the product,
  and the "made & scheduled by SocialFly" stamp becomes literally true, not aspirational. **Designed to
  switch on with zero replanning.**

---

## 1. Content / top-of-funnel strategy

### 1.1 Who we're talking to (from `02`)
**One-line ICP:** *the solo founder/operator who has to be the brand's "social media person" and hates it.*
Bootstrapped B2B founders, indie hackers, small-brand owners who must show up on LinkedIn/X but have no
time and no team. They live in build-in-public circles, they're articulate, and they evangelize. Secondary:
small agencies (1–10 person) who discover us through the founders we win.

### 1.2 What pulls them to socialfly.io (and converts)
The ICP doesn't want "30 AI images." They want their brand to **keep showing up, on-brand, while they build.**
So content sells the *outcome of an operator running*, not features. Every piece ladders to one CTA:
**"Paste your URL, watch it learn your brand — free, no card."** (The URL-scan is the aha moment per `01`;
the free plan IS the demo. Get them to paste fast.)

The conversion logic per piece:
- **Hook** = a specific founder pain or a specific proof moment (a real number, a real reject, a real save).
- **Body** = show, don't claim — the actual draft, the actual gate verdict, the actual hours saved.
- **CTA** = soft, single, always the URL-scan. Never "sign up for our SaaS." Always "see what it says about *your* brand."

### 1.3 Content pillars (5 — every post maps to exactly one)
1. **Dogfood Diary (build-in-public).** "Day N of SocialFly running its own socials." The flagship pillar.
   Weekly recap of what the operator drafted/scheduled/published, the metrics, the wins, the misses.
   *This is both proof and the case study competitors can't fake.*
2. **Anti-Slop / The Gate.** Show the virality+quality gate rejecting our own drafts; A/B a brand-learned
   post vs. a generic-AI post and show the engagement gap; "the human approve-once moment." *Owns the trust
   category burned buyers actually care about.*
3. **Operator POV (founder pain).** Relatable solo-founder takes: the 11pm "what do I post" panic, the
   3-tool stack we replaced, why consistency beats virality. Builds the "this person gets me" bond.
4. **Show-the-Output (proof).** A real source website → the on-brand post SocialFly produced from it. Brand
   teardowns of other founders' presence (lead magnet → soft intro). *Show-don't-claim, weaponized.*
5. **Teach / JTBD (compounding, SEO-aligned with `03`).** "How to make AI match your brand voice," "set-and-
   forget content system," cost/comparison angles. Feeds the blog + GEO citability.

**Mix per week (5 posts/wk supervised, per brand-dna `platform_policy`):** roughly 2× Dogfood Diary,
1× Anti-Slop, 1× Operator POV / Show-the-Output (alternate), 1× Teach. Pillar 1 always leads.

### 1.4 Platforms (where the ICP actually is)
Per `brand-dna-dropfly.md` platform_policy and the ICP:
- **Primary: LinkedIn + X/Twitter.** This is where bootstrapped B2B founders congregate, build in public, and
  evangelize. LinkedIn is also the recommended FIRST OAuth wiring in `01` (least-gated for a solo dev) — so the
  primary content platform and the first dogfood-publishing platform are the same. Deliberate.
- **Secondary: Instagram + TikTok.** Reels/Shorts of "the operator at work" (screen-recordings of the gate, the
  approve tap, the calendar filling itself). Repurpose, don't originate. Switch on once a second OAuth lands.
- **Owned: the blog/`/learn`** (per `03`) — long-form home for the Dogfood Diary recaps + JTBD pillars; the
  thing we want ChatGPT/Perplexity to cite. Every social post can point back to a canonical recap here.

---

## 2. The DOGFOOD plan — SocialFly as Customer #0

The mandate: **SocialFly runs DropFly's/SocialFly's OWN accounts.** This is simultaneously (a) top-of-funnel
content, (b) living proof the product works, and (c) the first rows of the closed-loop dataset that IS the moat.

### 2.1 The brand DNA we operate on
Already defined in `docs/brand-dna-dropfly.md` — voice (confident, builder, anti-hype, proof-over-promise),
visual (premium dark, luminous gradient on near-black, the anti-slop-by-craft aesthetic), pillars, and
`platform_policy` (primary LinkedIn+Twitter, 5x/week supervised, AI-disclosure where mandated). The dogfood
brand object is **already loadable into the engine's Brand DNA injection** — no new setup needed to start.

> Note: the dogfood account is **DropFly's brand operated *by* SocialFly**. "SocialFly grows itself" works at
> two levels — DropFly (the studio/parent) AND SocialFly (the product) are both customer #0. Lead the *social
> copy* with the SocialFly product story ("we let our tool run our own brand"); the DropFly studio DNA supplies
> the voice/visual. One operating account, two proof layers.

### 2.2 Cadence
- **5 posts/week, supervised** (brand-dna target) on the primary stack (LinkedIn + X), Mon–Fri.
- **+2 repurposed/week** to IG/TikTok once a second platform is wired (Mode B).
- **1 long-form recap/week** on the blog (the Dogfood Diary roll-up — the citable asset).

### 2.3 The "made & scheduled by SocialFly" proof loop
This is the mechanic that makes dogfood content *prove* the product:
1. **Stamp every post.** A consistent, light sign-off line — e.g. *"↳ drafted + scheduled by SocialFly. I
   tapped approve."* (Mode A: honest because we genuinely drafted it in-product. Mode B: literally
   auto-published.) The stamp turns a normal post into a demo.
2. **Show the seams weekly.** Once a week, pull back the curtain: the calendar view filling itself, the gate's
   verdict on a draft, the approve-once tap, the week's metrics. *The behind-the-scenes IS the content.*
3. **Publish the number.** Each Friday recap states real, only-real stats: posts shipped, hours saved, drafts
   the gate rejected, best-performing post + why. These become the homepage proof strip (`02` §3) and the
   GEO-citable "quotable facts" (`03`). **Never invent a number** — if OAuth isn't live yet, the honest number
   is "drafts produced + scheduled," not "auto-published reach."
4. **Close the loop publicly.** "Here's what the operator learned this week and changed for next week" — this
   narrates the closed-loop dataset moat as ongoing content. The moat compounds while we market.

### 2.4 Anti-AI-slop guardrails (non-negotiable, and they're a feature)
This is the credibility spine and it's already partly built in code:
- **Virality / quality gate** (`src/lib/engine/virality-gate.ts`): LLM-judge scores each draft against brand
  DNA; default threshold **0.6**; fail-soft (a broken gate never blocks, but it does flag). Drafts below
  threshold don't ship without a human override. **We show this gate working — on our own content.**
- **Human approve-once.** Nothing auto-publishes blind. The founder taps approve on the week's batch. We make
  the approval the visible "human in the loop" selling point (`02` §3, bullet 2), not a hidden step.
- **Brand-DNA injection = on-brand by construction**, not by prompt. Per brand-dna `voice.dont`: no buzzword
  slop, no "revolutionary" hype, no emoji spam, no fake urgency. The content engine inherits these rules.
- **AI disclosure where platform/law mandates** (brand-dna `platform_policy`). Honesty is on-brand.

> The anti-slop story is our single most differentiating content. Most competitors hide that their output is
> AI. We do the opposite: **"yes it's AI, and here's the gate that stops it from being slop."** That's a
> category-of-one position and it's free content every single week.

---

## 3. WEEK-1 content calendar (7 concrete, postable concepts)

Mode A (pre-OAuth, build-in-public) phrasing shown; in Mode B the same posts run *through* the product and
the stamp becomes literal. Primary platform per post noted; all CTAs route to the URL-scan unless stated.
All copy honors brand-dna voice (confident, anti-hype, proof-over-promise) and `voice.dont`.

| Day | Pillar | Platform | Hook | Format | Body (concept) | CTA |
|---|---|---|---|---|---|---|
| **Mon** | Dogfood Diary (kickoff) | LinkedIn + X | "We're letting our own AI run our company's social media for 30 days. In public. Every post, every metric, every screwup." | Text post (LinkedIn) + thread (X) | Announce the experiment. State the rules: SocialFly drafts + schedules, a human approves once, we publish the real numbers weekly. Set the "build-in-public" contract. | "Want it to read *your* brand? Paste your URL → socialfly.io (free, no card)." |
| **Tue** | Anti-Slop / The Gate | X (thread) → LinkedIn | "Our own tool just rejected a post we wrote. Here's the draft it killed and why." | Screenshot of gate verdict + before/after | Show the virality/quality gate scoring a real draft below 0.6, the LLM-judge's reason, and the on-brand rewrite that passed. "This is the difference between automation and slop." | "Try the gate on your brand → socialfly.io" |
| **Wed** | Operator POV (founder pain) | LinkedIn | "It's 11pm. You still haven't posted today. You're the founder, the engineer, AND the social media intern. Pick a lane." | Short narrative post | The solo-founder time-tax. Name the 3-tool stack ($60–80/mo) we replaced. Reframe: you don't need a content generator, you need an operator that just keeps you showing up. | "Stop being your own social intern → socialfly.io" |
| **Thu** | Show-the-Output (proof) | X + LinkedIn | "We fed SocialFly one URL — our own homepage. Here's the on-brand post it wrote back. No prompt engineering." | Side-by-side: source site → generated post | The URL-scan aha, shown not told. Highlight: matched the voice, the colors, the audience — by construction, not by us tweaking it. | "Paste your URL, see what it says about your brand → socialfly.io" |
| **Fri** | Dogfood Diary (week-1 recap) | LinkedIn (long) + X (thread) + Blog | "Week 1 of SocialFly running our socials: the real numbers." | Recap post + blog roll-up | Real-only stats: drafts produced, posts scheduled/shipped, drafts the gate rejected, best post + why. One honest miss. "Here's what the operator learned and changes next week." Link canonical blog recap. | "We're proving it on us. Prove it on you → socialfly.io" |
| **Sat** | Teach / JTBD (compounding) | LinkedIn + Blog | "How to make AI match your brand voice (so your posts don't sound like a robot)." | Carousel concept / how-to post | Practical: why generic AI sounds like AI, how URL-scan voice-learning works, the 3 checks that keep it on-brand. Soft, evergreen, SEO-aligned (`03` article #5). | "The fastest way to test it: socialfly.io (free)." |
| **Sun** | Anti-Slop / Build-in-public (light) | X | "Building in public update: wiring SocialFly's first real platform connection this week so it can auto-publish, not just draft. Here's the honest status." | Casual status post | Honest "build" transparency (covers the pre-OAuth reality): what's live, what's being wired, ship ETA. Founders reward candor; it deepens the build-in-public bond. | "Follow the build → @socialfly. Or jump in → socialfly.io" |

**Why this set works:** it leads with the Dogfood Diary (Mon, Fri), front-loads the differentiating anti-slop
proof (Tue), bonds via founder pain (Wed), shows-don't-tells the aha (Thu), plants a compounding SEO asset
(Sat), and the Sunday post *honestly absorbs the pre-OAuth constraint* into the build-in-public narrative
instead of hiding it. Every CTA is the single URL-scan ask.

---

## 4. The repeatable weekly content engine (after Week 1)

A 5-post supervised week that re-runs indefinitely, anchored to the proof loop:

**Weekly template (Mon–Fri primary stack):**
| Slot | Pillar | Recurring job |
|---|---|---|
| Mon | Dogfood Diary | "This week the operator is running…" — set the week's theme/experiment. |
| Tue | Anti-Slop / The Gate | One gate-reject or one brand-learned-vs-generic A/B, with the receipt. |
| Wed | Operator POV **or** Show-the-Output (alternate weeks) | Founder-pain take, or one real source→output proof / brand teardown. |
| Thu | Teach / JTBD | One evergreen how-to (also publishes to blog → compounds SEO/GEO). |
| Fri | Dogfood Diary (recap) | The week's real numbers + "what the operator learned & changed." → blog roll-up + homepage proof strip. |
| (Sat/Sun) | Repurpose | Cut the week's best post into an IG/TikTok Reel/Short (Mode B). |

**The weekly operating rhythm (the production loop):**
1. **Monday batch-draft.** SocialFly drafts the week's 5 posts from the brand DNA (one in-product session).
2. **Gate.** Each draft passes the virality/quality gate (threshold 0.6); sub-threshold drafts get rewritten.
3. **Human approve-once.** Founder reviews the batch in one sitting, taps approve. (The selling point, shown.)
4. **Schedule.** Mode A: post manually on cadence. Mode B: autopilot publishes on schedule — stamp is literal.
5. **Measure.** Pull the week's real metrics (requires analytics — PostHog/platform insights from `01` Week-1).
6. **Recap + learn.** Friday recap publishes the numbers; "what the operator learned" feeds next Monday's batch
   AND narrates the closed-loop moat. The loop closes; the dataset grows; the content writes itself.

**Inputs that keep it fresh (so it never becomes its own slop):** the real weekly metrics, real gate-rejects,
real founder questions from comments/DMs, real brand teardowns of people who reply. The engine is fed by
**reality**, which is exactly what keeps build-in-public content non-generic.

**Switch-on checklist for full Mode B (from `01` Week-1):** (1) wire ONE platform OAuth (LinkedIn first) →
the stamp becomes literal; (2) install analytics → the Friday numbers become measured, not estimated;
(3) keep the gate + approve-once visible as features. The content calendar above needs **zero changes** to
flip from Mode A to Mode B — that's by design.

---

## 5. Honest flags / dependencies

- **Platform-publishing is blocked today** (placeholder OAuth in `.env.local`, per `01` §0). Week-1 content
  runs in **Mode A** (draft-in-product + manual post + narrate the build). The Sunday post deliberately makes
  this constraint *part of the story* rather than a gap to hide. Engine flips to Mode B the moment OAuth lands.
- **Metrics honesty.** No analytics exist yet (`01` §0). Friday recaps must state *only-real* numbers — pre-
  measurement, that's "drafts produced + scheduled + gate-rejects," NOT "reach/impressions." Never invent a
  stat; the whole credibility play dies if one number is fake.
- **The gate is DEFAULT-OFF in code** (`virality-gate.ts`, `engineViralityGate=false`). To *show the gate
  working* as content, it must be toggled on for the dogfood account — a one-flag eng ask, worth it because the
  gate-reject post (Tue) is our most differentiating asset.
- **No credits were spent** producing this plan (concepts + copy only, per constraint). Actual image/video
  generation for posts is a separate, budget-gated step — and is the live #1 cost-runaway risk per
  `02-PRICING-MODEL.md`; enforce hard caps before generating at cadence.
- **This is a planning doc.** Execution depends on the Week-1 eng unblock (OAuth + analytics + gate-on) owned
  by the funnel/eng track.
