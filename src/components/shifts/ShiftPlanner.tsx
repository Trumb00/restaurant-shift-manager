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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { updateShift, copyWeekSchedule } from '@/app/actions/shifts'
import { useToast } from '@/hooks/use-toast'
import { Plus, Send, Copy } from 'lucide-react'
import { formatTime, dayOfWeekLabel, getWeekStart } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface ShiftData {
  id: string
  employee_id: string
  time_slot_id: string
  role_id: string
  date: string
  status: string
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
        'min-h-[80px] p-1.5 space-y-1 border-r border-b transition-colors',
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
  const [targetDate, setTargetDate] = React.useState('')
  const [copying, setCopying] = React.useState(false)
  const [selectedCell, setSelectedCell] = React.useState<{ slotId: string; date: string } | null>(null)
  const [editShiftId, setEditShiftId] = React.useState<string | undefined>()
  const [prefillEmployeeId, setPrefillEmployeeId] = React.useState<string | undefined>()
  const [activeShift, setActiveShift] = React.useState<ShiftData | null>(null)
  const [activeEmployee, setActiveEmployee] = React.useState<Employee | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

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
    }
  }

  async function handleCopyWeek() {
    if (!targetDate) return
    setCopying(true)
    const targetWeekStart = getWeekStart(new Date(targetDate + 'T12:00:00')).toISOString().split('T')[0]
    const result = await copyWeekSchedule(scheduleId, targetWeekStart)
    setCopying(false)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Settimana copiata!', description: `Turni copiati nella settimana del ${targetWeekStart}` })
      setCopyOpen(false)
      setTargetDate('')
      router.push(`/dashboard/turni?week=${targetWeekStart}`)
    }
  }

  const uniqueEmployees = [...new Set(shifts.map((s) => s.employee_id))]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <WeekNavigator weekStart={weekStart} />
        <div className="flex items-center gap-2">
          <Badge variant={scheduleStatus === 'published' ? 'success' : scheduleStatus === 'archived' ? 'secondary' : 'warning'}>
            {scheduleStatus === 'draft' ? 'Bozza' : scheduleStatus === 'published' ? 'Pubblicato' : 'Archiviato'}
          </Badge>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)}>
              <Copy className="w-4 h-4 mr-2" />
              Copia settimana
            </Button>
          )}
          {canEdit && scheduleStatus !== 'archived' && (
            <Button
              size="sm"
              onClick={() => setPublishOpen(true)}
              disabled={scheduleStatus === 'published'}
            >
              <Send className="w-4 h-4 mr-2" />
              {scheduleStatus === 'published' ? 'Già pubblicato' : 'Pubblica'}
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      <DndContext
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
      </DndContext>

      {/* Employee DnD panel */}
      {canEdit && employees.length > 0 && (
        <div className="space-y-2">
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
        />
      )}

      {/* Publish dialog */}
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        scheduleId={scheduleId}
        shiftCount={shifts.filter((s) => s.status === 'draft').length}
        employeeCount={uniqueEmployees.length}
      />

      {/* Copy week dialog */}
      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Copia settimana</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Seleziona una data nella settimana di destinazione. I turni esistenti in bozza verranno sostituiti.
            </p>
            <div className="space-y-1">
              <Label>Data nella settimana di destinazione</Label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)}>Annulla</Button>
            <Button onClick={handleCopyWeek} disabled={!targetDate || copying}>
              {copying ? 'Copia in corso...' : 'Copia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
