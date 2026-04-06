export interface Persona {
  id: string
  name: string        // 顯示名稱（中文）
  fullName: string    // 英文全名
  archetype: string   // 一行描述
  systemPrompt: string
  domain: string      // 擅長領域
  color: string       // 代表色 (hex)
  initial: string     // 字母縮寫
  greeting: string    // 空狀態時的歡迎詞
}
