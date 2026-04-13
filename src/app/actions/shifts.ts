'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'
import { sendEmail, schedulePublishedEmail, scheduleUpdatedEmail } from '@/lib/email'
import type { ShiftEmailRow } from '@/lib/email'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJson(v: unknown): Json { return v as any }

export interface ShiftInput {
  schedule_id: string
  employee_id: string
  time_slot_id: string
  role_id: string
  date: string
  custom_start?: string | null  // HH:MM — sovrascrive l'orario della fascia
  custom_end?: string | null    // HH:MM — sovrascrive l'orario della fascia
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

  // 0. Duplicate assignment (hard error)
  const { data: duplicate } = await supabase
    .from('shifts')
    .select('id')
    .eq('employee_id', data.employee_id)
    .eq('time_slot_id', data.time_slot_id)
    .eq('date', data.date)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (duplicate) {
    errors.push('Questo dipendente è già assegnato a questa fascia oraria in questa data.')
    return { errors, warnings }
  }

  const shiftDate = data.date
  // Use custom times if provided, otherwise fall back to slot times
  const startTimeStr = data.custom_start ?? slot.start_time.slice(0, 5)
  const endTimeStr = data.custom_end ?? slot.end_time.slice(0, 5)
  const startMs = new Date(`${shiftDate}T${startTimeStr}`).getTime()
  const endMs = new Date(`${shiftDate}T${endTimeStr}`).getTime()
  const shiftHours = (endMs - startMs) / (1000 * 60 * 60)

  // 1. No assignment during approved vacations (hard error — cannot override)
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

  // 2. Max daily hours (12h) — soft warning, can override
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
    warnings.push(`Ore giornaliere elevate: ${dailyHours.toFixed(1)}h (soglia 12h).`)
  }

  // 3. Minimum rest between shifts (11h) — soft warning, bidirectional check
  const twoDaysMs = 2 * 86400000
  const { data: nearbyShifts } = await supabase
    .from('shifts')
    .select('time_slots(start_time, end_time), actual_start, actual_end, date')
    .eq('employee_id', data.employee_id)
    .neq('status', 'cancelled')
    .gte('date', new Date(new Date(shiftDate).getTime() - twoDaysMs).toISOString().split('T')[0])
    .lte('date', new Date(new Date(shiftDate).getTime() + twoDaysMs).toISOString().split('T')[0])

  if (nearbyShifts) {
    for (const s of nearbyShifts) {
      const ts = Array.isArray(s.time_slots) ? s.time_slots[0] : s.time_slots
      if (!ts) continue
      const prevStart = new Date(`${s.date}T${ts.start_time}`).getTime()
      const prevEnd = new Date(`${s.date}T${ts.end_time}`).getTime()

      // Gap: existing shift ends, new shift starts
      const gapBefore = startMs - prevEnd
      if (gapBefore > 0 && gapBefore < 11 * 3600000) {
        warnings.push(`Riposo insufficiente: solo ${(gapBefore / 3600000).toFixed(1)}h prima di questo turno (minimo 11h).`)
      }

      // Gap: new shift ends, existing shift starts
      const gapAfter = prevStart - endMs
      if (gapAfter > 0 && gapAfter < 11 * 3600000) {
        warnings.push(`Riposo insufficiente: solo ${(gapAfter / 3600000).toFixed(1)}h dopo questo turno (minimo 11h).`)
      }
    }
  }

  // 4. Max weekly hours (contract * 1.25) — soft warning
  const weekStart = new Date(shiftDate)
  weekStart.setUTCHours(0, 0, 0, 0)
  const day = weekStart.getUTCDay()
  weekStart.setUTCDate(weekStart.getUTCDate() - ((day + 6) % 7))
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)

  const { data: employee } = await supabase
    .from('employees')
    .select('weekly_hours_contract, preferred_rest_days')
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
      warnings.push(`Ore settimanali elevate: ${weeklyHours.toFixed(1)}h (soglia ${maxWeekly.toFixed(1)}h).`)
    }
  }

  // 5. Preferred rest days — soft warning
  const restDays = (employee as unknown as { preferred_rest_days?: number[] })?.preferred_rest_days ?? []
  const shiftDayOfWeek = new Date(shiftDate).getUTCDay()
  if (restDays.includes(shiftDayOfWeek)) {
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
    warnings.push(`${dayNames[shiftDayOfWeek]} è un giorno di riposo preferito da questo dipendente.`)
  }

  // 6. Incompatibilities — soft warning (requires confirmation)
  const { data: incompat } = await supabase
    .from('incompatibilities')
    .select('employee_a_id, employee_b_id')

  if (incompat && incompat.length > 0) {
    const { data: sameSlotShifts } = await supabase
      .from('shifts')
      .select('employee_id, employees(first_name, last_name)')
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
          const emp = Array.isArray(other.employees) ? other.employees[0] : other.employees
          const name = emp ? `${emp.first_name} ${emp.last_name}` : 'un collega'
          warnings.push(`Incompatibilità con ${name} già assegnato in questa fascia.`)
        }
      }
    }
  }

  // SOFT WARNINGS

  // 7. Availability preference
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

  // 8. Using secondary role
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
      actual_start: data.custom_start ? `${data.date}T${data.custom_start}:00` : (data.actual_start ?? null),
      actual_end: data.custom_end ? `${data.date}T${data.custom_end}:00` : (data.actual_end ?? null),
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

  // custom_start / custom_end are UI-only fields, not DB columns
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { custom_start, custom_end, ...dbFields } = data

  const { error } = await supabase
    .from('shifts')
    .update({ ...dbFields, updated_at: new Date().toISOString() })
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

