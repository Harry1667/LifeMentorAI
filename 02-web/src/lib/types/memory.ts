export type TopicMemory = {
  type: 'topic'
  topic: string
  detail: string
}

export type DecisionMemory = {
  type: 'decision'
  decision: string
  outcome: 'accepted' | 'rejected' | 'in_progress'
  progress?: number
}

export type PreferenceMemory = {
  type: 'preference'
  dislike?: string
  like?: string
  reason: string
}

export type MilestoneMemory = {
  type: 'milestone'
  description: string
  date: string
}

export type Memory = TopicMemory | DecisionMemory | PreferenceMemory | MilestoneMemory

export interface MemoryRecord {
  id: string
  user_id: string
  type: Memory['type']
  content: Memory
  importance: number
  created_at: string
  updated_at: string
}
