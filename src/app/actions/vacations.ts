'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { VacationType, Json } from '@/lib/supabase/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJson(v: unknown): Json { return v as any }

export async function requestVacation(data: {
  start_date: string
  end_date: string
  type: VacationType
  reason?: string
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Non autenticato.' }

  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', session.user.id)
    .single()

  if (!employee) return { error: 'Profilo dipendente non trovato.' }

  const { data: vacation, error } = await supabase
    .from('vacations')
    .insert({
      employee_id: employee.id,
      start_date: data.start_date,
      end_date: data.end_date,
      type: data.type,
      reason: data.reason,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Notify managers
  const { data: managers } = await supabase
    .from('employees')
    .select('id')
    .in('app_role', ['admin', 'manager'])
    .eq('is_active', true)

  if (managers && managers.length > 0) {
    await supabase.from('notifications').insert(
      managers.map((m) => ({
        recipient_id: m.id,
        type: 'vacation_request',
        title: 'Nuova richiesta ferie',
        body: `Nuova richiesta di ${data.type} dal ${data.start_date} al ${data.end_date}.`,
        channel: 'email' as const,
        status: 'pending' as const,
      }))
    )
  }

  await supabase.from('audit_logs').insert({
    user_id: session.user.id,
    action: 'INSERT',
    entity_type: 'vacations',
    entity_id: vacation.id,
    new_values: toJson(data),
  })

  revalidatePath('/dashboard/ferie')
  return { id: vacation.id }
}

export async function reviewVacation(
  id: string,
  status: 'approved' | 'rejected',
  notes?: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Non autenticato.' }

  const { data: reviewer } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', session.user.id)
    .single()

  const { data: vacation } = await supabase
    .from('vacations')
    .select('employee_id, start_date, end_date, type')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('vacations')
    .update({
      status,
      reviewed_by: reviewer?.id,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Notify the employee
  if (vacation) {
    await supabase.from('notifications').insert({
      recipient_id: vacation.employee_id,
      type: status === 'approved' ? 'vacation_approved' : 'vacation_rejected',
      title: status === 'approved' ? 'Richiesta ferie approvata' : 'Richiesta ferie rifiutata',
      body: status === 'approved'
        ? `La tua richiesta di ${vacation.type} dal ${vacation.start_date} al ${vacation.end_date} è stata approvata.`
        : `La tua richiesta di ${vacation.type} dal ${vacation.start_date} al ${vacation.end_date} è stata rifiutata. ${notes ?? ''}`,
      channel: 'email' as const,
      status: 'pending' as const,
    })
  }

  await supabase.from('audit_logs').insert({
    user_id: session.user.id,
    action: 'UPDATE',
    entity_type: 'vacations',
    entity_id: id,
    new_values: toJson({ status, reviewer_notes: notes }),
  })

  revalidatePath('/dashboard/ferie')
  return {}
}

export async function cancelVacation(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Non autenticato.' }

  const { data: vacation } = await supabase
    .from('vacations')
    .select('employee_id, status')
    .eq('id', id)
    .single()

  if (!vacation) return { error: 'Richiesta non trovata.' }
  if (vacation.status !== 'pending') return { error: 'Puoi annullare solo richieste in attesa.' }

  const { error } = await supabase.from('vacations').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/ferie')
  return {}
}
