'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function requestMagicLink(email: string): Promise<{ error?: string }> {
  const admin = createAdminClient()

  // Check if the email belongs to an active registered employee
  const { data } = await admin
    .from('employees')
    .select('id')
    .eq('is_active', true)
    .ilike('email', email)
    .maybeSingle()

  if (!data) {
    return { error: 'Email non registrata nel sistema. Contatta l\'amministratore.' }
  }

  // Send the magic link
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
  const { error } = await admin.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  })

  if (error) return { error: error.message }
  return {}
}

export async function requestPasswordReset(email: string): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: emp } = await admin
    .from('employees')
    .select('id')
    .eq('is_active', true)
    .ilike('email', email)
    .maybeSingle()

  if (!emp) {
    return { error: 'Email non registrata nel sistema. Contatta l\'amministratore.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/reset-password`,
  })

  if (error) return { error: error.message }
  return {}
}
