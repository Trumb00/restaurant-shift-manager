import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { VacationList } from '@/components/vacations/VacationList'
import { VacationRequestDialog } from '@/components/vacations/VacationRequestDialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Clock, CheckCircle2 } from 'lucide-react'

export default async function FeriePage() {
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

  // My requests
  const { data: myRequests } = await supabase
    .from('vacations')
    .select('*')
    .eq('employee_id', me?.id ?? '')
    .order('requested_at', { ascending: false })

  // Pending requests to approve (for managers)
  let pendingRequests: typeof myRequests = []
  if (isManager) {
    const { data } = await supabase
      .from('vacations')
      .select(`*, employees!vacations_employee_id_fkey(first_name, last_name)`)
      .eq('status', 'pending')
      .neq('employee_id', me?.id ?? '')
      .order('requested_at', { ascending: false })

    pendingRequests = (data ?? []).map((v) => {
      const emp = v.employees as { first_name: string; last_name: string } | null
      return {
        ...v,
        employee_name: emp ? `${emp.first_name} ${emp.last_name}` : undefined,
      }
    })
  }

  // Stats
  const currentYear = new Date().getFullYear()
  const approvedDays = (myRequests ?? [])
    .filter((v) => v.status === 'approved' && v.type === 'ferie' && new Date(v.start_date).getFullYear() === currentYear)
    .reduce((sum, v) => {
      return sum + Math.floor((new Date(v.end_date).getTime() - new Date(v.start_date).getTime()) / 86400000) + 1
    }, 0)

  const annualAllowance = 28
  const remaining = Math.max(0, annualAllowance - approvedDays)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ferie & Permessi</h1>
          <p className="text-gray-500 text-sm mt-1">Gestisci le tue richieste di assenza</p>
        </div>
        <VacationRequestDialog />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{annualAllowance}</p>
                <p className="text-xs text-gray-500">Giorni spettanti</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedDays}</p>
                <p className="text-xs text-gray-500">Giorni usati</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{remaining}</p>
                <p className="text-xs text-gray-500">Giorni residui</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isManager ? (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Da approvare {pendingRequests.length > 0 && `(${pendingRequests.length})`}
            </TabsTrigger>
            <TabsTrigger value="mine">Le mie richieste</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">
            <VacationList
              vacations={pendingRequests ?? []}
              canApprove={true}
              currentEmployeeId={me?.id}
            />
          </TabsContent>
          <TabsContent value="mine" className="mt-4">
            <VacationList
              vacations={(myRequests ?? []).map((v) => ({ ...v, employee_name: undefined }))}
              canApprove={false}
              currentEmployeeId={me?.id}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <VacationList
          vacations={(myRequests ?? []).map((v) => ({ ...v, employee_name: undefined }))}
          canApprove={false}
          currentEmployeeId={me?.id}
        />
      )}
    </div>
  )
}
