import { franklinPersona } from './franklin'
import { feynmanPersona } from './feynman'
import { stoicPersona } from './stoic'
import type { Persona } from '@/lib/types/persona'

export const PERSONAS: Record<string, Persona> = {
  franklin: franklinPersona,
  feynman: feynmanPersona,
  stoic: stoicPersona,
}

export const DEFAULT_PERSONA_ID = 'franklin'

export { franklinPersona, feynmanPersona, stoicPersona }
