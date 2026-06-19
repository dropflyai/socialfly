import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface BrandVoiceAnalysis {
  tone: 'professional' | 'casual' | 'playful' | 'authoritative' | 'friendly' | 'inspirational'
  personality: {
    traits: string[]
    description: string
    communicationStyle: string
  }
  vocabulary: string[]
  writingPatterns: {
    sentenceLength: 'short' | 'medium' | 'long' | 'varied'
    useOfEmoji: 'none' | 'minimal' | 'moderate' | 'frequent'
    formality: number // 1-10 scale
    technicality: number // 1-10 scale
  }
  recommendations: string[]
}

export interface AudienceAnalysis {
  demographics: {
    ageRange: string
    gender: string
    location: string
    income: string
    education: string
  }
  interests: string[]
  painPoints: string[]
  goals: string[]
  platforms: string[]
}

export interface ContentPillarAnalysis {
  pillars: Array<{
    name: string
    description: string
    keywords: string[]
    contentTypes: string[]
  }>
  hashtags: {
    primary: string[]
    secondary: string[]
    niche: string[]
  }
}

export interface FullBrandAnalysis {
  voice: BrandVoiceAnalysis
  audience: AudienceAnalysis
  content: ContentPillarAnalysis
  visualStyle: {
    style: 'minimal' | 'bold' | 'vintage' | 'modern' | 'corporate' | 'playful' | 'luxury' | 'organic'
    colors: {
      primary: string
      secondary: string
      accent: string
    }
    imagery: string
  }
  competitors: string[]
  summary: string
}

export async function analyzeWebsiteContent(
  content: string,
  url: string
): Promise<FullBrandAnalysis> {
  const systemPrompt = `You are a brand strategist and voice analyst. Analyze the provided website content to extract comprehensive brand intelligence.

Your analysis must be thorough, specific, and actionable. Extract real insights from the content - don't make generic assumptions.

Return your analysis as valid JSON matching this exact structure:
{
  "voice": {
    "tone": "professional|casual|playful|authoritative|friendly|inspirational",
    "personality": {
      "traits": ["trait1", "trait2", ...],
      "description": "2-3 sentence personality summary",
      "communicationStyle": "how they communicate"
    },
    "vocabulary": ["characteristic", "words", "they", "use"],
    "writingPatterns": {
      "sentenceLength": "short|medium|long|varied",
      "useOfEmoji": "none|minimal|moderate|frequent",
      "formality": 7,
      "technicality": 5
    },
    "recommendations": ["actionable recommendation 1", ...]
  },
  "audience": {
    "demographics": {
      "ageRange": "25-45",
      "gender": "all|male|female|other",
      "location": "geographic focus",
      "income": "income level",
      "education": "education level"
    },
    "interests": ["interest1", "interest2"],
    "painPoints": ["pain point 1", ...],
    "goals": ["what they want to achieve"],
    "platforms": ["instagram", "linkedin", ...]
  },
  "content": {
    "pillars": [
      {
        "name": "Pillar Name",
        "description": "What this pillar covers",
        "keywords": ["keyword1", ...],
        "contentTypes": ["educational", "inspirational", ...]
      }
    ],
    "hashtags": {
      "primary": ["#brandhashtag"],
      "secondary": ["#industry"],
      "niche": ["#specific"]
    }
  },
  "visualStyle": {
    "style": "minimal|bold|vintage|modern|corporate|playful|luxury|organic",
    "colors": {
      "primary": "#hex",
      "secondary": "#hex",
      "accent": "#hex"
    },
    "imagery": "description of image style"
  },
  "competitors": ["competitor1.com", ...],
  "summary": "2-3 sentence brand summary"
}`

  const userPrompt = `Analyze this website content from ${url}:

---
${content.slice(0, 15000)}
---

Extract the brand voice, target audience, content pillars, and visual style. Be specific and base your analysis on actual content patterns you observe.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Extract JSON from response (handle potential markdown code blocks)
  let jsonStr = textBlock.text
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1]
  }

  try {
    return JSON.parse(jsonStr) as FullBrandAnalysis
  } catch {
    throw new Error('Failed to parse brand analysis response')
  }
}

export async function generateContentWithBrand(
  prompt: string,
  brandVoice: BrandVoiceAnalysis,
  contentType: string,
  platform: string
): Promise<string> {
  const systemPrompt = `You are a social media content creator writing in a specific brand voice.

Brand Voice Profile:
- Tone: ${brandVoice.tone}
- Personality: ${brandVoice.personality.description}
- Communication Style: ${brandVoice.personality.communicationStyle}
- Formality Level: ${brandVoice.writingPatterns.formality}/10
- Emoji Usage: ${brandVoice.writingPatterns.useOfEmoji}
- Key Vocabulary: ${brandVoice.vocabulary.join(', ')}

Platform: ${platform}
Content Type: ${contentType}

Write content that perfectly matches this brand voice. Be authentic and engaging.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    system: systemPrompt,
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  return textBlock.text
}

// ============================================================================
// LLM-JUDGE (rung U4) — the PRIMARY, reliable virality/quality scorer.
//
// Scores a piece of content (image OR video, by its prompt/concept/caption)
// against a Brand DNA on four axes: brand-fit, anti-slop/quality, hook strength,
// platform-fit. Returns {score 0-1, verdict, reasons[]}. This is the gate's
// dependable baseline — it does NOT need Higgsfield's virality_predictor. It DOES
// need an ANTHROPIC_API_KEY; when that is absent the gate's fail-soft ladder
// skips the gate (it never blocks publish). See src/lib/engine/virality-gate.ts.
// ============================================================================

