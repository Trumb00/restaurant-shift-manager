import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShiftPlanner } from '@/components/shifts/ShiftPlanner'
import { getWeekStart, getWeekDates } from '@/lib/utils'

export default async function TurniPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week } = await searchParams
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: currentEmployee } = await supabase
    .from('employees')
    .select('id, app_role')
    .eq('user_id', session.user.id)
    .single()

  const role = currentEmployee?.app_role ?? 'employee'

  // Compute week range
  const weekStart = week
    ? getWeekStart(new Date(week))
    : getWeekStart(new Date())
  const weekDates = getWeekDates(weekStart)
  const weekEnd = weekDates[6]
  const weekStartStr = weekStart.toISOString().split('T')[0]
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  // Find or create schedule for this week
  let { data: schedule } = await supabase
    .from('schedules')
    .select('*')
    .eq('week_start', weekStartStr)
    .maybeSingle()

  if (!schedule && (role === 'admin' || role === 'manager')) {
    const { data: newSchedule } = await supabase
      .from('schedules')
      .insert({
        week_start: weekStartStr,
        week_end: weekEndStr,
        status: 'draft',
        created_by: currentEmployee?.id,
      })
      .select()
      .single()
    schedule = newSchedule
  }

  if (!schedule) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Turni</h1>
        <p className="text-gray-500">Nessun piano turni trovato per questa settimana.</p>
      </div>
    )
  }

  // Fetch all required data in parallel
  const [
    { data: shifts },
    { data: timeSlots },
    { data: employees },
    { data: serviceRequirements },
  ] = await Promise.all([
    supabase
      .from('shifts')
      .select(`
        id, employee_id, time_slot_id, role_id, date, status, updated_at,
        is_split_shift, notes,
        employees(first_name, last_name),
        roles(name, color)
      `)
      .eq('schedule_id', schedule.id)
      .neq('status', 'cancelled'),
    supabase
      .from('time_slots')
      .select('*')
      .eq('is_active', true)
      .order('start_time'),
    supabase
      .from('employees')
      .select(`
        id, first_name, last_name,
        employee_roles(role_id, is_primary, roles(id, name, color))
      `)
      .eq('is_active', true)
      .order('last_name'),
    supabase
      .from('service_requirements')
      .select('time_slot_id, role_id, min_count, ideal_count, days_of_week, roles(name, color)'),
  ])

  const canEdit = role === 'admin' || role === 'manager'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pianificazione Turni</h1>
        <p className="text-gray-500 text-sm mt-1">
          Settimana del {weekStartStr} – {weekEndStr}
        </p>
      </div>

      <ShiftPlanner
        weekStart={weekStart}
        weekDates={weekDates}
        scheduleId={schedule.id}
        scheduleStatus={schedule.status}
        publishedAt={(schedule.published_at as string | null) ?? null}
        shifts={(shifts ?? []) as Parameters<typeof ShiftPlanner>[0]['shifts']}
        timeSlots={timeSlots ?? []}
        employees={(employees ?? []) as Parameters<typeof ShiftPlanner>[0]['employees']}
        serviceRequirements={(serviceRequirements ?? []) as Parameters<typeof ShiftPlanner>[0]['serviceRequirements']}
        canEdit={canEdit}
      />
    </div>
  )
}
