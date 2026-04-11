'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UtensilsCrossed, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { requestMagicLink } from '@/app/actions/auth'

type AuthError = { message: string } | null

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [magicEmail, setMagicEmail] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<AuthError>(
    urlError === 'auth' ? { message: 'Link di autenticazione non valido o scaduto. Riprova.' } : null
  )
  const [magicSuccess, setMagicSuccess] = React.useState(false)

  const supabase = createClient()

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

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

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMagicSuccess(false)

    const result = await requestMagicLink(magicEmail)

    if (result.error) {
      setError({ message: result.error })
      setLoading(false)
      return
    }

    setMagicSuccess(true)
    setLoading(false)
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
            <CardDescription className="text-center">Scegli il metodo di accesso preferito</CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 mb-4">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error.message}</p>
              </div>
            )}

            <Tabs defaultValue="password" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="magic">Magic Link</TabsTrigger>
              </TabsList>

              <TabsContent value="password">
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="nome@ristorante.it" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" disabled={loading} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" disabled={loading} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || !email || !password}>
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Accesso in corso...</> : 'Accedi'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="magic">
                {magicSuccess ? (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-50">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Email inviata!</p>
                      <p className="text-sm text-gray-500 mt-1">Controlla la tua casella di posta e clicca il link per accedere.</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setMagicSuccess(false); setMagicEmail('') }}>
                      Usa un&apos;altra email
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleMagicLink} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="magic-email">Email</Label>
                      <Input id="magic-email" type="email" placeholder="nome@ristorante.it" value={magicEmail} onChange={(e) => setMagicEmail(e.target.value)} required autoComplete="email" disabled={loading} />
                    </div>
                    <p className="text-xs text-gray-500">Riceverai un link sicuro via email per accedere senza password.</p>
                    <Button type="submit" className="w-full" disabled={loading || !magicEmail}>
                      {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Invio in corso...</> : 'Invia Magic Link'}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>
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
