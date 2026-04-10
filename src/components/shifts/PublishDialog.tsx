'use client'

import * as React from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { publishSchedule } from '@/app/actions/shifts'
import { useToast } from '@/hooks/use-toast'
import { Mail, CheckCircle2 } from 'lucide-react'

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
  shiftCount: number
  employeeCount: number
  onSuccess?: () => void
}

export function PublishDialog({
  open, onOpenChange, scheduleId, shiftCount, employeeCount, onSuccess,
}: PublishDialogProps) {
  const { toast } = useToast()
  const [sendEmail, setSendEmail] = React.useState(true)
  const [loading, setLoading] = React.useState(false)

  async function handlePublish() {
    setLoading(true)
    const result = await publishSchedule(scheduleId, sendEmail)
    setLoading(false)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Turni pubblicati!', description: sendEmail ? `Notifiche inviate a ${employeeCount} dipendenti.` : undefined })
      onSuccess?.()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pubblica turni settimanali</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-blue-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <CheckCircle2 className="w-4 h-4" />
              <span><strong>{shiftCount}</strong> turni verranno pubblicati</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <CheckCircle2 className="w-4 h-4" />
              <span><strong>{employeeCount}</strong> dipendenti coinvolti</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSendEmail(!sendEmail)}
            className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-colors ${
              sendEmail ? 'bg-indigo-50 border-indigo-300' : 'border-gray-200'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              sendEmail ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
            }`}>
              {sendEmail && <CheckCircle2 className="w-3 h-3 text-white" />}
            </div>
            <Mail className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700">Invia email ai dipendenti</span>
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handlePublish} disabled={loading}>
            {loading ? 'Pubblicazione...' : 'Pubblica'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
