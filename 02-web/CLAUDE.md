@AGENTS.md

# 02-web — Next.js 前端應用

## 技術棧
- Next.js 16（App Router）
- React 19 + TypeScript
- Tailwind CSS 4
- Clerk（認證）
- Supabase（資料庫）
- Anthropic API + AI SDK（對話）

## 目錄結構
- `src/app/` — 頁面路由（chat、sign-in、sign-up）
- `src/components/` — UI 元件
- `src/lib/` — 工具函式、Supabase client、personas、types
- `src/middleware.ts` — Clerk 路由保護

## 開發指令
- `npm run dev` — 啟動開發伺服器
- `npm run build` — 建置
- `npm run lint` — ESLint 檢查

## 環境變數
- `.env.local` 需設定 Clerk、Anthropic、Supabase keys
- 參考 `.env.local.example`

## 規則
- 使用 App Router，不用 Pages Router
- Clerk 用 `clerkMiddleware()`，不用已廢棄的 `authMiddleware()`
- 用 `<Show when="signed-in">` 取代已廢棄的 `<SignedIn>`
- 註解用繁體中文
