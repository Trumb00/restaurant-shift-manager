'use client'

import * as React from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { reviewVacation } from '@/app/actions/vacations'
import { useToast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'

interface VacationItem {
  id: string
  employee_name?: string
  start_date: string
  end_date: string
  type: string
  reason: string | null
}

interface VacationApprovalDialogProps {
  vacation: VacationItem | null
  action: 'approved' | 'rejected'
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VacationApprovalDialog({ vacation, action, open, onOpenChange }: VacationApprovalDialogProps) {
  const { toast } = useToast()
  const [notes, setNotes] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) setNotes('')
  }, [open])

  async function handleSubmit() {
    if (!vacation) return
    setLoading(true)
    const result = await reviewVacation(vacation.id, action, notes)
    setLoading(false)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: action === 'approved' ? 'Richiesta approvata' : 'Richiesta rifiutata' })
      onOpenChange(false)
    }
  }

  if (!vacation) return null

  const isApproving = action === 'approved'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isApproving ? 'Approva richiesta' : 'Rifiuta richiesta'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            {vacation.employee_name && (
              <p><strong>Dipendente:</strong> {vacation.employee_name}</p>
            )}
            <p><strong>Periodo:</strong> {formatDate(vacation.start_date)} – {formatDate(vacation.end_date)}</p>
            <p><strong>Tipo:</strong> {vacation.type}</p>
            {vacation.reason && <p><strong>Motivo:</strong> {vacation.reason}</p>}
          </div>

          <div className="space-y-1">
            <Label>{isApproving ? 'Note (opzionale)' : 'Motivazione rifiuto'}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isApproving ? 'Note aggiuntive...' : 'Spiega il motivo del rifiuto...'}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || (!isApproving && !notes.trim())}
            variant={isApproving ? 'default' : 'destructive'}
          >
            {loading ? 'Salvataggio...' : isApproving ? 'Approva' : 'Rifiuta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
