import { createOpenAI } from '@ai-sdk/openai'

/**
 * twloop AI Proxy — OpenAI 相容端點
 * 支援 Claude、Gemini、OpenAI 等多個 provider
 */
export const proxy = createOpenAI({
  baseURL: 'https://clip.twloop.com/v1',
  apiKey: process.env.AI_PROXY_TOKEN!,
})
