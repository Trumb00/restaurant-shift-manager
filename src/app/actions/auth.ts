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

async function sendSetPasswordEmail(admin: ReturnType<typeof createAdminClient>, email: string): Promise<{ error?: string }> {
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/reset-password`
  // Try invite first — creates auth user if they don't have one yet
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (!inviteError) return {}
  // User already has an auth account — send a password reset email instead
  const { error: resetError } = await admin.auth.resetPasswordForEmail(email, { redirectTo })
  if (resetError) return { error: resetError.message }
  return {}
}

export async function sendEmployeeInvite(employeeId: string): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: emp } = await admin
    .from('employees')
    .select('email, first_name, last_name, is_active')
    .eq('id', employeeId)
    .maybeSingle()

  if (!emp) return { error: 'Dipendente non trovato.' }
  if (!emp.is_active) return { error: 'Il dipendente non è attivo.' }

  return sendSetPasswordEmail(admin, emp.email)
}

export async function bulkSendInvites(employeeIds: string[]): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient()

  const { data: employees } = await admin
    .from('employees')
    .select('id, email, is_active')
    .in('id', employeeIds)

  if (!employees) return { sent: 0, failed: employeeIds.length }

  let sent = 0
  let failed = 0

  await Promise.all(
    employees.map(async (emp) => {
      if (!emp.is_active) { failed++; return }
      const { error } = await sendSetPasswordEmail(admin, emp.email)
      if (error) { failed++ } else { sent++ }
    })
  )

  return { sent, failed }
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
