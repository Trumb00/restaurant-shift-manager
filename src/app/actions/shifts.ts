'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJson(v: unknown): Json { return v as any }

export interface ShiftInput {
  schedule_id: string
  employee_id: string
  time_slot_id: string
  role_id: string
  date: string
  actual_start?: string | null
  actual_end?: string | null
  is_split_shift?: boolean
  split_group_id?: string | null
  notes?: string | null
}

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

export async function validateShiftConstraints(data: ShiftInput): Promise<ValidationResult> {
  const supabase = await createClient()
  const errors: string[] = []
  const warnings: string[] = []

  // Fetch the time slot to get start/end times
  const { data: slot } = await supabase
    .from('time_slots')
    .select('start_time, end_time, name')
    .eq('id', data.time_slot_id)
    .single()

  if (!slot) {
    errors.push('Fascia oraria non trovata.')
    return { errors, warnings }
  }

  const shiftDate = data.date
  const slotStart = `${shiftDate}T${slot.start_time}`
  const slotEnd = `${shiftDate}T${slot.end_time}`
  const startMs = new Date(slotStart).getTime()
  const endMs = new Date(slotEnd).getTime()
  const shiftHours = (endMs - startMs) / (1000 * 60 * 60)

  // 1. No assignment during approved vacations
  const { data: vacation } = await supabase
    .from('vacations')
    .select('id')
    .eq('employee_id', data.employee_id)
    .eq('status', 'approved')
    .lte('start_date', shiftDate)
    .gte('end_date', shiftDate)
    .maybeSingle()

  if (vacation) {
    errors.push('Il dipendente ha una ferie/permesso approvata in questa data.')
  }

  // 2. Max daily hours (12h)
  const { data: dayShifts } = await supabase
    .from('shifts')
    .select('time_slot_id, actual_start, actual_end, time_slots(start_time, end_time)')
    .eq('employee_id', data.employee_id)
    .eq('date', shiftDate)
    .neq('status', 'cancelled')

  let dailyHours = shiftHours
  if (dayShifts) {
    for (const s of dayShifts) {
      const ts = Array.isArray(s.time_slots) ? s.time_slots[0] : s.time_slots
      if (!ts) continue
      const sStart = new Date(`${shiftDate}T${ts.start_time}`).getTime()
      const sEnd = new Date(`${shiftDate}T${ts.end_time}`).getTime()
      dailyHours += (sEnd - sStart) / (1000 * 60 * 60)
    }
  }
  if (dailyHours > 12) {
    errors.push(`Ore giornaliere eccedute: ${dailyHours.toFixed(1)}h (max 12h).`)
  }

  // 3. Minimum rest between shifts (11h)
  const { data: prevShifts } = await supabase
    .from('shifts')
    .select('time_slots(start_time, end_time), date')
    .eq('employee_id', data.employee_id)
    .neq('status', 'cancelled')
    .gte('date', new Date(new Date(shiftDate).getTime() - 2 * 86400000).toISOString().split('T')[0])
    .lte('date', shiftDate)

  if (prevShifts) {
    for (const s of prevShifts) {
      const ts = Array.isArray(s.time_slots) ? s.time_slots[0] : s.time_slots
      if (!ts) continue
      const prevEnd = new Date(`${s.date}T${ts.end_time}`).getTime()
      const restHours = (startMs - prevEnd) / (1000 * 60 * 60)
      if (restHours > 0 && restHours < 11) {
        errors.push(`Riposo insufficiente: solo ${restHours.toFixed(1)}h prima di questo turno (minimo 11h).`)
      }
    }
  }

  // 4. Max weekly hours (contract * 1.25)
  const weekStart = new Date(shiftDate)
  weekStart.setUTCHours(0, 0, 0, 0)
  const day = weekStart.getUTCDay()
  weekStart.setUTCDate(weekStart.getUTCDate() - ((day + 6) % 7))
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)

  const { data: employee } = await supabase
    .from('employees')
    .select('weekly_hours_contract')
    .eq('id', data.employee_id)
    .single()

  if (employee?.weekly_hours_contract) {
    const { data: weekShifts } = await supabase
      .from('shifts')
      .select('time_slots(start_time, end_time), date')
      .eq('employee_id', data.employee_id)
      .neq('status', 'cancelled')
      .gte('date', weekStart.toISOString().split('T')[0])
      .lte('date', weekEnd.toISOString().split('T')[0])

    let weeklyHours = shiftHours
    if (weekShifts) {
      for (const s of weekShifts) {
        const ts = Array.isArray(s.time_slots) ? s.time_slots[0] : s.time_slots
        if (!ts) continue
        const sStart = new Date(`${s.date}T${ts.start_time}`).getTime()
        const sEnd = new Date(`${s.date}T${ts.end_time}`).getTime()
        weeklyHours += (sEnd - sStart) / (1000 * 60 * 60)
      }
    }
    const maxWeekly = employee.weekly_hours_contract * 1.25
    if (weeklyHours > maxWeekly) {
      errors.push(`Ore settimanali eccedute: ${weeklyHours.toFixed(1)}h (max ${maxWeekly.toFixed(1)}h).`)
    }
  }

  // 5. Incompatibilities
  const { data: incompat } = await supabase
    .from('incompatibilities')
    .select('employee_a_id, employee_b_id')

  if (incompat && incompat.length > 0) {
    const { data: sameSlotShifts } = await supabase
      .from('shifts')
      .select('employee_id')
      .eq('date', shiftDate)
      .eq('time_slot_id', data.time_slot_id)
      .neq('status', 'cancelled')

    if (sameSlotShifts) {
      for (const other of sameSlotShifts) {
        const conflict = incompat.find(
          (i) =>
            (i.employee_a_id === data.employee_id && i.employee_b_id === other.employee_id) ||
            (i.employee_b_id === data.employee_id && i.employee_a_id === other.employee_id)
        )
        if (conflict) {
          errors.push('Incompatibilità: questo dipendente non può lavorare con un altro già assegnato a questo turno.')
        }
      }
    }
  }

  // SOFT WARNINGS

  // 6. Availability preference
  const dayOfWeek = new Date(shiftDate).getUTCDay()
  const { data: avail } = await supabase
    .from('availabilities')
    .select('preference')
    .eq('employee_id', data.employee_id)
    .eq('day_of_week', dayOfWeek)
    .eq('time_slot_id', data.time_slot_id)
    .maybeSingle()

  if (avail?.preference === 'unavailable') {
    warnings.push(`Il dipendente ha dichiarato indisponibilità per ${slot.name} in questo giorno della settimana.`)
  } else if (avail?.preference === 'available') {
    warnings.push(`Il dipendente preferisce non lavorare in ${slot.name} (fascia non preferita).`)
  }

  // 7. Using secondary role
  const { data: empRole } = await supabase
    .from('employee_roles')
    .select('is_primary')
    .eq('employee_id', data.employee_id)
    .eq('role_id', data.role_id)
    .maybeSingle()

  if (empRole && !empRole.is_primary) {
    warnings.push('Il dipendente viene assegnato al suo ruolo secondario (non primario).')
  }

  return { errors, warnings }
}

