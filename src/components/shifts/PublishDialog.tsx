'use client'

import * as React from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { publishSchedule, checkScheduleHours } from '@/app/actions/shifts'
import type { EmployeeHoursCheck } from '@/app/actions/shifts'
import { useToast } from '@/hooks/use-toast'
import { Mail, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
  scheduleStatus: string
  shiftCount: number
  employeeCount: number
  onSuccess?: () => void
}

export function PublishDialog({
  open, onOpenChange, scheduleId, scheduleStatus, shiftCount, employeeCount, onSuccess,
}: PublishDialogProps) {
  const { toast } = useToast()
  const [sendNotification, setSendNotification] = React.useState(true)
  const [loading, setLoading] = React.useState(false)
  const [checking, setChecking] = React.useState(false)
  const [underHours, setUnderHours] = React.useState<EmployeeHoursCheck[]>([])

  // Check hours whenever dialog opens
  React.useEffect(() => {
    if (!open) return
    setUnderHours([])
    setChecking(true)
    checkScheduleHours(scheduleId).then(({ data }) => {
      setUnderHours(data.filter(e => e.contracted_hours > 0 && e.deficit < 0))
      setChecking(false)
    })
  }, [open, scheduleId])

  const isRepublish = scheduleStatus === 'published'

  async function handlePublish() {
    setLoading(true)
    const result = await publishSchedule(scheduleId, sendNotification)
    setLoading(false)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      toast({
        title: isRepublish ? 'Turni ripubblicati!' : 'Turni pubblicati!',
        description: sendNotification
          ? isRepublish
            ? 'Email inviate ai dipendenti con turni modificati.'
            : `Email inviate a ${employeeCount} dipendenti.`
          : undefined,
      })
      onSuccess?.()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isRepublish ? 'Ripubblica turni settimanali' : 'Pubblica turni settimanali'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-blue-50 rounded-lg p-3 space-y-2">
            {isRepublish ? (
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>Le modifiche successive all&apos;ultima pubblicazione verranno rese definitive.</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span><strong>{shiftCount}</strong> turni verranno pubblicati</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span><strong>{employeeCount}</strong> dipendenti coinvolti</span>
                </div>
              </>
            )}
          </div>

          {/* Hours warning */}
          {checking && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifica ore contrattuali…
            </div>
          )}
          {!checking && underHours.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {underHours.length === 1
                  ? '1 dipendente non raggiunge le ore contrattuali'
                  : `${underHours.length} dipendenti non raggiungono le ore contrattuali`}
              </div>
              <ul className="space-y-1">
                {underHours.map(e => (
                  <li key={e.employee_id} className="text-xs text-amber-700 flex justify-between gap-2">
                    <span>{e.employee_name}</span>
                    <span className="font-medium tabular-nums">
                      {e.total_hours.toFixed(1)}/{e.contracted_hours}h
                      <span className="text-amber-500 ml-1">({e.deficit.toFixed(1)}h)</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-600">Puoi comunque procedere con la pubblicazione.</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setSendNotification(!sendNotification)}
            className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-colors ${
              sendNotification ? 'bg-indigo-50 border-indigo-300' : 'border-gray-200'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              sendNotification ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
            }`}>
              {sendNotification && <CheckCircle2 className="w-3 h-3 text-white" />}
            </div>
            <Mail className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700">
              {isRepublish ? 'Notifica i dipendenti con turni modificati' : 'Invia email ai dipendenti'}
            </span>
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handlePublish} disabled={loading || checking}>
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Pubblicazione…</>
              : isRepublish ? 'Ripubblica' : 'Pubblica'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
