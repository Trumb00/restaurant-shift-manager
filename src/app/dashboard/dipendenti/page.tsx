import { createClient } from '@/lib/supabase/server'
import { EmployeeTable } from '@/components/employees/EmployeeTable'
import { EmployeeDialog } from '@/components/employees/EmployeeDialog'
import { redirect } from 'next/navigation'

export default async function DipendentiPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: currentEmployee } = await supabase
    .from('employees')
    .select('app_role')
    .eq('user_id', session.user.id)
    .single()

  const role = currentEmployee?.app_role ?? 'employee'
  if (role === 'employee') redirect('/dashboard')

  const [{ data: employees }, { data: roles }] = await Promise.all([
    supabase
      .from('employees')
      .select(`
        id, first_name, last_name, email, contract_type,
        weekly_hours_contract, is_active, app_role,
        employee_roles!left(role_id, is_primary, roles(name, color))
      `)
      .order('last_name'),
    supabase.from('roles').select('id, name, color').eq('is_active', true).order('name'),
  ])

  // Map primary role
  const mapped = (employees ?? []).map((emp) => {
    const empRoles = (emp.employee_roles ?? []) as Array<{
      role_id: string
      is_primary: boolean
      roles: { name: string; color: string } | null
    }>
    const primary = empRoles.find((r) => r.is_primary)?.roles ?? empRoles[0]?.roles ?? null
    return { ...emp, primary_role: primary, employee_roles: undefined }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dipendenti</h1>
          <p className="text-gray-500 text-sm mt-1">Gestisci l&apos;anagrafica del personale</p>
        </div>
        {(role === 'admin' || role === 'manager') && (
          <EmployeeDialog
            mode="create"
            availableRoles={roles ?? []}
            isAdmin={role === 'admin'}
          />
        )}
      </div>

      <EmployeeTable
        employees={mapped}
        roles={roles ?? []}
      />
    </div>
  )
}
