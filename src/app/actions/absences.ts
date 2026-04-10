'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJson(v: unknown): Json { return v as any }

export async function reportAbsence(
  shiftId: string,
  reason: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Non autenticato.' }

  const { data: shift } = await supabase
    .from('shifts')
    .select('employee_id, date, time_slot_id, schedule_id')
    .eq('id', shiftId)
    .single()

  if (!shift) return { error: 'Turno non trovato.' }
  if (!shift.employee_id) return { error: 'Turno senza dipendente assegnato.' }

  // Cancel the shift
  const { error } = await supabase
    .from('shifts')
    .update({ status: 'cancelled', notes: `Assenza: ${reason}` })
    .eq('id', shiftId)

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
        type: 'absence_reported',
        title: 'Assenza segnalata',
        body: `Un dipendente ha segnalato un'assenza per il ${shift.date}. Motivo: ${reason}`,
        channel: 'email' as const,
        status: 'pending' as const,
      }))
    )
  }

  // Notify on-call employees
  const { data: onCall } = await supabase
    .from('on_call_assignments')
    .select('employee_id, priority')
    .eq('date', shift.date)
    .eq('time_slot_id', shift.time_slot_id ?? '')
    .order('priority', { ascending: true })
    .limit(3)

  if (onCall && onCall.length > 0) {
    await supabase.from('notifications').insert(
      onCall.map((oc) => ({
        recipient_id: oc.employee_id,
        type: 'on_call_needed',
        title: 'Disponibilità richiesta',
        body: `Un collega è assente il ${shift.date}. Sei il reperibile #${oc.priority}. Il manager ti contatterà a breve.`,
        channel: 'email' as const,
        status: 'pending' as const,
      }))
    )
  }

  await supabase.from('audit_logs').insert({
    user_id: session.user.id,
    action: 'ABSENCE_REPORTED',
    entity_type: 'shifts',
    entity_id: shiftId,
    new_values: toJson({ reason, status: 'cancelled' }),
  })

  revalidatePath('/dashboard/assenze')
  revalidatePath('/dashboard/turni')
  return {}
}

export async function assignSubstitute(
  originalShiftId: string,
  substituteEmployeeId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Non autenticato.' }

  const { data: original } = await supabase
    .from('shifts')
    .select('schedule_id, time_slot_id, role_id, date')
    .eq('id', originalShiftId)
    .single()

  if (!original) return { error: 'Turno originale non trovato.' }

  const { data: newShift, error } = await supabase
    .from('shifts')
    .insert({
      schedule_id: original.schedule_id,
      employee_id: substituteEmployeeId,
      time_slot_id: original.time_slot_id,
      role_id: original.role_id,
      date: original.date,
      status: 'published',
      notes: 'Sostituzione assenza',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Notify the substitute
  await supabase.from('notifications').insert({
    recipient_id: substituteEmployeeId,
    type: 'substitute_assigned',
    title: 'Turno assegnato',
    body: `Sei stato assegnato come sostituto per il turno del ${original.date}.`,
    channel: 'email' as const,
    status: 'pending' as const,
  })

  await supabase.from('audit_logs').insert({
    user_id: session.user.id,
    action: 'SUBSTITUTE_ASSIGNED',
    entity_type: 'shifts',
    entity_id: newShift.id,
    new_values: toJson({ original_shift_id: originalShiftId, substitute_employee_id: substituteEmployeeId }),
  })

  revalidatePath('/dashboard/assenze')
  revalidatePath('/dashboard/turni')
  return {}
}
