'use client'

import * as React from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { ShiftCard } from './ShiftCard'
import { ShiftDialog } from './ShiftDialog'
import { PublishDialog } from './PublishDialog'
import { CoverageIndicator } from './CoverageIndicator'
import { WeekNavigator } from './WeekNavigator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { updateShift, copyWeekSchedule, resetWeekSchedule, getMonthShifts, revertToPublished } from '@/app/actions/shifts'
import { useToast } from '@/hooks/use-toast'
import { Plus, Send, Copy, RotateCcw, FileDown } from 'lucide-react'
import { formatTime, dayOfWeekLabel, getISOWeekNumber, getWeekDates } from '@/lib/utils'
import { downloadWeeklyPDF, downloadMonthlyPDF } from '@/lib/pdf'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface ShiftData {
  id: string
  employee_id: string
  time_slot_id: string
  role_id: string
  date: string
  status: string
  updated_at: string
  is_split_shift: boolean
  notes: string | null
  employees: { first_name: string; last_name: string } | null
  roles: { name: string; color: string } | null
}

interface TimeSlot {
  id: string
  name: string
  start_time: string
  end_time: string
  slot_type: string
}

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

interface ServiceReq {
  time_slot_id: string
  role_id: string
  min_count: number
  ideal_count: number
  days_of_week: number[] | null
  roles: { name: string; color: string } | null
}

interface ShiftPlannerProps {
  weekStart: Date
  weekDates: Date[]
  scheduleId: string
  scheduleStatus: string
  publishedAt: string | null
  shifts: ShiftData[]
  timeSlots: TimeSlot[]
  employees: Employee[]
  serviceRequirements: ServiceReq[]
  canEdit: boolean
}

