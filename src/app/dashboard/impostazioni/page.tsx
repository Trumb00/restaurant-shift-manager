import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TimeSlotManager } from '@/components/settings/TimeSlotManager'
import { RoleManager } from '@/components/settings/RoleManager'
import { ServiceRequirementManager } from '@/components/settings/ServiceRequirementManager'
import { formatTime } from '@/lib/utils'
import { Settings, Clock, Users, BarChart3 } from 'lucide-react'

export default async function ImpostazioniPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: me } = await supabase
    .from('employees')
    .select('app_role')
    .eq('user_id', session.user.id)
    .single()

  if (me?.app_role !== 'admin') redirect('/dashboard')

  const [{ data: timeSlots }, { data: roles }, { data: requirements }] = await Promise.all([
    supabase.from('time_slots').select('*').order('start_time'),
    supabase.from('roles').select('*').order('name'),
    supabase
      .from('service_requirements')
      .select('*, time_slots(name), roles(name, color)')
      .order('time_slot_id'),
  ])

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6" /> Impostazioni
        </h1>
        <p className="text-gray-500 text-sm mt-1">Configura ruoli, fasce orarie e requisiti di servizio</p>
      </div>

      <Tabs defaultValue="slots">
        <TabsList>
          <TabsTrigger value="slots">
            <Clock className="w-4 h-4 mr-1.5" /> Fasce orarie
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Users className="w-4 h-4 mr-1.5" /> Ruoli operativi
          </TabsTrigger>
          <TabsTrigger value="requirements">
            <BarChart3 className="w-4 h-4 mr-1.5" /> Requisiti servizio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="slots" className="mt-4">
          <TimeSlotManager timeSlots={timeSlots ?? []} />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <RoleManager roles={roles ?? []} />
        </TabsContent>

        <TabsContent value="requirements" className="mt-4">
          <ServiceRequirementManager
            requirements={requirements ?? []}
            timeSlots={timeSlots ?? []}
            roles={roles ?? []}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
