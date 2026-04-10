'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Power } from 'lucide-react'
import { formatTime } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface TimeSlot {
  id: string
  name: string
  start_time: string
  end_time: string
  slot_type: string
  is_active: boolean
}

const SLOT_TYPE_LABELS: Record<string, string> = {
  prep: 'Preparazione',
  service: 'Servizio',
  cleanup: 'Pulizia',
}

const SLOT_TYPE_COLORS: Record<string, string> = {
  prep: 'warning',
  service: 'default',
  cleanup: 'secondary',
}

interface TimeSlotFormData {
  name: string
  start_time: string
  end_time: string
  slot_type: string
}

function TimeSlotDialog({
  slot,
  onClose,
}: {
  slot?: TimeSlot
  onClose: () => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState<TimeSlotFormData>({
    name: slot?.name ?? '',
    start_time: slot?.start_time?.slice(0, 5) ?? '',
    end_time: slot?.end_time?.slice(0, 5) ?? '',
    slot_type: slot?.slot_type ?? 'service',
  })

  async function handleSave() {
    if (!form.name || !form.start_time || !form.end_time) {
      toast({ title: 'Compila tutti i campi', variant: 'destructive' })
      return
    }
    setLoading(true)
    const dbForm = { ...form, slot_type: form.slot_type as import('@/lib/supabase/types').SlotType }
    const { error } = slot
      ? await supabase.from('time_slots').update(dbForm).eq('id', slot.id)
      : await supabase.from('time_slots').insert({ ...dbForm, is_active: true })

    setLoading(false)
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: slot ? 'Fascia aggiornata' : 'Fascia creata' })
      router.refresh()
      onClose()
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Nome</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Es. Pranzo" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Inizio</Label>
          <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Fine</Label>
          <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Tipo</Label>
        <Select value={form.slot_type} onValueChange={(v) => setForm({ ...form, slot_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(SLOT_TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Annulla</Button>
        <Button onClick={handleSave} disabled={loading}>{loading ? 'Salvataggio...' : 'Salva'}</Button>
      </DialogFooter>
    </div>
  )
}

interface TimeSlotManagerProps {
  timeSlots: TimeSlot[]
}

export function TimeSlotManager({ timeSlots }: TimeSlotManagerProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()
  const [editSlot, setEditSlot] = React.useState<TimeSlot | undefined>()
  const [dialogOpen, setDialogOpen] = React.useState(false)

  async function toggleActive(slot: TimeSlot) {
    const { error } = await supabase.from('time_slots').update({ is_active: !slot.is_active }).eq('id', slot.id)
    if (error) toast({ title: 'Errore', description: error.message, variant: 'destructive' })
    else router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex justify-end">
          <Dialog open={dialogOpen && !editSlot} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditSlot(undefined) }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditSlot(undefined)}>
                <Plus className="w-4 h-4 mr-1" /> Nuova fascia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuova fascia oraria</DialogTitle></DialogHeader>
              <TimeSlotDialog onClose={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-2">
          {timeSlots.map((slot) => (
            <div key={slot.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium text-sm">{slot.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                  </p>
                </div>
                <Badge variant={(SLOT_TYPE_COLORS[slot.slot_type] ?? 'secondary') as 'default' | 'secondary' | 'warning'}>
                  {SLOT_TYPE_LABELS[slot.slot_type] ?? slot.slot_type}
                </Badge>
                {!slot.is_active && <Badge variant="secondary">Inattiva</Badge>}
              </div>
              <div className="flex items-center gap-1">
                <Dialog open={dialogOpen && editSlot?.id === slot.id} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditSlot(undefined) }}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => { setEditSlot(slot); setDialogOpen(true) }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Modifica fascia oraria</DialogTitle></DialogHeader>
                    <TimeSlotDialog slot={editSlot} onClose={() => setDialogOpen(false)} />
                  </DialogContent>
                </Dialog>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleActive(slot)}
                  className={slot.is_active ? 'text-gray-400' : 'text-green-600'}
                >
                  <Power className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