// Droppable cell
function PlannerCell({
  slotId,
  dateStr,
  children,
  onClick,
  canEdit,
}: {
  slotId: string
  dateStr: string
  children: React.ReactNode
  onClick: () => void
  canEdit: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${slotId}::${dateStr}`,
    data: { slotId, dateStr },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[80px] min-w-0 p-1.5 space-y-1 border-r border-b transition-colors',
        isOver && 'bg-indigo-50',
        canEdit && 'cursor-pointer hover:bg-gray-50'
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

// Draggable employee chip
function DraggableEmployee({ emp }: { emp: Employee }) {
  const primary = emp.employee_roles.find((r) => r.is_primary) ?? emp.employee_roles[0]
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `emp::${emp.id}`,
    data: { type: 'employee', employeeId: emp.id },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm cursor-grab select-none shadow-sm whitespace-nowrap transition-opacity',
        isDragging && 'opacity-40'
      )}
    >
      {primary?.roles && (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: primary.roles.color }} />
      )}
      <span className="font-medium">{emp.first_name} {emp.last_name}</span>
      {primary?.roles && (
        <span className="text-xs text-gray-400">{primary.roles.name}</span>
      )}
    </div>
  )
}

export function ShiftPlanner({
  weekStart,
  weekDates,
  scheduleId,
  scheduleStatus,
  publishedAt,
  shifts,
  timeSlots,
  employees,
  serviceRequirements,
  canEdit,
}: ShiftPlannerProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [publishOpen, setPublishOpen] = React.useState(false)
  const [copyOpen, setCopyOpen] = React.useState(false)
  const [resetOpen, setResetOpen] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)
  const [pdfLoading, setPdfLoading] = React.useState(false)
  const [hasLocalChanges, setHasLocalChanges] = React.useState(false)
  const [revertOpen, setRevertOpen] = React.useState(false)
  const [reverting, setReverting] = React.useState(false)
  const [selectedWeeks, setSelectedWeeks] = React.useState<Set<string>>(new Set())
  const [copying, setCopying] = React.useState(false)
  const [selectedCell, setSelectedCell] = React.useState<{ slotId: string; date: string } | null>(null)
  const [editShiftId, setEditShiftId] = React.useState<string | undefined>()
  const [prefillEmployeeId, setPrefillEmployeeId] = React.useState<string | undefined>()
  const [activeShift, setActiveShift] = React.useState<ShiftData | null>(null)
  const [activeEmployee, setActiveEmployee] = React.useState<Employee | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Detect unpublished changes on a published schedule
  const hasDraftChanges = React.useMemo(() => {
    if (scheduleStatus !== 'published') return false
    if (shifts.some((s) => s.status === 'draft')) return true
    if (publishedAt && shifts.some((s) => s.updated_at > publishedAt)) return true
    return false
  }, [shifts, scheduleStatus, publishedAt])

  const showDraftBadge = hasDraftChanges || hasLocalChanges

  // Group shifts by slotId + date
  const shiftMap = React.useMemo(() => {
    const map: Record<string, ShiftData[]> = {}
    for (const shift of shifts) {
      const key = `${shift.time_slot_id}::${shift.date}`
      if (!map[key]) map[key] = []
      map[key].push(shift)
    }
    return map
  }, [shifts])

  // Coverage per cell, filtered by day of week
  const coverageMap = React.useMemo(() => {
    const map: Record<string, Array<{ role_id: string; role_name: string; min_count: number; ideal_count: number; assigned_count: number }>> = {}
    for (const ts of timeSlots) {
      for (const date of weekDates) {
        const dateStr = date.toISOString().split('T')[0]
        const key = `${ts.id}::${dateStr}`
        const cellShifts = shiftMap[key] ?? []
        const dayOfWeek = date.getDay()
        const reqs = serviceRequirements.filter((r) => {
          if (r.time_slot_id !== ts.id) return false
          const days = r.days_of_week ?? [0, 1, 2, 3, 4, 5, 6]
          return days.length === 0 || days.includes(dayOfWeek)
        })
        map[key] = reqs.map((req) => ({
          role_id: req.role_id,
          role_name: req.roles?.name ?? '?',
          min_count: req.min_count,
          ideal_count: req.ideal_count,
          assigned_count: cellShifts.filter((s) => s.role_id === req.role_id).length,
        }))
      }
    }
    return map
  }, [shiftMap, timeSlots, weekDates, serviceRequirements])

  // Generate 20 upcoming weeks for the copy dialog
  const targetWeeks = React.useMemo(() => {
    const weeks: Array<{ weekStart: string; weekEnd: string; weekNum: number; label: string }> = []
    const fmt = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    for (let i = 1; i <= 20; i++) {
      const start = new Date(weekStart)
      start.setUTCDate(start.getUTCDate() + i * 7)
      const end = new Date(start)
      end.setUTCDate(start.getUTCDate() + 6)
      weeks.push({
        weekStart: start.toISOString().split('T')[0],
        weekEnd: end.toISOString().split('T')[0],
        weekNum: getISOWeekNumber(start),
        label: `Sett. ${getISOWeekNumber(start)} · ${fmt(start)} – ${fmt(end)} ${end.getUTCFullYear()}`,
      })
    }
    return weeks
  }, [weekStart])

  function openAddDialog(slotId: string, date: string, employeeId?: string) {
    if (!canEdit) return
    setSelectedCell({ slotId, date })
    setEditShiftId(undefined)
    setPrefillEmployeeId(employeeId)
    setDialogOpen(true)
  }

  function openEditDialog(shiftId: string, slotId: string, date: string) {
    setSelectedCell({ slotId, date })
    setEditShiftId(shiftId)
    setPrefillEmployeeId(undefined)
    setDialogOpen(true)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveShift(null)
    setActiveEmployee(null)
    if (!over) return

    const activeData = active.data.current as { type?: string; employeeId?: string } | undefined

    if (activeData?.type === 'employee') {
      // Employee dropped onto a cell → open dialog pre-filled
      const cellId = String(over.id)
      if (!cellId.includes('::')) return
      const [newSlotId, newDate] = cellId.split('::')
      openAddDialog(newSlotId, newDate, activeData.employeeId)
      return
    }

    // Shift drag
    if (active.id === over.id) return
    const [newSlotId, newDate] = String(over.id).split('::')
    const shift = shifts.find((s) => s.id === active.id)
    if (!shift || (shift.time_slot_id === newSlotId && shift.date === newDate)) return

    const result = await updateShift(String(active.id), {
      time_slot_id: newSlotId,
      date: newDate,
    })
    if (result.error) {
      toast({ title: 'Errore nello spostamento', description: result.error, variant: 'destructive' })
    } else if (scheduleStatus === 'published') {
      setHasLocalChanges(true)
    }
  }

  async function handleCopyWeek() {
    if (selectedWeeks.size === 0) return
    setCopying(true)
    let firstCopied: string | undefined
    for (const ws of [...selectedWeeks].sort()) {
      const result = await copyWeekSchedule(scheduleId, ws)
      if (result.error) {
        toast({ title: 'Errore', description: result.error, variant: 'destructive' })
        setCopying(false)
        return
      }
      if (!firstCopied) firstCopied = ws
    }
    setCopying(false)
    toast({
      title: 'Copia completata!',
      description: `Turni copiati in ${selectedWeeks.size} settiman${selectedWeeks.size === 1 ? 'a' : 'e'}.`,
    })
    setCopyOpen(false)
    setSelectedWeeks(new Set())
    if (firstCopied) router.push(`/dashboard/turni?week=${firstCopied}`)
  }

  async function handleReset() {
    setResetting(true)
    const result = await resetWeekSchedule(scheduleId)
    setResetting(false)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Settimana resettata', description: 'Tutti i turni sono stati eliminati.' })
      setResetOpen(false)
    }
  }

  function handleWeeklyPDF() {
    downloadWeeklyPDF({ weekDates, timeSlots, shifts })
  }

  async function handleMonthlyPDF() {
    setPdfLoading(true)
    const year = weekStart.getUTCFullYear()
    const month = weekStart.getUTCMonth() + 1
    const result = await getMonthShifts(year, month)
    setPdfLoading(false)
    if (result.error || !result.data) {
      toast({ title: 'Errore PDF', description: result.error ?? 'Errore sconosciuto', variant: 'destructive' })
      return
    }
    const weeks = result.data.weeks.map((w) => ({
      ...w,
      weekDates: getWeekDates(new Date(w.weekStart + 'T00:00:00Z')),
    }))
    downloadMonthlyPDF({ year, month, timeSlots: result.data.timeSlots, weeks })
  }

  async function handleRevert() {
    setReverting(true)
    const result = await revertToPublished(scheduleId)
    setReverting(false)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      setHasLocalChanges(false)
      setRevertOpen(false)
      toast({ title: 'Ripristinato', description: 'Turni ripristinati all\'ultima versione pubblicata.' })
    }
  }

  const uniqueEmployees = [...new Set(shifts.map((s) => s.employee_id))]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <WeekNavigator weekStart={weekStart} />
        <div className="flex items-center gap-2">
          <Badge variant={showDraftBadge ? 'warning' : scheduleStatus === 'published' ? 'success' : scheduleStatus === 'archived' ? 'secondary' : 'warning'}>
            {showDraftBadge ? 'Modifiche non pubblicate' : scheduleStatus === 'draft' ? 'Bozza' : scheduleStatus === 'published' ? 'Pubblicato' : 'Archiviato'}
          </Badge>
          {showDraftBadge && scheduleStatus === 'published' && canEdit && (
            <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700" onClick={() => setRevertOpen(true)}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Ripristina
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset settimana
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)}>
              <Copy className="w-4 h-4 mr-2" />
              Copia settimana
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={pdfLoading}>
                <FileDown className="w-4 h-4 mr-2" />
                {pdfLoading ? 'Generazione…' : 'Scarica PDF'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleWeeklyPDF}>PDF settimanale</DropdownMenuItem>
              <DropdownMenuItem onClick={handleMonthlyPDF}>PDF mensile</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canEdit && scheduleStatus !== 'archived' && (
            <Button
              size="sm"
              onClick={() => setPublishOpen(true)}
            >
              <Send className="w-4 h-4 mr-2" />
              {scheduleStatus === 'published' ? 'Ripubblica' : 'Pubblica'}
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      <DndContext
        id="shift-planner"
        sensors={sensors}
        onDragStart={(e) => {
          const data = e.active.data.current as { type?: string; employeeId?: string } | undefined
          if (data?.type === 'employee') {
            setActiveEmployee(employees.find((emp) => emp.id === data.employeeId) ?? null)
          } else {
            setActiveShift(shifts.find((s) => s.id === e.active.id) ?? null)
          }
        }}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto rounded-lg border">
          <div className="min-w-[800px]">
            {/* Day headers */}
            <div className="grid bg-gray-50 border-b" style={{ gridTemplateColumns: '140px repeat(7, 1fr)' }}>
              <div className="px-3 py-2 text-xs font-medium text-gray-500 border-r">Fascia</div>
              {weekDates.map((date, i) => {
                const isToday = date.toDateString() === new Date().toDateString()
                return (
                  <div
                    key={i}
                    className={cn(
                      'px-2 py-2 text-center text-xs font-medium border-r last:border-r-0',
                      isToday ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600'
                    )}
                  >
                    <div className="font-semibold">{dayOfWeekLabel(date.getDay() === 0 ? 0 : date.getDay())}</div>
                    <div className={cn('text-lg font-bold', isToday ? 'text-indigo-600' : 'text-gray-900')}>
                      {date.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Rows per time slot */}
            {timeSlots.map((slot) => (
              <div key={slot.id} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: '140px repeat(7, 1fr)' }}>
                {/* Slot label */}
                <div className="px-3 py-2 border-r bg-gray-50">
                  <p className="text-xs font-semibold text-gray-700">{slot.name}</p>
                  <p className="text-[10px] text-gray-400">
                    {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                  </p>
                </div>

                {/* Cells */}
                {weekDates.map((date) => {
                  const dateStr = date.toISOString().split('T')[0]
                  const key = `${slot.id}::${dateStr}`
                  const cellShifts = shiftMap[key] ?? []
                  const coverage = coverageMap[key] ?? []

                  return (
                    <PlannerCell
                      key={dateStr}
                      slotId={slot.id}
                      dateStr={dateStr}
                      onClick={() => openAddDialog(slot.id, dateStr)}
                      canEdit={canEdit}
                    >
                      {coverage.length > 0 && (
                        <div className="flex justify-end mb-0.5">
                          <CoverageIndicator requirements={coverage} />
                        </div>
                      )}

                      {cellShifts.map((shift) => (
                        <ShiftCard
                          key={shift.id}
                          shift={{
                            id: shift.id,
                            employee_name: shift.employees
                              ? `${shift.employees.first_name} ${shift.employees.last_name}`
                              : '?',
                            role_name: shift.roles?.name ?? '?',
                            role_color: shift.roles?.color ?? '#6366f1',
                            status: shift.status,
                            is_split_shift: shift.is_split_shift,
                          }}
                          onClick={(id) => openEditDialog(id, slot.id, dateStr)}
                        />
                      ))}

                      {canEdit && cellShifts.length === 0 && (
                        <button
                          type="button"
                          className="w-full flex items-center justify-center py-1 text-gray-300 hover:text-indigo-400 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            openAddDialog(slot.id, dateStr)
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </PlannerCell>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeShift && (
            <div
              className="px-2 py-1 rounded border-l-2 bg-white shadow-lg text-xs font-medium"
              style={{ borderLeftColor: activeShift.roles?.color ?? '#6366f1' }}
            >
              {activeShift.employees
                ? `${activeShift.employees.first_name} ${activeShift.employees.last_name}`
                : '?'}
            </div>
          )}
          {activeEmployee && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm shadow-lg">
              {(() => {
                const p = activeEmployee.employee_roles.find((r) => r.is_primary) ?? activeEmployee.employee_roles[0]
                return p?.roles ? <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.roles.color }} /> : null
              })()}
              <span className="font-medium">{activeEmployee.first_name} {activeEmployee.last_name}</span>
            </div>
          )}
        </DragOverlay>

        {/* Employee DnD panel */}
        {canEdit && employees.length > 0 && (
          <div className="space-y-2 mt-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Dipendenti — trascina sulla cella per assegnare rapidamente
            </p>
            <div className="flex gap-2 flex-wrap">
              {employees.map((emp) => (
                <DraggableEmployee key={emp.id} emp={emp} />
              ))}
            </div>
          </div>
        )}
      </DndContext>

      {/* Shift dialog */}
      {selectedCell && (
        <ShiftDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          scheduleId={scheduleId}
          date={selectedCell.date}
          timeSlotId={selectedCell.slotId}
          employees={employees}
          timeSlots={timeSlots}
          editShiftId={editShiftId}
          initialEmployeeId={prefillEmployeeId}
          onSuccess={() => {
            if (scheduleStatus === 'published') setHasLocalChanges(true)
          }}
        />
      )}

      {/* Publish dialog */}
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        scheduleId={scheduleId}
        scheduleStatus={scheduleStatus}
        shiftCount={shifts.filter((s) => s.status === 'draft').length}
        employeeCount={uniqueEmployees.length}
        onSuccess={() => setHasLocalChanges(false)}
      />

      {/* Copy week dialog */}
      <Dialog open={copyOpen} onOpenChange={(o) => { setCopyOpen(o); if (!o) setSelectedWeeks(new Set()) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Copia settimana</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Seleziona le settimane di destinazione. I turni esistenti in bozza verranno sostituiti.
            </p>
            <div className="max-h-64 overflow-y-auto space-y-0.5 border rounded-lg p-1.5">
              {targetWeeks.map((w) => {
                const checked = selectedWeeks.has(w.weekStart)
                return (
                  <label
                    key={w.weekStart}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors select-none',
                      checked ? 'bg-indigo-50 text-indigo-800' : 'hover:bg-gray-50 text-gray-700'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = new Set(selectedWeeks)
                        if (next.has(w.weekStart)) next.delete(w.weekStart)
                        else next.add(w.weekStart)
                        setSelectedWeeks(next)
                      }}
                      className="rounded accent-indigo-600"
                    />
                    {w.label}
                  </label>
                )
              })}
            </div>
            {selectedWeeks.size > 0 && (
              <p className="text-xs text-indigo-600 font-medium">
                {selectedWeeks.size} settiman{selectedWeeks.size === 1 ? 'a' : 'e'} selezionat{selectedWeeks.size === 1 ? 'a' : 'e'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCopyOpen(false); setSelectedWeeks(new Set()) }}>Annulla</Button>
            <Button onClick={handleCopyWeek} disabled={selectedWeeks.size === 0 || copying}>
              {copying ? 'Copia in corso...' : `Copia${selectedWeeks.size > 0 ? ` (${selectedWeeks.size})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset week dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset settimana</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Questa operazione elimina <strong>tutti i turni</strong> della settimana,
            inclusi quelli già pubblicati. I dipendenti non riceveranno notifica automatica.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Annulla</Button>
            <Button variant="destructive" onClick={handleReset} disabled={resetting}>
              {resetting ? 'Eliminazione…' : 'Elimina tutto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert to last published dialog */}
      <Dialog open={revertOpen} onOpenChange={setRevertOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ripristina ultima pubblicazione</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Verranno annullate tutte le modifiche apportate dall&apos;ultima pubblicazione.
            I dipendenti non riceveranno notifica.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertOpen(false)}>Annulla</Button>
            <Button variant="destructive" onClick={handleRevert} disabled={reverting}>
              {reverting ? 'Ripristino…' : 'Ripristina'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
