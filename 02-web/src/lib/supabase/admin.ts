import postgres from 'postgres'
import type { Persona } from '@/lib/types/persona'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

export interface TheoryRecord {
  id: string
  name: string
  coreIdea: string
  keyPrinciples: string[]
  application: string
  systemPromptExtension: string
  category: string
  createdAt: string
}

export async function getCustomPersonas(): Promise<Persona[]> {
  try {
    const rows = await sql`
      SELECT id, name, full_name, archetype, color, initial, greeting, domain, system_prompt, category
      FROM custom_personas
      ORDER BY created_at DESC
    `
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name ?? '',
      archetype: r.archetype ?? '',
      color: r.color ?? '#6366f1',
      initial: r.initial ?? r.name[0],
      greeting: r.greeting ?? '',
      domain: r.domain ?? '',
      systemPrompt: r.system_prompt,
      category: r.category ?? '其他',
    }))
  } catch (err) {
    console.error('[DB] 自訂導師讀取失敗:', err)
    return []
  }
}

export async function saveCustomPersona(persona: Persona): Promise<void> {
  await sql`
    INSERT INTO custom_personas (id, name, full_name, archetype, color, initial, greeting, domain, system_prompt, category)
    VALUES (
      ${persona.id}, ${persona.name}, ${persona.fullName}, ${persona.archetype},
      ${persona.color}, ${persona.initial}, ${persona.greeting}, ${persona.domain},
      ${persona.systemPrompt}, ${(persona as Persona & { category?: string }).category ?? '其他'}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      full_name = EXCLUDED.full_name,
      archetype = EXCLUDED.archetype,
      color = EXCLUDED.color,
      initial = EXCLUDED.initial,
      greeting = EXCLUDED.greeting,
      domain = EXCLUDED.domain,
      system_prompt = EXCLUDED.system_prompt,
      category = EXCLUDED.category
  `
}

export async function deleteCustomPersona(id: string): Promise<void> {
  await sql`DELETE FROM custom_personas WHERE id = ${id}`
}

export async function getTheories(): Promise<TheoryRecord[]> {
  try {
    const rows = await sql`
      SELECT id, name, core_idea, key_principles, application, system_prompt_extension, created_at, category
      FROM theories
      ORDER BY created_at DESC
    `
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      coreIdea: r.core_idea ?? '',
      keyPrinciples: typeof r.key_principles === 'string'
        ? JSON.parse(r.key_principles)
        : (r.key_principles as string[]) ?? [],
      application: r.application ?? '',
      systemPromptExtension: r.system_prompt_extension ?? '',
      createdAt: r.created_at,
      category: r.category ?? '其他',
    }))
  } catch (err) {
    console.error('[DB] 理論讀取失敗:', err)
    return []
  }
}

export async function saveTheory(theory: Omit<TheoryRecord, 'id' | 'createdAt'>): Promise<void> {
  await sql`
    INSERT INTO theories (name, core_idea, key_principles, application, system_prompt_extension, category)
    VALUES (
      ${theory.name}, ${theory.coreIdea},
      ${JSON.stringify(theory.keyPrinciples)}::jsonb,
      ${theory.application}, ${theory.systemPromptExtension},
      ${theory.category ?? '其他'}
    )
  `
}

export async function deleteTheory(id: string): Promise<void> {
  await sql`DELETE FROM theories WHERE id = ${id}`
}

// 查詢用戶近期對話和未完成行動，用於導師回顧
export async function getRecentContext(userId: string): Promise<string> {
  try {
    const [recentSessions, pendingActions] = await Promise.all([
      sql`
        SELECT title, type, created_at FROM chat_sessions
        WHERE user_id = ${userId} AND created_at > NOW() - INTERVAL '3 days'
        ORDER BY created_at DESC LIMIT 5
      `,
      sql`
        SELECT advice_text, mentor_source, status FROM actions
        WHERE user_id = ${userId} AND status IN ('accepted', 'in_progress')
        ORDER BY created_at DESC LIMIT 5
      `,
    ])

    const parts: string[] = []

    if (recentSessions.length > 0) {
      const lines = recentSessions.map((s) => {
        const type = s.type === 'roundtable' ? '圓桌' : '對話'
        const date = new Date(s.created_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
        return '- ' + date + ' ' + type + '：' + (s.title || '（無標題）')
      })
      parts.push('【用戶近期對話】\n' + lines.join('\n'))
    }

    if (pendingActions.length > 0) {
      const lines = pendingActions.map((a) => {
        const status = a.status === 'in_progress' ? '進行中' : '已接受但未開始'
        return '- ' + a.advice_text + '（' + status + '，來自 ' + (a.mentor_source || '導師') + '）'
      })
      parts.push('【用戶未完成的行動】\n' + lines.join('\n'))
    }

    if (parts.length === 0) return ''

    return '\n\n' + parts.join('\n\n') + '\n\n'
      + '如果用戶有未完成的行動，請在回應中自然地關心進展，例如：「上次說要...，後來怎麼樣了？」'
      + '不要生硬地列出行動清單，要像朋友一樣自然帶出。如果用戶的問題和之前的行動無關，可以不提。'
  } catch {
    return ''
  }
}
