'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Requirement {
  id: string
  time_slot_id: string
  role_id: string
  min_count: number
  ideal_count: number
  time_slots: { name: string } | null
  roles: { name: string; color: string } | null
}

interface TimeSlot { id: string; name: string }
interface Role { id: string; name: string; color: string }

interface ServiceRequirementManagerProps {
  requirements: Requirement[]
  timeSlots: TimeSlot[]
  roles: Role[]
}

function AddRequirementDialog({
  timeSlots,
  roles,
  onClose,
}: {
  timeSlots: TimeSlot[]
  roles: Role[]
  onClose: () => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({
    time_slot_id: '',
    role_id: '',
    min_count: 1,
    ideal_count: 2,
  })

  async function handleSave() {
    if (!form.time_slot_id || !form.role_id) {
      toast({ title: 'Seleziona fascia e ruolo', variant: 'destructive' })
      return
    }
    setLoading(true)
    const { error } = await supabase.from('service_requirements').upsert(form, {
      onConflict: 'time_slot_id,role_id',
    })
    setLoading(false)
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Requisito aggiunto' })
      router.refresh()
      onClose()
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Fascia oraria</Label>
        <Select value={form.time_slot_id} onValueChange={(v) => setForm({ ...form, time_slot_id: v })}>
          <SelectTrigger><SelectValue placeholder="Seleziona fascia" /></SelectTrigger>
          <SelectContent>
            {timeSlots.map((ts) => <SelectItem key={ts.id} value={ts.id}>{ts.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Ruolo</Label>
        <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v })}>
          <SelectTrigger><SelectValue placeholder="Seleziona ruolo" /></SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                  {r.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Minimo richiesto</Label>
          <Input
            type="number" min={0} max={20}
            value={form.min_count}
            onChange={(e) => setForm({ ...form, min_count: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label>Numero ideale</Label>
          <Input
            type="number" min={0} max={20}
            value={form.ideal_count}
            onChange={(e) => setForm({ ...form, ideal_count: Number(e.target.value) })}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Annulla</Button>
        <Button onClick={handleSave} disabled={loading}>{loading ? 'Salvataggio...' : 'Salva'}</Button>
      </DialogFooter>
    </div>
  )
}

export function ServiceRequirementManager({ requirements, timeSlots, roles }: ServiceRequirementManagerProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)

  async function handleDelete(id: string) {
    const { error } = await supabase.from('service_requirements').delete().eq('id', id)
    if (error) toast({ title: 'Errore', description: error.message, variant: 'destructive' })
    else router.refresh()
  }

  // Group by time slot
  const grouped = timeSlots.map((ts) => ({
    slot: ts,
    reqs: requirements.filter((r) => r.time_slot_id === ts.id),
  })).filter((g) => g.reqs.length > 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Aggiungi requisito
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuovo requisito di servizio</DialogTitle></DialogHeader>
            <AddRequirementDialog timeSlots={timeSlots} roles={roles} onClose={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-400">
            Nessun requisito configurato
          </CardContent>
        </Card>
      ) : (
        grouped.map(({ slot, reqs }) => (
          <Card key={slot.id}>
            <CardHeader>
              <CardTitle className="text-sm">{slot.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs border-b">
                    <th className="pb-2">Ruolo</th>
                    <th className="pb-2 text-center">Minimo</th>
                    <th className="pb-2 text-center">Ideale</th>
                    <th className="pb-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reqs.map((req) => (
                    <tr key={req.id}>
                      <td className="py-2">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: req.roles?.color ?? '#999' }} />
                          {req.roles?.name ?? '?'}
                        </span>
                      </td>
                      <td className="py-2 text-center font-medium">{req.min_count}</td>
                      <td className="py-2 text-center font-medium">{req.ideal_count}</td>
                      <td className="py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(req.id)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