export async function resetWeekSchedule(scheduleId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('schedule_id', scheduleId)

  if (error) return { error: error.message }

  // If the schedule was published, revert it to draft
  await supabase
    .from('schedules')
    .update({ status: 'draft', published_at: null, published_by: null })
    .eq('id', scheduleId)
    .eq('status', 'published')

  if (session) {
    await supabase.from('audit_logs').insert({
      user_id: session.user.id,
      action: 'RESET_WEEK',
      entity_type: 'schedules',
      entity_id: scheduleId,
    })
  }

  revalidatePath('/dashboard/turni')
  return {}
}

export interface EmployeeHoursCheck {
  employee_id: string
  employee_name: string
  contracted_hours: number
  shift_hours: number
  vacation_hours: number
  total_hours: number
  deficit: number // negative = under contracted
}

export async function checkScheduleHours(scheduleId: string): Promise<{ data: EmployeeHoursCheck[]; error?: string }> {
  const supabase = await createClient()

  const { data: schedule } = await supabase
    .from('schedules')
    .select('week_start, week_end')
    .eq('id', scheduleId)
    .single()

  if (!schedule) return { data: [] }

  const { data: shifts } = await supabase
    .from('shifts')
    .select('employee_id, date, time_slots(start_time, end_time), employees(first_name, last_name, weekly_hours_contract)')
    .eq('schedule_id', scheduleId)
    .eq('status', 'draft')
    .not('employee_id', 'is', null)

  if (!shifts || shifts.length === 0) return { data: [] }

  // Accumulate shift hours per employee
  const byEmp = new Map<string, { name: string; contracted: number; shiftHours: number }>()

  for (const s of shifts) {
    if (!s.employee_id) continue
    const emp = Array.isArray(s.employees) ? s.employees[0] : s.employees
    const ts = Array.isArray(s.time_slots) ? s.time_slots[0] : s.time_slots
    if (!emp || !ts) continue

    if (!byEmp.has(s.employee_id)) {
      byEmp.set(s.employee_id, {
        name: `${(emp as { first_name: string; last_name: string; weekly_hours_contract: number | null }).first_name} ${(emp as { first_name: string; last_name: string; weekly_hours_contract: number | null }).last_name}`,
        contracted: (emp as { first_name: string; last_name: string; weekly_hours_contract: number | null }).weekly_hours_contract ?? 0,
        shiftHours: 0,
      })
    }

    const slot = ts as { start_time: string; end_time: string }
    const h = (new Date(`${s.date}T${slot.end_time}`).getTime() - new Date(`${s.date}T${slot.start_time}`).getTime()) / 3_600_000
    byEmp.get(s.employee_id)!.shiftHours += h
  }

  // Accumulate approved vacation overlap hours per employee
  const empIds = [...byEmp.keys()]
  const { data: vacations } = await supabase
    .from('vacations')
    .select('employee_id, start_date, end_date')
    .eq('status', 'approved')
    .in('employee_id', empIds)
    .lte('start_date', schedule.week_end)
    .gte('end_date', schedule.week_start)

  const vacHours = new Map<string, number>()
  const wStart = new Date(schedule.week_start + 'T00:00:00Z')
  const wEnd = new Date(schedule.week_end + 'T00:00:00Z')

  for (const vac of vacations ?? []) {
    const contracted = byEmp.get(vac.employee_id)?.contracted ?? 0
    if (!contracted) continue
    const dailyH = contracted / 5

    const ovStart = new Date(Math.max(new Date(vac.start_date + 'T00:00:00Z').getTime(), wStart.getTime()))
    const ovEnd = new Date(Math.min(new Date(vac.end_date + 'T00:00:00Z').getTime(), wEnd.getTime()))

    let days = 0
    const cur = new Date(ovStart)
    while (cur <= ovEnd) {
      const dow = cur.getUTCDay()
      if (dow !== 0 && dow !== 6) days++
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    vacHours.set(vac.employee_id, (vacHours.get(vac.employee_id) ?? 0) + days * dailyH)
  }

  const result: EmployeeHoursCheck[] = [...byEmp.entries()].map(([id, d]) => {
    const vH = vacHours.get(id) ?? 0
    const total = d.shiftHours + vH
    return {
      employee_id: id,
      employee_name: d.name,
      contracted_hours: d.contracted,
      shift_hours: d.shiftHours,
      vacation_hours: vH,
      total_hours: total,
      deficit: total - d.contracted,
    }
  })

  return { data: result.sort((a, b) => a.deficit - b.deficit) }
}

export async function publishSchedule(scheduleId: string, sendNotification: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', session?.user.id ?? '')
    .single()

  const { data: schedule } = await supabase
    .from('schedules')
    .select('week_start, week_end, status, published_at')
    .eq('id', scheduleId)
    .single()

  if (!schedule) return { error: 'Schedule non trovato.' }

  const fmt = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString('it-IT', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    })
  const weekStart = fmt(schedule.week_start)
  const weekEnd = fmt(schedule.week_end)

  const isRepublish = schedule.status === 'published' && schedule.published_at != null

  if (isRepublish) {
    // ── RE-PUBLISH FLOW ──────────────────────────────────────────────────────
    const prevPublishedAt = schedule.published_at!

    // Promote any draft shifts added after the initial publish
    await supabase
      .from('shifts')
      .update({ status: 'published' })
      .eq('schedule_id', scheduleId)
      .eq('status', 'draft')

    const { error: schedError } = await supabase
      .from('schedules')
      .update({ published_at: new Date().toISOString(), published_by: employee?.id })
      .eq('id', scheduleId)

    if (schedError) return { error: schedError.message }

    if (sendNotification) {
      // Employees with modified/added shifts since last publish
      const { data: modifiedShifts } = await supabase
        .from('shifts')
        .select('employee_id')
        .eq('schedule_id', scheduleId)
        .gt('updated_at', prevPublishedAt)
        .not('employee_id', 'is', null)

      // Employees whose shifts were deleted since last publish (stored in audit_logs old_values)
      const { data: deletedLogs } = await supabase
        .from('audit_logs')
        .select('old_values')
        .eq('action', 'DELETE')
        .eq('entity_type', 'shifts')
        .gt('timestamp', prevPublishedAt)

      const affectedIds = new Set<string>()
      for (const s of modifiedShifts ?? []) {
        if (s.employee_id) affectedIds.add(s.employee_id)
      }
      for (const log of deletedLogs ?? []) {
        const ov = log.old_values as Record<string, unknown> | null
        if (ov?.schedule_id === scheduleId && typeof ov?.employee_id === 'string') {
          affectedIds.add(ov.employee_id)
        }
      }

      if (affectedIds.size > 0) {
        const { data: empData } = await supabase
          .from('employees')
          .select('id, first_name, last_name, email')
          .in('id', [...affectedIds])

        for (const emp of empData ?? []) {
          if (!emp.email) continue

          const { data: empShifts } = await supabase
            .from('shifts')
            .select('date, time_slots(name, start_time, end_time)')
            .eq('schedule_id', scheduleId)
            .eq('employee_id', emp.id)
            .in('status', ['published', 'draft'])
            .order('date')

          const shiftRows: ShiftEmailRow[] = (empShifts ?? []).map((s) => {
            const ts = Array.isArray(s.time_slots) ? s.time_slots[0] : s.time_slots
            return {
              date: s.date,
              slotName: (ts as { name: string } | null)?.name ?? '',
              startTime: (ts as { start_time: string } | null)?.start_time?.slice(0, 5) ?? '',
              endTime: (ts as { end_time: string } | null)?.end_time?.slice(0, 5) ?? '',
            }
          })

          await sendEmail({
            to: emp.email,
            subject: 'I tuoi turni sono stati aggiornati',
            html: scheduleUpdatedEmail(`${emp.first_name} ${emp.last_name}`, weekStart, weekEnd, shiftRows),
          })
        }
      }
    }

    if (session) {
      await supabase.from('audit_logs').insert({
        user_id: session.user.id,
        action: 'REPUBLISH',
        entity_type: 'schedules',
        entity_id: scheduleId,
      })
    }
  } else {
    // ── INITIAL PUBLISH FLOW ─────────────────────────────────────────────────
    const { error: shiftError } = await supabase
      .from('shifts')
      .update({ status: 'published' })
      .eq('schedule_id', scheduleId)
      .eq('status', 'draft')

    if (shiftError) return { error: shiftError.message }

    const { error: schedError } = await supabase
      .from('schedules')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_by: employee?.id,
      })
      .eq('id', scheduleId)

    if (schedError) return { error: schedError.message }

    if (sendNotification) {
      const { data: shifts } = await supabase
        .from('shifts')
        .select('employee_id')
        .eq('schedule_id', scheduleId)
        .eq('status', 'published')

      if (shifts) {
        const uniqueEmpIds = [...new Set(shifts.map((s) => s.employee_id).filter((id): id is string => id !== null))]

        await supabase.from('notifications').insert(
          uniqueEmpIds.map((empId) => ({
            recipient_id: empId,
            type: 'schedule_published',
            title: 'Turni pubblicati',
            body: 'I tuoi turni per la prossima settimana sono stati pubblicati.',
            channel: 'email' as const,
            status: 'pending' as const,
          }))
        )

        const { data: empData } = await supabase
          .from('employees')
          .select('id, first_name, last_name, email')
          .in('id', uniqueEmpIds)

        for (const emp of empData ?? []) {
          if (!emp.email) continue
          await sendEmail({
            to: emp.email,
            subject: 'I tuoi turni sono stati pubblicati',
            html: schedulePublishedEmail(`${emp.first_name} ${emp.last_name}`, weekStart, weekEnd),
          })
        }
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
  }

  revalidatePath('/dashboard/turni')
  return {}
}

