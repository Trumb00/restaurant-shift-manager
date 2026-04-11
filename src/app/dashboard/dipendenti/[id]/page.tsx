import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { EmployeeDialog } from '@/components/employees/EmployeeDialog'
import { ToggleActiveButton } from '@/components/employees/ToggleActiveButton'
import { IncompatibilityManager } from '@/components/employees/IncompatibilityManager'
import { formatDate, formatTime } from '@/lib/utils'
import { ArrowLeft, Mail, Phone, Calendar, Clock, Briefcase, UserX } from 'lucide-react'

const CONTRACT_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  on_call: 'A chiamata',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Amministratore',
  manager: 'Manager',
  employee: 'Dipendente',
}

export default async function DipendentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: currentEmployee } = await supabase
    .from('employees')
    .select('app_role')
    .eq('user_id', session.user.id)
    .single()

  const viewerRole = currentEmployee?.app_role ?? 'employee'
  if (viewerRole === 'employee') redirect('/dashboard')

  const [{ data: emp }, { data: roles }, { data: incompatRows }, { data: allEmployees }] = await Promise.all([
    supabase
      .from('employees')
      .select(`
        *,
        employee_roles(role_id, is_primary, proficiency_level, roles(id, name, color))
      `)
      .eq('id', id)
      .single(),
    supabase.from('roles').select('id, name, color').eq('is_active', true),
    supabase
      .from('incompatibilities')
      .select('employee_a_id, employee_b_id')
      .or(`employee_a_id.eq.${id},employee_b_id.eq.${id}`),
    supabase
      .from('employees')
      .select('id, first_name, last_name')
      .eq('is_active', true)
      .neq('id', id)
      .order('last_name'),
  ])

  if (!emp) notFound()

  const incompatibleIds = (incompatRows ?? []).map((row) =>
    row.employee_a_id === id ? row.employee_b_id! : row.employee_a_id!
  )

  // Last 30 days shifts
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentShifts } = await supabase
    .from('shifts')
    .select('id, date, status, time_slots(name, start_time, end_time), roles(name, color)')
    .eq('employee_id', id)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(10)

  const empRoles = (emp.employee_roles ?? []) as Array<{
    role_id: string
    is_primary: boolean
    proficiency_level: number
    roles: { id: string; name: string; color: string } | null
  }>

  const defaultValues = {
    first_name: emp.first_name,
    last_name: emp.last_name,
    email: emp.email,
    phone: emp.phone ?? '',
    contract_type: emp.contract_type ?? 'full_time',
    weekly_hours_contract: emp.weekly_hours_contract ?? 40,
    hire_date: emp.hire_date ?? '',
    app_role: emp.app_role,
    preferred_rest_days: (emp as unknown as { preferred_rest_days?: number[] }).preferred_rest_days ?? [],
    roles: empRoles.map((r) => ({
      role_id: r.role_id,
      is_primary: r.is_primary,
      proficiency_level: r.proficiency_level ?? 1,
    })),
  }

  const STATUS_COLORS: Record<string, string> = {
    draft: 'secondary',
    published: 'default',
    confirmed: 'success',
    completed: 'success',
    cancelled: 'destructive',
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/dipendenti" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {emp.first_name} {emp.last_name}
          </h1>
          <p className="text-gray-500 text-sm">{emp.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <ToggleActiveButton employeeId={id} isActive={emp.is_active} />
          <EmployeeDialog
            mode="edit"
            employeeId={id}
            defaultValues={defaultValues as Record<string, unknown>}
            availableRoles={roles ?? []}
            isAdmin={viewerRole === 'admin'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Profile card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informazioni personali</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-gray-400" />
              <span>{emp.email}</span>
            </div>
            {emp.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>{emp.phone}</span>
              </div>
            )}
            {emp.hire_date && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>Assunto il {formatDate(emp.hire_date)}</span>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Tipo contratto</span>
              <span className="font-medium">{CONTRACT_LABELS[emp.contract_type ?? ''] ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Ore settimanali</span>
              <span className="font-medium">{emp.weekly_hours_contract ?? '—'}h</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Ruolo app</span>
              <Badge variant="secondary">{ROLE_LABELS[emp.app_role] ?? emp.app_role}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Stato</span>
              <Badge variant={emp.is_active ? 'success' : 'secondary'}>
                {emp.is_active ? 'Attivo' : 'Disattivato'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Operational roles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ruoli operativi</CardTitle>
          </CardHeader>
          <CardContent>
            {empRoles.length === 0 ? (
              <p className="text-sm text-gray-400">Nessun ruolo assegnato</p>
            ) : (
              <div className="space-y-2">
                {empRoles.map((r) => (
                  <div key={r.role_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: r.roles?.color ?? '#6366f1' }}
                      />
                      <span className="text-sm font-medium">{r.roles?.name}</span>
                      {r.is_primary && (
                        <Badge variant="outline" className="text-xs">Primario</Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {r.proficiency_level === 1 ? 'Base' : r.proficiency_level === 2 ? 'Intermedio' : 'Esperto'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent shifts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserX className="w-4 h-4 text-red-400" />
            Colleghi incompatibili
          </CardTitle>
        </CardHeader>
        <CardContent>
          <IncompatibilityManager
            employeeId={id}
            allEmployees={allEmployees ?? []}
            initialIncompatibleIds={incompatibleIds}
          />
        </CardContent>
      </Card>

      {/* Recent shifts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Turni recenti (ultimi 30 giorni)</CardTitle>
        </CardHeader>
        <CardContent>
          {(!recentShifts || recentShifts.length === 0) ? (
            <p className="text-sm text-gray-400">Nessun turno negli ultimi 30 giorni</p>
          ) : (
            <div className="space-y-2">
              {recentShifts.map((s) => {
                const ts = Array.isArray(s.time_slots) ? s.time_slots[0] : s.time_slots
                const role = Array.isArray(s.roles) ? s.roles[0] : s.roles
                return (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">{formatDate(s.date)}</p>
                        {ts && (
                          <p className="text-xs text-gray-500">
                            {ts.name} · {formatTime(ts.start_time)} – {formatTime(ts.end_time)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {role && (
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color }} />
                          {role.name}
                        </span>
                      )}
                      <Badge variant={(STATUS_COLORS[s.status] as 'default' | 'secondary' | 'success' | 'destructive' | 'outline' | 'warning') ?? 'secondary'}>
                        {s.status}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
