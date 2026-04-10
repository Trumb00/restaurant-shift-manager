'use client'

import * as React from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { ShiftCard } from './ShiftCard'
import { ShiftDialog } from './ShiftDialog'
import { PublishDialog } from './PublishDialog'
import { CoverageIndicator } from './CoverageIndicator'
import { WeekNavigator } from './WeekNavigator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { updateShift } from '@/app/actions/shifts'
import { useToast } from '@/hooks/use-toast'
import { Plus, Send } from 'lucide-react'
import { formatTime, dayOfWeekLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'

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
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [publishOpen, setPublishOpen] = React.useState(false)
  const [selectedCell, setSelectedCell] = React.useState<{ slotId: string; date: string } | null>(null)
  const [editShiftId, setEditShiftId] = React.useState<string | undefined>()
  const [activeShift, setActiveShift] = React.useState<ShiftData | null>(null)

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

  // Coverage per cell
  const coverageMap = React.useMemo(() => {
    const map: Record<string, Array<{ role_id: string; role_name: string; min_count: number; ideal_count: number; assigned_count: number }>> = {}
    for (const ts of timeSlots) {
      for (const date of weekDates) {
        const dateStr = date.toISOString().split('T')[0]
        const key = `${ts.id}::${dateStr}`
        const cellShifts = shiftMap[key] ?? []
        const reqs = serviceRequirements.filter((r) => r.time_slot_id === ts.id)
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

  function openAddDialog(slotId: string, date: string) {
    if (!canEdit) return
    setSelectedCell({ slotId, date })
    setEditShiftId(undefined)
    setDialogOpen(true)
  }

  function openEditDialog(shiftId: string, slotId: string, date: string) {
    setSelectedCell({ slotId, date })
    setEditShiftId(shiftId)
    setDialogOpen(true)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveShift(null)
    if (!over || active.id === over.id) return

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
          const shift = shifts.find((s) => s.id === e.active.id)
          setActiveShift(shift ?? null)
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
                      {/* Coverage dot */}
                      {coverage.length > 0 && (
                        <div className="flex justify-end mb-0.5">
                          <CoverageIndicator requirements={coverage} />
                        </div>
                      )}

                      {/* Shift cards */}
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

                      {/* Add button */}
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
        </DragOverlay>
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
    </div>
  )
}
