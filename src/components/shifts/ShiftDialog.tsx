'use client'

import * as React from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { createShift, deleteShift, validateShiftConstraints } from '@/app/actions/shifts'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, Trash2, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Employee {
  id: string
  first_name: string
  last_name: string
  employee_roles: Array<{
    role_id: string
    is_primary: boolean
    roles: { id: string; name: string; color: string } | null
  }>
}

interface TimeSlot {
  id: string
  name: string
  start_time: string
  end_time: string
}

interface ShiftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
  date: string
  timeSlotId: string
  employees: Employee[]
  timeSlots: TimeSlot[]
  editShiftId?: string
  onSuccess?: () => void
}

export function ShiftDialog({
  open, onOpenChange, scheduleId, date, timeSlotId, employees, timeSlots, editShiftId, onSuccess,
}: ShiftDialogProps) {
  const { toast } = useToast()
  const [employeeId, setEmployeeId] = React.useState('')
  const [roleId, setRoleId] = React.useState('')
  const [slotId, setSlotId] = React.useState(timeSlotId)
  const [notes, setNotes] = React.useState('')
  const [isSplit, setIsSplit] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [errors, setErrors] = React.useState<string[]>([])
  const [warnings, setWarnings] = React.useState<string[]>([])

  React.useEffect(() => {
    if (open) {
      setEmployeeId('')
      setRoleId('')
      setSlotId(timeSlotId)
      setNotes('')
      setIsSplit(false)
      setErrors([])
      setWarnings([])
    }
  }, [open, timeSlotId])

  // Get available roles for selected employee
  const selectedEmployee = employees.find((e) => e.id === employeeId)
  const availableRoles = selectedEmployee?.employee_roles ?? []

  // Auto-select primary role
  React.useEffect(() => {
    if (!selectedEmployee) { setRoleId(''); return }
    const primary = selectedEmployee.employee_roles.find((r) => r.is_primary)
    setRoleId(primary?.role_id ?? selectedEmployee.employee_roles[0]?.role_id ?? '')
  }, [employeeId, selectedEmployee])

  async function handleValidate() {
    if (!employeeId || !roleId || !slotId) return
    const result = await validateShiftConstraints({
      schedule_id: scheduleId,
      employee_id: employeeId,
      time_slot_id: slotId,
      role_id: roleId,
      date,
    })
    setErrors(result.errors)
    setWarnings(result.warnings)
  }

  React.useEffect(() => {
    if (employeeId && roleId && slotId) {
      handleValidate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, roleId, slotId])

  async function handleSave() {
    if (!employeeId || !roleId || !slotId) {
      toast({ title: 'Campi mancanti', description: 'Seleziona dipendente, ruolo e fascia oraria.', variant: 'destructive' })
      return
    }
    if (errors.length > 0) {
      toast({ title: 'Vincoli violati', description: 'Correggi gli errori prima di salvare.', variant: 'destructive' })
      return
    }
    setLoading(true)
    const result = await createShift({
      schedule_id: scheduleId,
      employee_id: employeeId,
      time_slot_id: slotId,
      role_id: roleId,
      date,
      notes,
      is_split_shift: isSplit,
    })
    setLoading(false)
    if ('error' in result) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Turno aggiunto' })
      onSuccess?.()
      onOpenChange(false)
    }
  }

  async function handleDelete() {
    if (!editShiftId) return
    setDeleting(true)
    const result = await deleteShift(editShiftId)
    setDeleting(false)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Turno eliminato' })
      onSuccess?.()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editShiftId ? 'Modifica turno' : 'Aggiungi turno'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              {errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{e}</span>
                </div>
              ))}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-amber-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Fascia oraria */}
          <div className="space-y-1">
            <Label>Fascia oraria</Label>
            <Select value={slotId} onValueChange={setSlotId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((ts) => (
                  <SelectItem key={ts.id} value={ts.id}>
                    {ts.name} ({ts.start_time.slice(0, 5)}–{ts.end_time.slice(0, 5)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dipendente */}
          <div className="space-y-1">
            <Label>Dipendente</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona dipendente" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ruolo */}
          <div className="space-y-1">
            <Label>Ruolo</Label>
            <Select value={roleId} onValueChange={setRoleId} disabled={!employeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona ruolo" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r.role_id} value={r.role_id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: r.roles?.color ?? '#999' }}
                      />
                      {r.roles?.name}
                      {r.is_primary && <Badge variant="outline" className="text-xs ml-1">Primario</Badge>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div className="space-y-1">
            <Label>Note (opzionale)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note per il dipendente..."
              rows={2}
            />
          </div>

          {/* Split shift toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSplit(!isSplit)}
              className={cn(
                'flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors',
                isSplit
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'border-gray-200 text-gray-600'
              )}
            >
              <Link2 className="w-4 h-4" />
              Turno spezzato
            </button>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          {editShiftId && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {deleting ? 'Eliminazione...' : 'Elimina'}
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
            <Button onClick={handleSave} disabled={loading || errors.length > 0}>
              {loading ? 'Salvataggio...' : 'Salva'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
