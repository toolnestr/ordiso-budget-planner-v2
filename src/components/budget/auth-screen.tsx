'use client'

import { useState, type FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import {
  Loader2, TrendingUp, Wallet, Target, CreditCard, BarChart3, ArrowRight, Check, Info,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface AuthScreenProps {
  onSuccess?: () => void
}

const DEMO_ACCOUNTS: { label: string; email: string; password: string }[] = [
  { label: 'Admin', email: 'admin@finflow.app', password: 'admin123' },
  { label: 'Demo User', email: 'demo@finflow.app', password: 'demo123' },
]

const FEATURES: { icon: typeof Wallet; title: string; desc: string }[] = [
  { icon: Wallet, title: 'Track income & expenses', desc: 'Every dollar in and out, auto-categorized' },
  { icon: Target, title: 'Visual savings goals', desc: 'Watch progress grow with each deposit' },
  { icon: CreditCard, title: 'Debt payoff planner', desc: 'Snowball or avalanche — your choice' },
  { icon: BarChart3, title: 'Annual insights', desc: 'Yearly trends that reveal your habits' },
]

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const autofill = (em: string, pw: string) => {
    setEmail(em)
    setPassword(pw)
    setError(null)
  }

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    try {
      const res = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      })
      if (res?.error) {
        setError('Invalid email or password.')
      } else if (res?.ok) {
        toast.success('Welcome to FinFlow!')
        onSuccess?.()
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-teal-50 dark:from-emerald-950/50 dark:via-background dark:to-teal-950/40">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/10" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-500/10" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-300/10 blur-3xl dark:bg-emerald-400/5" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="grid w-full max-w-6xl items-center gap-8 lg:grid-cols-2 lg:gap-12">
          {/* ── Left hero panel (hidden on mobile) ─────────────────────── */}
          <div className="hidden lg:flex lg:flex-col lg:justify-center">
            {/* Brand */}
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">FinFlow</p>
                <p className="text-xs text-muted-foreground">Budget Planner</p>
              </div>
            </div>

            {/* Headline */}
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.1] text-balance">
              Take control of your{' '}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-400">
                money.
              </span>
            </h1>
            <p className="mt-4 max-w-md text-base text-muted-foreground">
              The beautiful, automated budget planner that makes managing money simple.
            </p>

            {/* Feature list */}
            <ul className="mt-8 space-y-4">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">{f.title}</p>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Trust footer */}
            <div className="mt-10 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Secure & private</span>
              </div>
              <Separator orientation="vertical" className="h-3.5" />
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Your data stays yours</span>
              </div>
            </div>
          </div>

          {/* ── Right auth card ────────────────────────────────────────── */}
          <div className="mx-auto w-full max-w-md lg:ml-auto lg:mr-0">
            {/* Mobile brand */}
            <div className="mb-6 flex items-center justify-center gap-2.5 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/30">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <p className="text-xl font-bold tracking-tight">FinFlow</p>
            </div>

            <Card className="border-emerald-100/60 p-6 shadow-xl shadow-emerald-900/5 backdrop-blur-sm dark:border-emerald-900/30 sm:p-8">
              <div className="mb-5">
                <h2 className="text-xl font-semibold tracking-tight">Welcome back</h2>
                <p className="text-sm text-muted-foreground">Sign in to continue managing your budget.</p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm font-medium text-rose-600 dark:text-rose-400">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="h-10 w-full"
                  disabled={loading}
                  aria-label="Sign in to your account"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Demo accounts */}
              <div className="mt-6 rounded-lg border border-emerald-200/60 bg-emerald-50/60 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  Demo accounts — click to autofill
                </p>
                <div className="space-y-1.5">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => autofill(acc.email, acc.password)}
                      className="group flex w-full items-center gap-2 rounded-md bg-background/70 px-2.5 py-1.5 text-left text-xs transition-all hover:bg-background hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-emerald-50 dark:focus-visible:ring-offset-emerald-950"
                      aria-label={`Autofill ${acc.label} demo account`}
                    >
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700 shrink-0 dark:bg-emerald-500/15 dark:text-emerald-300">
                        {acc.label}
                      </span>
                      <span className="truncate font-mono text-muted-foreground group-hover:text-foreground/80">
                        {acc.email}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-muted-foreground">
                        {acc.password}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Admin-managed accounts notice */}
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <p>
                  Don&apos;t have an account?{' '}
                  <span className="font-medium text-foreground">Accounts are created by the administrator.</span>{' '}
                  Please contact your admin to get access.
                </p>
              </div>
            </Card>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} FinFlow · Built for people who care about their money
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
