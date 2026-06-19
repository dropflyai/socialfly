# Brand DNA — DropFly (customer #0)

This is the per-account "Brand DNA" object SocialFly's engine injects into EVERY generation so output is on-brand by construction. Grounded in the live dropfly-portfolio brand tokens + positioning. It doubles as the schema for the `brand_souls` table (build rung U2).

```json
{
  "tenant": "dropfly",
  "brand_name": "DropFly",
  "tagline": "The AI Venture Studio That Builds & Ships Real Companies",
  "one_liner": "A pre-seed AI venture studio with its own build-machine — 52 specialist brains across 2 engines, 19 production products already shipped. Not slideware.",
  "positioning": "Back the machine; get the portfolio.",
  "audience": ["founders", "operators", "angel/pre-seed investors", "AI builders", "SMB owners evaluating DropFly products"],
  "voice": {
    "tone": ["confident", "builder/engineer", "anti-hype", "proof-over-promise", "a little swaggering"],
    "do": ["show real shipped work", "concrete numbers", "machine/build metaphors", "crisp declaratives"],
    "dont": ["buzzword slop", "vague 'revolutionary' hype", "emoji spam", "fake urgency", "slideware energy"]
  },
  "visual": {
    "background": "near-black deep navy  (oklch 0.135 0.012 265  ≈ #0A0D14)",
    "text": "near-white  (oklch 0.97 0.004 270  ≈ #F5F6FA)",
    "brand_gradient": ["#3B62F6 (indigo-blue)", "#7A4DF5 (violet)", "#A24BEF (purple)"],
    "aesthetic": ["cinematic", "premium dark", "high-craft (the anti-slop proof)", "architectural/engineered", "luminous gradient light on black", "clean negative space"],
    "avoid": ["stock-photo vibe", "cluttered", "generic SaaS pastel", "low-effort AI-slop"]
  },
  "higgsfield_binding": {
    "soul_id": null,           // DropFly is a brand, not a face — persona via brand-kit, not a trained twin (yet)
    "brand_kit_id": null,      // create via show_marketing_studio type=brand_kit once server key is minted
    "reference_elements": [],  // logo/product shots to add later
    "preferred_image_models": ["nano_banana_pro", "gpt_image_2", "cinematic_studio_2_5", "recraft-v4-1 (brand-palette-locked)"],
    "preferred_video_models": ["veo3_1", "kling3_0", "cinematic_studio_video_v2"]
  },
  "platform_policy": {
    "primary": ["linkedin", "twitter"],
    "secondary": ["instagram", "tiktok"],
    "post_cadence_target": "5x/week supervised",
    "ai_disclosure": "required where platform/law mandates"
  },
  "content_pillars": [
    "Build-in-public: what the 52-brain machine shipped this week",
    "Product spotlights (CloseFly flagship, SiteFly, VoiceFly, LawFly, etc.)",
    "Founder/operator POV on AI venture-building",
    "Proof > promise teardowns (real metrics, real screens)"
  ]
}
```

**Note:** `soul_id`/`brand_kit_id` are null until Rio mints the prod key and we create the brand kit. For the in-session proof we inject the visual + voice DNA directly into the prompt — same effect, manual.
