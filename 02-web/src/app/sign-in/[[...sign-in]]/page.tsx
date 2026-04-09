import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--accent-gold)' }}>
            Mentora
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            你的私人圓桌智者
          </p>
        </div>
        <SignIn />
      </div>
    </div>
  )
}
