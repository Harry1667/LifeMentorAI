'use client'

interface ActionCardProps {
  label: string
  onClick: () => void
  accentColor?: string
}

export function ActionCard({ label, onClick, accentColor = 'var(--accent-gold)' }: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs text-left transition-colors hover:opacity-80"
      style={{
        border: `1px solid ${accentColor}`,
        color: accentColor,
        backgroundColor: 'transparent',
      }}
    >
      {label}
    </button>
  )
}

/** 一組行動卡片，顯示在最後一條導師訊息下方 */
export function ActionCards({
  actions,
  onSelect,
  accentColor,
}: {
  actions: string[]
  onSelect: (action: string) => void
  accentColor?: string
}) {
  if (actions.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 ml-11 mt-2">
      {actions.map((action) => (
        <ActionCard key={action} label={action} onClick={() => onSelect(action)} accentColor={accentColor} />
      ))}
    </div>
  )
}
