'use server'

import { createClient } from '@/lib/supabase/server'

export type EmployeeWeekHours = {
  employee_id: string
  first_name: string
  last_name: string
  contracted_hours: number
  shift_hours: number
  vacation_hours: number
  total_hours: number
  deficit: number // positive = above, negative = below
}

export async function getWeekHours(weekStart: string): Promise<{ data: EmployeeWeekHours[]; error?: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { data: [], error: 'Non autenticato.' }

  const weekEnd = new Date(weekStart + 'T00:00:00Z')
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  // All active employees with a contract
  const { data: employees } = await supabase
    .from('employees')
    .select('id, first_name, last_name, weekly_hours_contract')
    .eq('is_active', true)
    .gt('weekly_hours_contract', 0)
    .order('last_name')

  if (!employees || employees.length === 0) return { data: [] }

  // All non-cancelled shifts in the week
  const { data: shifts } = await supabase
    .from('shifts')
    .select('employee_id, date, time_slots(start_time, end_time)')
    .in('status', ['published', 'confirmed', 'completed'])
    .gte('date', weekStart)
    .lte('date', weekEndStr)
    .not('employee_id', 'is', null)

  // Sum shift hours per employee
  const shiftHoursMap = new Map<string, number>()
  for (const s of shifts ?? []) {
    if (!s.employee_id) continue
    const ts = Array.isArray(s.time_slots) ? s.time_slots[0] : s.time_slots
    if (!ts) continue
    const slot = ts as { start_time: string; end_time: string }
    const h = (new Date(`${s.date}T${slot.end_time}`).getTime() - new Date(`${s.date}T${slot.start_time}`).getTime()) / 3_600_000
    shiftHoursMap.set(s.employee_id, (shiftHoursMap.get(s.employee_id) ?? 0) + h)
  }

  // Approved vacations overlapping the week
  const empIds = employees.map(e => e.id)
  const { data: vacations } = await supabase
    .from('vacations')
    .select('employee_id, start_date, end_date')
    .eq('status', 'approved')
    .in('employee_id', empIds)
    .lte('start_date', weekEndStr)
    .gte('end_date', weekStart)

  // Sum vacation hours per employee (weekdays only, daily = contracted/5)
  const vacHoursMap = new Map<string, number>()
  const wStart = new Date(weekStart + 'T00:00:00Z')
  const wEnd = new Date(weekEndStr + 'T00:00:00Z')

  for (const vac of vacations ?? []) {
    const emp = employees.find(e => e.id === vac.employee_id)
    if (!emp?.weekly_hours_contract) continue
    const dailyH = emp.weekly_hours_contract / 5

    const ovStart = new Date(Math.max(new Date(vac.start_date + 'T00:00:00Z').getTime(), wStart.getTime()))
    const ovEnd = new Date(Math.min(new Date(vac.end_date + 'T00:00:00Z').getTime(), wEnd.getTime()))

    let days = 0
    const cur = new Date(ovStart)
    while (cur <= ovEnd) {
      const dow = cur.getUTCDay()
      if (dow !== 0 && dow !== 6) days++
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    vacHoursMap.set(vac.employee_id, (vacHoursMap.get(vac.employee_id) ?? 0) + days * dailyH)
  }

  const data: EmployeeWeekHours[] = employees.map(emp => {
    const shiftH = shiftHoursMap.get(emp.id) ?? 0
    const vacH = vacHoursMap.get(emp.id) ?? 0
    const total = shiftH + vacH
    const contracted = emp.weekly_hours_contract ?? 0
    return {
      employee_id: emp.id,
      first_name: emp.first_name,
      last_name: emp.last_name,
      contracted_hours: contracted,
      shift_hours: shiftH,
      vacation_hours: vacH,
      total_hours: total,
      deficit: total - contracted,
    }
  })

  return { data }
}
