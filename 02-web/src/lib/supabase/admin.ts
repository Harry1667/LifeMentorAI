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
  createdAt: string
}

export async function getCustomPersonas(): Promise<Persona[]> {
  try {
    const rows = await sql`
      SELECT id, name, full_name, archetype, color, initial, greeting, domain, system_prompt
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
    }))
  } catch (err) {
    console.error('[DB] 自訂導師讀取失敗:', err)
    return []
  }
}

export async function saveCustomPersona(persona: Persona): Promise<void> {
  await sql`
    INSERT INTO custom_personas (id, name, full_name, archetype, color, initial, greeting, domain, system_prompt)
    VALUES (
      ${persona.id}, ${persona.name}, ${persona.fullName}, ${persona.archetype},
      ${persona.color}, ${persona.initial}, ${persona.greeting}, ${persona.domain},
      ${persona.systemPrompt}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      full_name = EXCLUDED.full_name,
      archetype = EXCLUDED.archetype,
      color = EXCLUDED.color,
      initial = EXCLUDED.initial,
      greeting = EXCLUDED.greeting,
      domain = EXCLUDED.domain,
      system_prompt = EXCLUDED.system_prompt
  `
}

export async function deleteCustomPersona(id: string): Promise<void> {
  await sql`DELETE FROM custom_personas WHERE id = ${id}`
}

export async function getTheories(): Promise<TheoryRecord[]> {
  try {
    const rows = await sql`
      SELECT id, name, core_idea, key_principles, application, system_prompt_extension, created_at
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
    }))
  } catch (err) {
    console.error('[DB] 理論讀取失敗:', err)
    return []
  }
}

export async function saveTheory(theory: Omit<TheoryRecord, 'id' | 'createdAt'>): Promise<void> {
  await sql`
    INSERT INTO theories (name, core_idea, key_principles, application, system_prompt_extension)
    VALUES (
      ${theory.name}, ${theory.coreIdea},
      ${JSON.stringify(theory.keyPrinciples)}::jsonb,
      ${theory.application}, ${theory.systemPromptExtension}
    )
  `
}

export async function deleteTheory(id: string): Promise<void> {
  await sql`DELETE FROM theories WHERE id = ${id}`
}
