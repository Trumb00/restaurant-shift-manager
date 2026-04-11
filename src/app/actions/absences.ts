'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

export type OnCallRow = {
  id: string
  employee_id: string
  employee_name: string
  date: string
  time_slot_id: string | null
  time_slot_name: string | null
  priority: number
}

export async function getOnCallWeek(weekStart: string): Promise<{ data: OnCallRow[]; error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { data: [], error: 'Non autenticato.' }

  const end = new Date(weekStart + 'T00:00:00Z')
  end.setUTCDate(end.getUTCDate() + 6)
  const endStr = end.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('on_call_assignments')
    .select('id, employee_id, date, time_slot_id, priority, employees(first_name, last_name), time_slots(name)')
    .gte('date', weekStart)
    .lte('date', endStr)
    .order('date')
    .order('priority')

  if (error) return { data: [], error: error.message }

  const rows: OnCallRow[] = (data ?? []).map(r => {
    const emp = Array.isArray(r.employees) ? r.employees[0] : r.employees
    const ts = Array.isArray(r.time_slots) ? r.time_slots[0] : r.time_slots
    return {
      id: r.id,
      employee_id: r.employee_id,
      employee_name: emp ? `${(emp as { first_name: string; last_name: string }).first_name} ${(emp as { first_name: string; last_name: string }).last_name}` : '?',
      date: r.date,
      time_slot_id: r.time_slot_id,
      time_slot_name: ts ? (ts as { name: string }).name : null,
      priority: r.priority,
    }
  })

  return { data: rows }
}

export async function assignOnCallDays(
  employeeId: string,
  dates: string[],
  timeSlotIds: string[],
  priority: number
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Non autenticato.' }

  if (dates.length === 0) return { error: 'Seleziona almeno un giorno.' }
  if (timeSlotIds.length === 0) return { error: 'Seleziona almeno una fascia oraria.' }

  const rows = dates.flatMap(date =>
    timeSlotIds.map(tsId => ({
      employee_id: employeeId,
      date,
      time_slot_id: tsId,
      priority,
    }))
  )

  const { error } = await supabase
    .from('on_call_assignments')
    .upsert(rows, { onConflict: 'date,time_slot_id,priority' })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/assenze')
  return {}
}

export async function removeOnCallDay(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Non autenticato.' }

  const { error } = await supabase
    .from('on_call_assignments')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/assenze')
  return {}
}

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
