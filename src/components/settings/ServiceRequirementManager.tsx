'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/types'
import { useToast } from '@/hooks/use-toast'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

interface Requirement {
  id: string
  time_slot_id: string
  role_id: string
  min_count: number
  ideal_count: number
  days_of_week: Json | null
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

interface RequirementForm {
  time_slot_id: string
  role_id: string
  min_count: number
  ideal_count: number
  days_of_week: number[]
}

function RequirementDialog({
  timeSlots,
  roles,
  initial,
  editId,
  onClose,
}: {
  timeSlots: TimeSlot[]
  roles: Role[]
  initial?: RequirementForm
  editId?: string
  onClose: () => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState<RequirementForm>(initial ?? {
    time_slot_id: '',
    role_id: '',
    min_count: 1,
    ideal_count: 2,
    days_of_week: ALL_DAYS,
  })

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(day)
        ? f.days_of_week.filter((d) => d !== day)
        : [...f.days_of_week, day],
    }))
  }

  async function handleSave() {
    if (!form.time_slot_id || !form.role_id) {
      toast({ title: 'Seleziona fascia e ruolo', variant: 'destructive' })
      return
    }
    if (form.days_of_week.length === 0) {
      toast({ title: 'Seleziona almeno un giorno', variant: 'destructive' })
      return
    }
    setLoading(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = { ...form, days_of_week: form.days_of_week as any }

    let error
    if (editId) {
      ;({ error } = await supabase.from('service_requirements').update(payload).eq('id', editId))
    } else {
      ;({ error } = await supabase.from('service_requirements').upsert(
        { ...payload },
        { onConflict: 'time_slot_id,role_id' },
      ))
    }
    setLoading(false)
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: editId ? 'Requisito aggiornato' : 'Requisito aggiunto' })
      router.refresh()
      onClose()
    }
  }

  const isAllDays = form.days_of_week.length === 7

  return (
    <div className="space-y-4">
      {!editId && (
        <>
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
        </>
      )}

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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Giorni validi</Label>
          <button
            type="button"
            className="text-xs text-indigo-600 hover:underline"
            onClick={() => setForm({ ...form, days_of_week: isAllDays ? [] : ALL_DAYS })}
          >
            {isAllDays ? 'Deseleziona tutti' : 'Seleziona tutti'}
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {DAY_LABELS.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleDay(i)}
              className={cn(
                'px-2.5 py-1 rounded border text-xs font-medium transition-colors',
                form.days_of_week.includes(i)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-500 hover:border-indigo-300'
              )}
            >
              {label}
            </button>
          ))}
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
  const [addOpen, setAddOpen] = React.useState(false)
  const [editReq, setEditReq] = React.useState<Requirement | null>(null)

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

  function daysSummary(days: number[] | null) {
    const d = days ?? ALL_DAYS
    if (d.length === 7) return 'Tutti i giorni'
    if (d.length === 0) return '—'
    return d.map((i) => DAY_LABELS[i]).join(', ')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Aggiungi requisito
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuovo requisito di servizio</DialogTitle></DialogHeader>
            <RequirementDialog timeSlots={timeSlots} roles={roles} onClose={() => setAddOpen(false)} />
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
                    <th className="pb-2 text-center">Min</th>
                    <th className="pb-2 text-center">Ideale</th>
                    <th className="pb-2">Giorni</th>
                    <th className="pb-2 w-16" />
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
                      <td className="py-2 text-xs text-gray-500">{daysSummary(req.days_of_week as number[] | null)}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditReq(req)}
                            className="text-gray-400 hover:text-indigo-600"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(req.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))
      )}

      {/* Edit dialog */}
      {editReq && (
        <Dialog open={!!editReq} onOpenChange={(o) => { if (!o) setEditReq(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Modifica requisito — {editReq.time_slots?.name} · {editReq.roles?.name}
              </DialogTitle>
            </DialogHeader>
            <RequirementDialog
              timeSlots={timeSlots}
              roles={roles}
              editId={editReq.id}
              initial={{
                time_slot_id: editReq.time_slot_id,
                role_id: editReq.role_id,
                min_count: editReq.min_count,
                ideal_count: editReq.ideal_count,
                days_of_week: (editReq.days_of_week as number[] | null) ?? ALL_DAYS,
              }}
              onClose={() => setEditReq(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