export interface JudgeVerdict {
  score: number // 0-1
  verdict: 'pass' | 'revise' | 'reject'
  reasons: string[]
  axes?: {
    brandFit?: number
    quality?: number
    hookStrength?: number
    platformFit?: number
  }
}

export interface JudgeContentInput {
  mediaType: 'image' | 'video'
  prompt?: string
  caption?: string
  platform?: string
  brand?: {
    brandName?: string
    oneLiner?: string
    voiceTone?: string[]
    voiceDo?: string[]
    voiceDont?: string[]
    aesthetic?: string[]
    avoid?: string[]
  }
}

/**
 * Judge a content draft against the brand on brand-fit / anti-slop / hook /
 * platform-fit. Pass `threshold` (0-1) so the model maps its 0-1 score to a
 * pass|revise|reject verdict consistently. Throws on missing key / parse failure
 * so the gate's fail-soft cascade can catch and skip (never block publish).
 */
export async function judgeContentAgainstBrand(
  input: JudgeContentInput,
  threshold = 0.6
): Promise<JudgeVerdict> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured (LLM-judge unavailable)')
  }

  const brand = input.brand ?? {}
  const reviseFloor = Math.max(0, threshold - 0.2)
  const systemPrompt = `You are a ruthless social-media creative director and brand guardian. You score a single piece of ${input.mediaType} content BEFORE it is published, against the brand's DNA. You are the anti-slop wall: generic, off-brand, or weak-hook content must NOT pass.

Score on four axes (each 0-1) and combine into one overall score (0-1):
1. brand-fit — does it match the brand voice/aesthetic and avoid banned terms/looks?
2. quality (anti-slop) — is it distinctive and well-crafted, NOT generic AI filler?
3. hook strength — would it stop the scroll in the first second?
4. platform-fit — is it right for the target platform's format/norms?

Map the overall score to a verdict using these thresholds:
- score >= ${threshold.toFixed(2)} → "pass"
- ${reviseFloor.toFixed(2)} <= score < ${threshold.toFixed(2)} → "revise" (salvageable; give concrete fixes)
- score < ${reviseFloor.toFixed(2)} → "reject"

Return ONLY valid JSON:
{"score": 0.0-1.0, "verdict": "pass|revise|reject", "axes": {"brandFit":0-1,"quality":0-1,"hookStrength":0-1,"platformFit":0-1}, "reasons": ["specific reason 1", "..."]}`

  const brandLines = [
    brand.brandName ? `Brand: ${brand.brandName}` : '',
    brand.oneLiner ? `One-liner: ${brand.oneLiner}` : '',
    brand.voiceTone?.length ? `Voice tone: ${brand.voiceTone.join(', ')}` : '',
    brand.voiceDo?.length ? `Voice DO: ${brand.voiceDo.join(', ')}` : '',
    brand.voiceDont?.length ? `Voice DON'T: ${brand.voiceDont.join(', ')}` : '',
    brand.aesthetic?.length ? `Aesthetic: ${brand.aesthetic.join(', ')}` : '',
    brand.avoid?.length ? `Visual AVOID: ${brand.avoid.join(', ')}` : '',
  ].filter(Boolean).join('\n')

  const userPrompt = `Score this ${input.mediaType} draft for ${input.platform ?? 'social'}:

Concept / generation prompt:
${input.prompt ?? '(none provided)'}
${input.caption ? `\nCaption:\n${input.caption}` : ''}

${brandLines ? `Brand DNA to score against:\n${brandLines}` : 'No specific brand DNA — score on general quality/hook/platform-fit.'}

Return the JSON verdict.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude judge')
  }

  let jsonStr = textBlock.text
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) jsonStr = jsonMatch[1]

  let parsed: JudgeVerdict
  try {
    parsed = JSON.parse(jsonStr) as JudgeVerdict
  } catch {
    throw new Error('Failed to parse LLM-judge response')
  }

  // Defensive normalization: clamp the score, derive verdict if missing/inconsistent.
  const score = Math.max(0, Math.min(1, Number(parsed.score)))
  const verdict: JudgeVerdict['verdict'] =
    parsed.verdict ?? (score >= threshold ? 'pass' : score >= reviseFloor ? 'revise' : 'reject')

  return {
    score,
    verdict,
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
    axes: parsed.axes,
  }
}

export async function repurposeContent(
  originalContent: string,
  sourcePlatform: string,
  targetPlatform: string,
  brandVoice: BrandVoiceAnalysis
): Promise<string> {
  const platformSpecs: Record<string, { maxLength: number; style: string }> = {
    twitter: { maxLength: 280, style: 'concise, punchy, hashtag-friendly' },
    instagram: { maxLength: 2200, style: 'visual storytelling, emoji-friendly, hashtag-rich' },
    linkedin: { maxLength: 3000, style: 'professional, thought leadership, industry insights' },
    tiktok: { maxLength: 150, style: 'trendy, Gen-Z friendly, hook-focused' },
    facebook: { maxLength: 500, style: 'community-focused, shareable, engaging questions' },
  }

  const target = platformSpecs[targetPlatform] || platformSpecs.instagram

  const systemPrompt = `You are a content repurposing expert. Transform content for different platforms while maintaining brand voice.

Brand Voice:
- Tone: ${brandVoice.tone}
- Formality: ${brandVoice.writingPatterns.formality}/10
- Emoji Usage: ${brandVoice.writingPatterns.useOfEmoji}

Target Platform: ${targetPlatform}
- Max Length: ${target.maxLength} characters
- Style: ${target.style}

Transform the content to fit the target platform perfectly while keeping the core message.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Original content from ${sourcePlatform}:\n\n${originalContent}\n\nRepurpose this for ${targetPlatform}.`,
      },
    ],
    system: systemPrompt,
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  return textBlock.text
}
