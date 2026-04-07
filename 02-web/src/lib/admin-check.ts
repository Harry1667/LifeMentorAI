import { auth } from '@clerk/nextjs/server'

// 從環境變數讀取 admin userId 清單
const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

/**
 * 檢查當前用戶是否為 admin
 * 回傳 null 表示通過，回傳 Response 表示拒絕
 */
export async function requireAdmin(): Promise<Response | null> {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  if (!ADMIN_IDS.includes(userId)) return new Response('Forbidden', { status: 403 })
  return null
}
