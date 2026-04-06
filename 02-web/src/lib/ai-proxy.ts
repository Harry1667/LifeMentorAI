import { createOpenAI } from '@ai-sdk/openai'

/**
 * 透過本機 Python 橋接層呼叫 AI proxy（gRPC → cli.twloop.com）
 * 啟動橋接：cd 01-dev/use_proxycli && uvicorn server:app --host 127.0.0.1 --port 8765
 */
const _provider = createOpenAI({
  baseURL: 'http://127.0.0.1:8765/v1',
  apiKey: 'bridge',  // 橋接層不驗證 key，auth 在 Python .env 裡
})

// 必須用 .chat() 才會走 /v1/chat/completions，直接呼叫 provider() 會走 /v1/responses
export const proxy = (model: string) => _provider.chat(model)
