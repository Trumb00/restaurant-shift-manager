import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AbsenceReportDialog } from '@/components/absences/AbsenceReportDialog'
import { formatDate, formatTime } from '@/lib/utils'
import { AlertCircle, Users, Clock } from 'lucide-react'

export default async function AssenzePage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: me } = await supabase
    .from('employees')
    .select('id, app_role')
    .eq('user_id', session.user.id)
    .single()

  const role = me?.app_role ?? 'employee'
  const isManager = role === 'admin' || role === 'manager'

  // Upcoming shifts for the current employee (for absence reporting)
  const today = new Date().toISOString().split('T')[0]
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)

  const { data: upcomingShifts } = await supabase
    .from('shifts')
    .select('id, date, time_slots(name, start_time, end_time)')
    .eq('employee_id', me?.id ?? '')
    .gte('date', today)
    .lte('date', nextWeek.toISOString().split('T')[0])
    .neq('status', 'cancelled')
    .order('date')

  const shiftOptions = (upcomingShifts ?? []).map((s) => {
    const ts = Array.isArray(s.time_slots) ? s.time_slots[0] : s.time_slots
    return {
      id: s.id,
      date: s.date,
      time_slot_name: ts?.name ?? '?',
      start_time: ts?.start_time ?? '00:00',
      end_time: ts?.end_time ?? '00:00',
    }
  })

  // Recent cancelled shifts (absences) - managers see all, employees see own
  const absenceQuery = supabase
    .from('shifts')
    .select(`
      id, date, notes, updated_at,
      employees(first_name, last_name),
      time_slots(name, start_time, end_time),
      roles(name, color)
    `)
    .eq('status', 'cancelled')
    .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(20)

  if (!isManager) {
    absenceQuery.eq('employee_id', me?.id ?? '')
  }

  const { data: absences } = await absenceQuery

  // On-call list for today (managers)
  let onCallToday: Array<{
    id: string
    priority: number
    employees: { first_name: string; last_name: string; phone: string | null } | null
    time_slots: { name: string } | null
  }> = []

  if (isManager) {
    const { data } = await supabase
      .from('on_call_assignments')
      .select('id, priority, employees(first_name, last_name, phone), time_slots(name)')
      .eq('date', today)
      .order('priority')
    onCallToday = (data ?? []) as typeof onCallToday
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestione Assenze</h1>
          <p className="text-gray-500 text-sm mt-1">Segnala assenze e monitora la copertura</p>
        </div>
        {shiftOptions.length > 0 && (
          <AbsenceReportDialog shifts={shiftOptions} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Recent absences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                {isManager ? 'Assenze recenti (30 giorni)' : 'Le mie assenze recenti'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!absences || absences.length === 0) ? (
                <p className="text-sm text-gray-400 py-4 text-center">Nessuna assenza registrata</p>
              ) : (
                <div className="space-y-3">
                  {absences.map((a) => {
                    const emp = Array.isArray(a.employees) ? a.employees[0] : a.employees
                    const ts = Array.isArray(a.time_slots) ? a.time_slots[0] : a.time_slots
                    const roleData = Array.isArray(a.roles) ? a.roles[0] : a.roles
                    return (
                      <div key={a.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                        <div className="p-1.5 bg-red-50 rounded-lg mt-0.5">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="flex-1">
                          {isManager && emp && (
                            <p className="font-medium text-sm">
                              {emp.first_name} {emp.last_name}
                            </p>
                          )}
                          <p className="text-sm text-gray-600">
                            {formatDate(a.date)}
                            {ts && ` – ${ts.name} (${formatTime(ts.start_time)}–${formatTime(ts.end_time)})`}
                          </p>
                          {roleData && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: roleData.color }} />
                              {roleData.name}
                            </span>
                          )}
                          {a.notes && (
                            <p className="text-xs text-gray-400 mt-0.5">{a.notes}</p>
                          )}
                        </div>
                        <Badge variant="destructive" className="text-xs">Assente</Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* On-call list */}
        {isManager && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                Reperibili oggi
              </CardTitle>
            </CardHeader>
            <CardContent>
              {onCallToday.length === 0 ? (
                <p className="text-sm text-gray-400">Nessun reperibile configurato per oggi</p>
              ) : (
                <div className="space-y-2">
                  {onCallToday.map((oc) => {
                    const emp = Array.isArray(oc.employees) ? oc.employees[0] : oc.employees
                    const ts = Array.isArray(oc.time_slots) ? oc.time_slots[0] : oc.time_slots
                    return (
                      <div key={oc.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-700">
                          {oc.priority}
                        </div>
                        <div className="flex-1">
                          {emp && (
                            <p className="text-sm font-medium">{emp.first_name} {emp.last_name}</p>
                          )}
                          {emp?.phone && (
                            <p className="text-xs text-gray-500">{emp.phone}</p>
                          )}
                          {ts && (
                            <p className="text-xs text-gray-400">{ts.name}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
