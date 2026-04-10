'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { reportAbsence } from '@/app/actions/absences'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'

interface ShiftOption {
  id: string
  date: string
  time_slot_name: string
  start_time: string
  end_time: string
}

interface AbsenceReportDialogProps {
  shifts: ShiftOption[]
}

export function AbsenceReportDialog({ shifts }: AbsenceReportDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [shiftId, setShiftId] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setShiftId('')
      setReason('')
    }
  }, [open])

  async function handleSubmit() {
    if (!shiftId) {
      toast({ title: 'Seleziona un turno', variant: 'destructive' })
      return
    }
    setLoading(true)
    const result = await reportAbsence(shiftId, reason)
    setLoading(false)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Assenza segnalata', description: 'Il manager è stato notificato.' })
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <AlertCircle className="w-4 h-4 mr-2" /> Segnala assenza
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Segnala assenza</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Turno da cancellare</Label>
            <Select value={shiftId} onValueChange={setShiftId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona il turno..." />
              </SelectTrigger>
              <SelectContent>
                {shifts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {formatDate(s.date)} – {s.time_slot_name} ({formatTime(s.start_time)}–{formatTime(s.end_time)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="reason">Motivo</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Malattia, emergenza familiare..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={loading || !shiftId}>
            {loading ? 'Invio...' : 'Segnala'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
