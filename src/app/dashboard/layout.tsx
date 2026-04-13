import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import type { AppRole } from '@/lib/supabase/types'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // Verify session
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    redirect('/login')
  }

  // Fetch employee profile by user_id
  let { data: employee } = await supabase
    .from('employees')
    .select('first_name, last_name, email, app_role, avatar_url')
    .eq('user_id', session.user.id)
    .single()

  // Fallback: look up by email and link user_id (handles first login after invite)
  if (!employee && session.user.email) {
    const admin = createAdminClient()
    const { data: empByEmail } = await admin
      .from('employees')
      .select('first_name, last_name, email, app_role, avatar_url')
      .ilike('email', session.user.email)
      .is('user_id', null)
      .single()

    if (empByEmail) {
      await admin
        .from('employees')
        .update({ user_id: session.user.id })
        .ilike('email', session.user.email)
        .is('user_id', null)
      employee = empByEmail
    }
  }

  const userName = employee
    ? `${employee.first_name} ${employee.last_name}`
    : (session.user.user_metadata?.full_name as string | undefined) ?? session.user.email ?? 'Utente'

  const userEmail = employee?.email ?? session.user.email ?? ''
  const userRole: AppRole = (employee?.app_role as AppRole) ?? 'employee'
  const avatarUrl = employee?.avatar_url ?? null

  return (
    <DashboardLayout
      userName={userName}
      userEmail={userEmail}
      userRole={userRole}
      avatarUrl={avatarUrl}
    >
      {children}
    </DashboardLayout>
  )
}