export async function createShift(data: ShiftInput): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()

  const validation = await validateShiftConstraints(data)
  if (validation.errors.length > 0) {
    return { error: validation.errors.join(' ') }
  }

  const { data: shift, error } = await supabase
    .from('shifts')
    .insert({
      schedule_id: data.schedule_id,
      employee_id: data.employee_id,
      time_slot_id: data.time_slot_id,
      role_id: data.role_id,
      date: data.date,
      actual_start: data.actual_start,
      actual_end: data.actual_end,
      is_split_shift: data.is_split_shift ?? false,
      split_group_id: data.split_group_id,
      notes: data.notes,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Audit log
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    await supabase.from('audit_logs').insert({
      user_id: session.user.id,
      action: 'INSERT',
      entity_type: 'shifts',
      entity_id: shift.id,
      new_values: toJson(data),
    })
  }

  revalidatePath('/dashboard/turni')
  return { id: shift.id }
}

export async function updateShift(id: string, data: Partial<ShiftInput>): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('shifts')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/turni')
  return {}
}

export async function deleteShift(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()

  const { data: existing } = await supabase.from('shifts').select('*').eq('id', id).single()

  const { error } = await supabase.from('shifts').delete().eq('id', id)
  if (error) return { error: error.message }

  if (session && existing) {
    await supabase.from('audit_logs').insert({
      user_id: session.user.id,
      action: 'DELETE',
      entity_type: 'shifts',
      entity_id: id,
      old_values: toJson(existing),
    })
  }

  revalidatePath('/dashboard/turni')
  return {}
}

export async function publishSchedule(scheduleId: string, sendEmail: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // Get current employee
  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', session?.user.id ?? '')
    .single()

  // Update all draft shifts to published
  const { error: shiftError } = await supabase
    .from('shifts')
    .update({ status: 'published' })
    .eq('schedule_id', scheduleId)
    .eq('status', 'draft')

  if (shiftError) return { error: shiftError.message }

  // Update schedule status
  const { error: schedError } = await supabase
    .from('schedules')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      published_by: employee?.id,
    })
    .eq('id', scheduleId)

  if (schedError) return { error: schedError.message }

  // Create notification records for each affected employee
  if (sendEmail) {
    const { data: shifts } = await supabase
      .from('shifts')
      .select('employee_id, date, time_slots(name), roles(name)')
      .eq('schedule_id', scheduleId)
      .eq('status', 'published')

    if (shifts) {
      const uniqueEmployees = [...new Set(shifts.map((s) => s.employee_id).filter((id): id is string => id !== null))]
      const notifications = uniqueEmployees.map((empId) => ({
        recipient_id: empId,
        type: 'schedule_published',
        title: 'Turni pubblicati',
        body: 'I tuoi turni per la prossima settimana sono stati pubblicati.',
        channel: 'email' as const,
        status: 'pending' as const,
      }))
      await supabase.from('notifications').insert(notifications)
    }
  }

  if (session) {
    await supabase.from('audit_logs').insert({
      user_id: session.user.id,
      action: 'PUBLISH',
      entity_type: 'schedules',
      entity_id: scheduleId,
    })
  }

  revalidatePath('/dashboard/turni')
  return {}
}
