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
