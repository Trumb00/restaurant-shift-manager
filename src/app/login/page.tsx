'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { UtensilsCrossed, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { requestPasswordReset } from '@/app/actions/auth'

type AuthError = { message: string } | null

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<AuthError>(
    urlError === 'auth' ? { message: 'Link di autenticazione non valido o scaduto. Riprova.' } : null
  )

  const [forgotView, setForgotView] = React.useState(false)
  const [forgotEmail, setForgotEmail] = React.useState('')
  const [forgotSuccess, setForgotSuccess] = React.useState(false)
  const [forgotLoading, setForgotLoading] = React.useState(false)

  const supabase = createClient()

  async function handlePasswordLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const emailVal = (formData.get('email') as string) || email
    const passwordVal = (formData.get('password') as string) || password

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: emailVal, password: passwordVal })

    if (signInError) {
      setError({ message: signInError.message === 'Invalid login credentials'
        ? 'Email o password non corretti.'
        : signInError.message
      })
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleForgotPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setForgotLoading(true)
    setError(null)

    const result = await requestPasswordReset(forgotEmail)

    if (result.error) {
      setError({ message: result.error })
      setForgotLoading(false)
      return
    }

    setForgotSuccess(true)
    setForgotLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-600/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--primary)] shadow-lg mb-4">
            <UtensilsCrossed className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">GestioneTurni</h1>
          <p className="text-sm text-[var(--muted-fg)] mt-1">Sistema di gestione del personale</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-lg">Accedi al tuo account</CardTitle>
            <CardDescription className="text-center">Inserisci le tue credenziali per accedere</CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 mb-4">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error.message}</p>
              </div>
            )}

            {forgotView ? (
              forgotSuccess ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-50">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Email inviata!</p>
                    <p className="text-sm text-gray-500 mt-1">Controlla la tua casella e clicca il link per impostare la nuova password.</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setForgotView(false); setForgotSuccess(false); setForgotEmail('') }}>
                    Torna al login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Reimposta password</p>
                    <p className="text-xs text-gray-500">Inserisci la tua email e ti invieremo un link per reimpostare la password.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input id="forgot-email" type="email" placeholder="nome@ristorante.it" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required autoComplete="email" disabled={forgotLoading} />
                  </div>
                  <Button type="submit" className="w-full" disabled={forgotLoading || !forgotEmail}>
                    {forgotLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Invio in corso...</> : 'Invia link di reset'}
                  </Button>
                  <button type="button" className="w-full text-xs text-gray-400 hover:text-indigo-500 text-center" onClick={() => { setForgotView(false); setError(null) }}>
                    ← Torna al login
                  </button>
                </form>
              )
            ) : (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="nome@ristorante.it" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" disabled={loading} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" disabled={loading} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Accesso in corso...</> : 'Accedi'}
                </Button>
                <div className="text-right">
                  <button type="button" className="text-xs text-gray-400 hover:text-indigo-500" onClick={() => { setForgotView(true); setError(null) }}>
                    Hai dimenticato la password?
                  </button>
                </div>
              </form>
            )}
          </CardContent>

          <CardFooter className="justify-center pb-6">
            <p className="text-xs text-gray-400">Problemi di accesso? Contatta l&apos;amministratore del sistema.</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center">Caricamento...</div>}>
      <LoginForm />
    </React.Suspense>
  )
}
