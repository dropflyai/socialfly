# PRICING/MARGIN RE-MODEL BRIEF — real Higgsfield costs (2026-06-18)

CEO fan-out: finance + pricing + mba. **ANALYSIS ONLY. NO image/video/audio generation. NO Higgsfield MCP generate_* calls. NO ToolSearch for generation tools.** Web research for competitor prices is fine. This is a spreadsheet-and-reasoning task, not a build.

## WHY
SocialFly's engine was reworked to Higgsfield-primary (U0–U4 shipped). The prior MBA R&D (`mba-rd.md`) modeled unit economics with an ASSUMED Higgsfield cost of ~$0.033/credit and concluded flat-unlimited pricing is insolvent + recommended hybrid SaaS + credit pass-through. We now have REAL cost data and must (a) re-validate margins, (b) set actual tiers, (c) decide the June-20 promo lever. Pricing has NOT been updated; no real tiers exist.

## REAL COST ANCHORS (verified this session — use these, not assumptions)
- **$/credit (top-up packs, the marginal/overage rate):** 500cr=$26 ($0.052), 1,000cr=$49 ($0.049), 2,000cr=$95 ($0.0475), **4,000cr=$190 ($0.0475)**. ≈ 20 credits per dollar. Use **$0.0475/cr** as the planning marginal cost (conservative; what a scaling business pays past plan credits). The MBA's $0.033 was ~45% too low.
- **Ultra subscription:** 3,000 credits/month. (Its promo annual headline price is unstable/dry-run — do NOT anchor margins on the subscription's promo price; treat plan credits as a cheap base allowance and overage at the $0.0475 top-up rate. Auto-refill exists at ~20 cr/$.)
- **Real credit cost per asset (from the live transaction ledger):**
  - Cheap image (Seedream/Nano-Banana base): ~0.25–1 cr → $0.01–0.05
  - Premium image (Nano-Banana Pro 2K, Marketing Studio Image): 2 cr → $0.10
  - **Video (Seedance 2.0, Veo 3.1, Kling, Cinematic Studio): 16.5–30 cr → $0.80–1.50** (Seedance 2.0 = 22.5; Veo 3.1 = 16.5–22; Cinematic 3.0 = 25–30)
  - Voiceover (TTS): 2 cr → $0.10 · Music: ~2 cr → $0.10 · SFX: 0.4 cr → $0.02
  - Soul training (one-time per persona): ~30 cr → ~$1.43
  - virality_predictor: unreliable (failed 3×) — treat as $0/unavailable for now; the gate uses an LLM-judge (Claude API) instead → add Claude token cost per gate (~$0.005–0.02/judge, estimate).
  - Caption/strategy LLM (Claude) per post: small, estimate ~$0.01–0.03.
- **Finished VIDEO post (image + 1 video + VO + music) ≈ 28.5 cr ≈ $1.35–1.50.** Two-phase gate drafting 3 variants then 1 premium render multiplies this — model both "single render" and "3-draft gate" costs, and note the design rule: DRAFT on cheap images/cheap-video, render premium only on the gated winner.

## THE JUNE-20 PROMO LEVER (time-sensitive, model-locked)
Higgsfield Ultra "buy by June 20" unlocks, for ONE YEAR: 365-UNLIMITED on Seedream 5.0 Lite, Flux.2 Pro (1K), Nano-Banana, Kling O1 Image, GPT Image; 5,000–10,000 FREE Soul V2/Cinema gens; Seedance 2.0 full access; Kling 3.0 7-day unlimited. **If our pipeline routes to these models and DropFly locks the annual plan before June 20, marginal image/video COGS → ~$0 for a year (per workspace).** Model BOTH scenarios: (A) pay-per-credit at $0.0475, (B) promo-locked (near-zero marginal on the covered models). Caveat: it's per-workspace/seat (doesn't trivially scale to N customer accounts unless each has its own plan), and time-boxed — assess honestly.

## PRODUCT CONTEXT (locked decisions)
Staged scope (lean surface → bet), ICP v1 = DropFly dogfood (then creator vs SMB), supervised approve-once. Posting cadence assumptions to model: image-heavy (mostly statics + 1–2 video/wk), mixed (3 video + 4 image/wk), video-heavy (daily video). Target margin: ≥60–70% blended GM, NRR ≥110% (from MBA R&D).

## DELIVERABLES (each brain writes to docs/_brain_outputs/pricing-<brain>.md, incrementally)
- **finance:** the COGS model — per-post-type cost at real prices; monthly COGS per account for the 3 cadences × {single-render, 3-draft-gate} × {pay-per-credit, promo-locked}; gross margin at candidate monthly prices ($19/$49/$99/$199); break-even posts/mo per tier; the promo sensitivity. Honest tables.
- **pricing:** a concrete tier structure (names, monthly price, included credit/post allowance, overage rate, video-render caps), packaging (sub + metered pass-through vs included), guardrails (NRR, base-conversion), and competitor price anchors (Buffer/Later/Hootsuite/Metricool/Opus Clip/Predis/HeyGen — web-research current prices, cite). Map tiers to creator vs SMB ICP.
- **mba:** does this clear the margin/NRR bar to be fundable/acquirable? LTV:CAC implications, the strategic go/no-go on locking the June-20 annual promo, and a premortem (where the pricing breaks — slop/over-generation, video power users, promo expiry, multi-account scaling).

CEO synthesizes → `docs/02-PRICING-MODEL.md`. Separate VERIFIED (real costs above, cited competitor prices) from ASSUMED. End each with TOP 3 RECOMMENDATIONS + OPEN QUESTIONS FOR RIO.
