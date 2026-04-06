import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface OpenAIContentOptions {
  prompt: string
  platform: string
  contentType: string
  brandVoice?: {
    tone: string
    personality: {
      description: string
      communicationStyle: string
    }
    vocabulary: string[]
    writingPatterns: {
      formality: number
      useOfEmoji: string
    }
  }
  maxTokens?: number
}

/**
 * Generate content with GPT-4o.
 * Used as a fallback when Claude is unavailable.
 */
export async function generateContentWithOpenAI(
  options: OpenAIContentOptions
): Promise<string> {
  const { prompt, platform, contentType, brandVoice, maxTokens = 1024 } = options

  const platformSpecs: Record<string, { maxLength: number; style: string }> = {
    twitter: { maxLength: 280, style: 'concise, punchy, hashtag-friendly' },
    instagram: { maxLength: 2200, style: 'visual storytelling, emoji-friendly, hashtag-rich' },
    linkedin: { maxLength: 3000, style: 'professional, thought leadership, industry insights' },
    tiktok: { maxLength: 150, style: 'trendy, Gen-Z friendly, hook-focused' },
    facebook: { maxLength: 500, style: 'community-focused, shareable, engaging questions' },
  }

  const target = platformSpecs[platform] || platformSpecs.instagram

  let systemPrompt = `You are a social media content creator writing in a specific brand voice.`

  if (brandVoice) {
    systemPrompt += `

Brand Voice Profile:
- Tone: ${brandVoice.tone}
- Personality: ${brandVoice.personality.description}
- Communication Style: ${brandVoice.personality.communicationStyle}
- Formality Level: ${brandVoice.writingPatterns.formality}/10
- Emoji Usage: ${brandVoice.writingPatterns.useOfEmoji}
- Key Vocabulary: ${brandVoice.vocabulary.join(', ')}`
  }

  systemPrompt += `

Platform: ${platform}
- Max Length: ${target.maxLength} characters
- Style: ${target.style}
Content Type: ${contentType}

Write content that perfectly matches this brand voice. Be authentic and engaging.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
  })

  const text = response.choices[0]?.message?.content
  if (!text) {
    throw new Error('No text response from OpenAI')
  }

  return text
}

/**
 * Analyze website content for brand voice using GPT-4o.
 * Fallback for Claude's analyzeWebsiteContent.
 */
export async function analyzeWebsiteContentWithOpenAI(
  content: string,
  url: string
): Promise<Record<string, unknown>> {
  const systemPrompt = `You are a brand strategist and voice analyst. Analyze the provided website content to extract comprehensive brand intelligence.

Your analysis must be thorough, specific, and actionable. Extract real insights from the content - don't make generic assumptions.

Return your analysis as valid JSON matching this exact structure:
{
  "voice": {
    "tone": "professional|casual|playful|authoritative|friendly|inspirational",
    "personality": {
      "traits": ["trait1", "trait2"],
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
    "recommendations": ["actionable recommendation 1"]
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
    "painPoints": ["pain point 1"],
    "goals": ["what they want to achieve"],
    "platforms": ["instagram", "linkedin"]
  },
  "content": {
    "pillars": [
      {
        "name": "Pillar Name",
        "description": "What this pillar covers",
        "keywords": ["keyword1"],
        "contentTypes": ["educational", "inspirational"]
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
    "colors": { "primary": "#hex", "secondary": "#hex", "accent": "#hex" },
    "imagery": "description of image style"
  },
  "competitors": ["competitor1.com"],
  "summary": "2-3 sentence brand summary"
}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Analyze this website content from ${url}:\n\n---\n${content.slice(0, 15000)}\n---\n\nExtract the brand voice, target audience, content pillars, and visual style. Be specific and base your analysis on actual content patterns you observe.`,
      },
    ],
  })

  const text = response.choices[0]?.message?.content
  if (!text) {
    throw new Error('No text response from OpenAI')
  }

  let jsonStr = text
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1]
  }

  try {
    return JSON.parse(jsonStr)
  } catch {
    throw new Error('Failed to parse brand analysis response from OpenAI')
  }
}

/**
 * Repurpose content for a different platform using GPT-4o.
 * Fallback for Claude's repurposeContent.
 */
export async function repurposeContentWithOpenAI(
  originalContent: string,
  sourcePlatform: string,
  targetPlatform: string,
  brandVoice?: {
    tone: string
    writingPatterns: { formality: number; useOfEmoji: string }
  }
): Promise<string> {
  const platformSpecs: Record<string, { maxLength: number; style: string }> = {
    twitter: { maxLength: 280, style: 'concise, punchy, hashtag-friendly' },
    instagram: { maxLength: 2200, style: 'visual storytelling, emoji-friendly, hashtag-rich' },
    linkedin: { maxLength: 3000, style: 'professional, thought leadership, industry insights' },
    tiktok: { maxLength: 150, style: 'trendy, Gen-Z friendly, hook-focused' },
    facebook: { maxLength: 500, style: 'community-focused, shareable, engaging questions' },
  }

  const target = platformSpecs[targetPlatform] || platformSpecs.instagram

  let systemPrompt = `You are a content repurposing expert. Transform content for different platforms while maintaining brand voice.`

  if (brandVoice) {
    systemPrompt += `

Brand Voice:
- Tone: ${brandVoice.tone}
- Formality: ${brandVoice.writingPatterns.formality}/10
- Emoji Usage: ${brandVoice.writingPatterns.useOfEmoji}`
  }

  systemPrompt += `

Target Platform: ${targetPlatform}
- Max Length: ${target.maxLength} characters
- Style: ${target.style}

Transform the content to fit the target platform perfectly while keeping the core message.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Original content from ${sourcePlatform}:\n\n${originalContent}\n\nRepurpose this for ${targetPlatform}.`,
      },
    ],
  })

  const text = response.choices[0]?.message?.content
  if (!text) {
    throw new Error('No text response from OpenAI')
  }

  return text
}

/**
 * Enhance an image prompt using GPT-4o.
 * Fallback for Claude's enhanceImagePrompt.
 */
export async function enhanceImagePromptWithOpenAI(
  simplePrompt: string,
  context?: { platform?: string; brand?: { tone: string; industry?: string }; contentTopic?: string }
): Promise<string> {
  const systemPrompt = `You are an expert at writing prompts for AI image generation (DALL-E, Flux/Stable Diffusion).

Given a simple description, create a detailed, high-quality image generation prompt.

Rules:
- Output ONLY the enhanced prompt, nothing else
- Be specific about composition, lighting, style, colors
- Include quality modifiers: "high quality", "professional", "sharp focus"
- For social media, prefer vibrant, eye-catching visuals
- Keep it under 200 words
- Do NOT include text/words in the image (AI models render text poorly)
- Make it photorealistic unless the user requests illustration/artwork
${context?.platform === 'instagram' ? '- Optimize for Instagram: vibrant, clean, scroll-stopping' : ''}
${context?.brand ? `- Brand style: ${context.brand.tone}, ${context.brand.industry || 'modern'}` : ''}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 300,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: context?.contentTopic
          ? `Create an image for a social media post about: ${context.contentTopic}\n\nUser's image idea: ${simplePrompt}`
          : simplePrompt,
      },
    ],
  })

  const text = response.choices[0]?.message?.content
  if (!text) {
    throw new Error('No text response from OpenAI')
  }

  return text.trim()
}
