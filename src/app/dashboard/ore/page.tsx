import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPeriodHours } from '@/app/actions/hours'
import { HoursDashboard } from '@/components/hours/HoursDashboard'
import { getWeekStart } from '@/lib/utils'

export default async function OrePage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: me } = await supabase
    .from('employees')
    .select('app_role')
    .eq('user_id', session.user.id)
    .single()

  if (me?.app_role !== 'admin' && me?.app_role !== 'manager') redirect('/dashboard')

  const initialAnchor = getWeekStart(new Date()).toISOString().split('T')[0]
  const weekEnd = new Date(initialAnchor + 'T00:00:00Z')
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
  const { data: initialData } = await getPeriodHours(initialAnchor, weekEnd.toISOString().split('T')[0])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ore dipendenti</h1>
        <p className="text-gray-500 text-sm mt-1">
          Bilancio ore per settimana, mese o anno · le ferie approvate contano come ore svolte
        </p>
      </div>
      <HoursDashboard initialAnchor={initialAnchor} initialData={initialData} />
    </div>
  )
}
