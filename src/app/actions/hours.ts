'use server'

import { createClient } from '@/lib/supabase/server'

export type EmployeeWeekHours = {
  employee_id: string
  first_name: string
  last_name: string
  contracted_hours: number   // pro-rated to period weekdays
  shift_hours: number
  vacation_hours: number
  total_hours: number
  deficit: number            // positive = above, negative = below
}

/** Count Mon–Fri weekdays in [start, end] (UTC dates). */
function countWeekdays(start: Date, end: Date): number {
  let days = 0
  const cur = new Date(start)
  while (cur <= end) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) days++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

export async function getPeriodHours(
  periodStart: string,
  periodEnd: string,
): Promise<{ data: EmployeeWeekHours[]; error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { data: [], error: 'Non autenticato.' }

  const pStart = new Date(periodStart + 'T00:00:00Z')
  const pEnd   = new Date(periodEnd   + 'T00:00:00Z')
  const weekdaysInPeriod = countWeekdays(pStart, pEnd)

  // All active employees with a contract
  const { data: employees } = await supabase
    .from('employees')
    .select('id, first_name, last_name, weekly_hours_contract')
    .eq('is_active', true)
    .gt('weekly_hours_contract', 0)
    .order('last_name')

  if (!employees || employees.length === 0) return { data: [] }

  // Non-cancelled shifts in the period
  const { data: shifts } = await supabase
    .from('shifts')
    .select('employee_id, date, time_slots(start_time, end_time)')
    .in('status', ['published', 'confirmed', 'completed'])
    .gte('date', periodStart)
    .lte('date', periodEnd)
    .not('employee_id', 'is', null)

  const shiftHoursMap = new Map<string, number>()
  for (const s of shifts ?? []) {
    if (!s.employee_id) continue
    const ts = Array.isArray(s.time_slots) ? s.time_slots[0] : s.time_slots
    if (!ts) continue
    const slot = ts as { start_time: string; end_time: string }
    const h = (new Date(`${s.date}T${slot.end_time}`).getTime() - new Date(`${s.date}T${slot.start_time}`).getTime()) / 3_600_000
    shiftHoursMap.set(s.employee_id, (shiftHoursMap.get(s.employee_id) ?? 0) + h)
  }

  // Approved vacations overlapping the period
  const empIds = employees.map(e => e.id)
  const { data: vacations } = await supabase
    .from('vacations')
    .select('employee_id, start_date, end_date')
    .eq('status', 'approved')
    .in('employee_id', empIds)
    .lte('start_date', periodEnd)
    .gte('end_date', periodStart)

  const vacHoursMap = new Map<string, number>()
  for (const vac of vacations ?? []) {
    const emp = employees.find(e => e.id === vac.employee_id)
    if (!emp?.weekly_hours_contract) continue
    const dailyH = emp.weekly_hours_contract / 5

    const ovStart = new Date(Math.max(new Date(vac.start_date + 'T00:00:00Z').getTime(), pStart.getTime()))
    const ovEnd   = new Date(Math.min(new Date(vac.end_date   + 'T00:00:00Z').getTime(), pEnd.getTime()))

    const days = countWeekdays(ovStart, ovEnd)
    vacHoursMap.set(vac.employee_id, (vacHoursMap.get(vac.employee_id) ?? 0) + days * dailyH)
  }

  const data: EmployeeWeekHours[] = employees.map(emp => {
    const shiftH      = shiftHoursMap.get(emp.id) ?? 0
    const vacH        = vacHoursMap.get(emp.id) ?? 0
    const total       = shiftH + vacH
    // Pro-rate weekly contract to the actual weekdays in the period
    const contracted  = (emp.weekly_hours_contract ?? 0) * (weekdaysInPeriod / 5)
    return {
      employee_id:      emp.id,
      first_name:       emp.first_name,
      last_name:        emp.last_name,
      contracted_hours: Math.round(contracted * 10) / 10,
      shift_hours:      shiftH,
      vacation_hours:   vacH,
      total_hours:      total,
      deficit:          total - Math.round(contracted * 10) / 10,
    }
  })

  return { data }
}