export async function copyWeekSchedule(
  sourceScheduleId: string,
  targetWeekStart: string,
): Promise<{ scheduleId?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', session?.user.id ?? '')
    .single()

  // Compute target week end
  const targetStart = new Date(targetWeekStart)
  const targetEnd = new Date(targetStart)
  targetEnd.setUTCDate(targetStart.getUTCDate() + 6)
  const targetEndStr = targetEnd.toISOString().split('T')[0]

  // Get or create target schedule
  let { data: targetSchedule } = await supabase
    .from('schedules')
    .select('id, week_start')
    .eq('week_start', targetWeekStart)
    .maybeSingle()

  if (!targetSchedule) {
    const { data: newSchedule, error } = await supabase
      .from('schedules')
      .insert({
        week_start: targetWeekStart,
        week_end: targetEndStr,
        status: 'draft',
        created_by: employee?.id,
      })
      .select()
      .single()
    if (error) return { error: error.message }
    targetSchedule = newSchedule
  }

  if (!targetSchedule) return { error: 'Impossibile creare lo schedule.' }

  // Fetch source shifts
  const { data: sourceShifts } = await supabase
    .from('shifts')
    .select('employee_id, time_slot_id, role_id, date, is_split_shift, notes')
    .eq('schedule_id', sourceScheduleId)
    .neq('status', 'cancelled')

  if (!sourceShifts || sourceShifts.length === 0) {
    return { scheduleId: targetSchedule.id }
  }

  // Get source schedule week start to compute date offset
  const { data: sourceSchedule } = await supabase
    .from('schedules')
    .select('week_start')
    .eq('id', sourceScheduleId)
    .single()

  if (!sourceSchedule) return { error: 'Schedule sorgente non trovato.' }

  const sourceStart = new Date(sourceSchedule.week_start)
  const msOffset = targetStart.getTime() - sourceStart.getTime()

  // Delete existing shifts in target week before copying
  await supabase
    .from('shifts')
    .delete()
    .eq('schedule_id', targetSchedule.id)
    .eq('status', 'draft')

  // Insert copies with shifted dates
  const newShifts = sourceShifts.map((s) => {
    const newDate = new Date(new Date(s.date).getTime() + msOffset)
    return {
      schedule_id: targetSchedule!.id,
      employee_id: s.employee_id,
      time_slot_id: s.time_slot_id,
      role_id: s.role_id,
      date: newDate.toISOString().split('T')[0],
      is_split_shift: s.is_split_shift ?? false,
      notes: s.notes,
      status: 'draft' as const,
    }
  })

  const { error } = await supabase.from('shifts').insert(newShifts)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/turni')
  return { scheduleId: targetSchedule.id }
}
