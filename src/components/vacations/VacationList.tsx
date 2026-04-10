'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { VacationApprovalDialog } from './VacationApprovalDialog'
import { cancelVacation } from '@/app/actions/vacations'
import { useToast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'
import { Trash2 } from 'lucide-react'

interface VacationItem {
  id: string
  employee_id: string
  employee_name?: string
  start_date: string
  end_date: string
  type: string
  status: string
  reason: string | null
  requested_at: string
  reviewer_notes: string | null
}

const TYPE_LABELS: Record<string, string> = {
  ferie: 'Ferie',
  permesso: 'Permesso',
  malattia: 'Malattia',
  altro: 'Altro',
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'destructive' | 'warning' | 'secondary'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
}

interface VacationListProps {
  vacations: VacationItem[]
  canApprove?: boolean
  currentEmployeeId?: string
}

export function VacationList({ vacations, canApprove, currentEmployeeId }: VacationListProps) {
  const { toast } = useToast()
  const [approvalTarget, setApprovalTarget] = React.useState<VacationItem | null>(null)
  const [approvalAction, setApprovalAction] = React.useState<'approved' | 'rejected'>('approved')
  const [cancellingId, setCancellingId] = React.useState<string | null>(null)

  async function handleCancel(id: string) {
    setCancellingId(id)
    const result = await cancelVacation(id)
    setCancellingId(null)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Richiesta annullata' })
    }
  }

  if (vacations.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Nessuna richiesta trovata</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {vacations.map((v) => {
        const days =
          Math.floor((new Date(v.end_date).getTime() - new Date(v.start_date).getTime()) / 86400000) + 1
        const canCancel = v.employee_id === currentEmployeeId && v.status === 'pending'

        return (
          <div key={v.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              {v.employee_name && (
                <p className="font-medium text-gray-900">{v.employee_name}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{TYPE_LABELS[v.type] ?? v.type}</Badge>
                <span className="text-sm text-gray-600">
                  {formatDate(v.start_date)} – {formatDate(v.end_date)}
                </span>
                <span className="text-xs text-gray-400">({days} giorni)</span>
              </div>
              {v.reason && (
                <p className="text-sm text-gray-500">{v.reason}</p>
              )}
              {v.reviewer_notes && v.status === 'rejected' && (
                <p className="text-sm text-red-600">Nota: {v.reviewer_notes}</p>
              )}
              <p className="text-xs text-gray-400">Richiesta il {formatDate(v.requested_at)}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={STATUS_VARIANT[v.status] ?? 'secondary'}>
                {v.status === 'pending' ? 'In attesa' : v.status === 'approved' ? 'Approvata' : 'Rifiutata'}
              </Badge>

              {canApprove && v.status === 'pending' && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-700 hover:bg-green-50 border-green-200"
                    onClick={() => { setApprovalTarget(v); setApprovalAction('approved') }}
                  >
                    Approva
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => { setApprovalTarget(v); setApprovalAction('rejected') }}
                  >
                    Rifiuta
                  </Button>
                </div>
              )}

              {canCancel && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-red-500"
                  onClick={() => handleCancel(v.id)}
                  disabled={cancellingId === v.id}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        )
      })}

      <VacationApprovalDialog
        vacation={approvalTarget}
        action={approvalAction}
        open={!!approvalTarget}
        onOpenChange={(o) => !o && setApprovalTarget(null)}
      />
    </div>
  )
}
