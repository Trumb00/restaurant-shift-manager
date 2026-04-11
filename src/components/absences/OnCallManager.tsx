'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, PhoneCall, X, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { getOnCallWeek, assignOnCallDays, removeOnCallDay } from '@/app/actions/absences'
import type { OnCallRow } from '@/app/actions/absences'
import { getISOWeekNumber } from '@/lib/utils'

interface Employee { id: string; first_name: string; last_name: string }
interface TimeSlot { id: string; name: string }

interface Props {
  allEmployees: Employee[]
  allTimeSlots: TimeSlot[]
  initialWeekStart: string
  initialAssignments: OnCallRow[]
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

function addWeeks(dateStr: string, n: number): string {
  return addDays(dateStr, n * 7)
}

function weekLabel(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00Z')
  const end = new Date(weekStart + 'T00:00:00Z')
  end.setUTCDate(end.getUTCDate() + 6)
  const weekNum = getISOWeekNumber(start)
  const fmt = (d: Date) =>
    d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `Sett. ${weekNum} · ${fmt(start)} – ${fmt(end)} ${end.getUTCFullYear()}`
}

const priorityStyle: Record<number, string> = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-orange-100 text-orange-700',
  3: 'bg-yellow-100 text-yellow-700',
}

export function OnCallManager({ allEmployees, allTimeSlots, initialWeekStart, initialAssignments }: Props) {
  const { toast } = useToast()
  const [weekStart, setWeekStart] = React.useState(initialWeekStart)
  const [assignments, setAssignments] = React.useState<OnCallRow[]>(initialAssignments)
  const [loadingWeek, setLoadingWeek] = React.useState(false)

  // Form state
  const [employeeId, setEmployeeId] = React.useState('')
  const [selectedSlots, setSelectedSlots] = React.useState<Set<string>>(
    () => new Set(allTimeSlots.map(s => s.id))
  )
  const [priority, setPriority] = React.useState('1')
  const [selectedDays, setSelectedDays] = React.useState<Set<number>>(
    () => new Set([0, 1, 2, 3, 4, 5, 6])
  )
  const [saving, setSaving] = React.useState(false)
  const [removing, setRemoving] = React.useState<string | null>(null)

  const isFirstRender = React.useRef(true)
  React.useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setLoadingWeek(true)
    getOnCallWeek(weekStart).then(({ data, error }) => {
      if (error) toast({ title: 'Errore', description: error, variant: 'destructive' })
      else setAssignments(data)
      setLoadingWeek(false)
    })
  }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  const weekDates = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const assignmentsByDate = React.useMemo(() => {
    const map = new Map<string, OnCallRow[]>()
    for (const date of weekDates) map.set(date, [])
    for (const row of assignments) map.get(row.date)?.push(row)
    return map
  }, [assignments, weekDates])

  function toggleSlot(id: string) {
    setSelectedSlots(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleDay(index: number) {
    setSelectedDays(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index); else next.add(index)
      return next
    })
  }

  async function handleAssign() {
    if (!employeeId) { toast({ title: 'Seleziona un dipendente.', variant: 'destructive' }); return }
    if (selectedSlots.size === 0) { toast({ title: 'Seleziona almeno una fascia.', variant: 'destructive' }); return }
    if (selectedDays.size === 0) { toast({ title: 'Seleziona almeno un giorno.', variant: 'destructive' }); return }

    setSaving(true)
    const dates = [...selectedDays].sort((a, b) => a - b).map(i => weekDates[i])
    const result = await assignOnCallDays(employeeId, dates, [...selectedSlots], Number(priority))
    setSaving(false)

    if (result.error) { toast({ title: 'Errore', description: result.error, variant: 'destructive' }); return }
    toast({ title: 'Reperibilità assegnata.' })

    const { data, error } = await getOnCallWeek(weekStart)
    if (!error) setAssignments(data)
  }

  async function handleRemove(id: string) {
    setRemoving(id)
    const result = await removeOnCallDay(id)
    setRemoving(null)
    if (result.error) { toast({ title: 'Errore', description: result.error, variant: 'destructive' }); return }
    setAssignments(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Assignment form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-indigo-500" />
            Assegna reperibile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Dipendente</label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona…" />
                </SelectTrigger>
                <SelectContent>
                  {allEmployees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.last_name} {e.first_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Priorità</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 – Primo contatto</SelectItem>
                  <SelectItem value="2">2 – Secondo contatto</SelectItem>
                  <SelectItem value="3">3 – Terzo contatto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Time slot toggles */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600">Fasce orarie</span>
              <div className="flex gap-2 text-xs text-indigo-600">
                <button type="button" onClick={() => setSelectedSlots(new Set(allTimeSlots.map(s => s.id)))} className="hover:underline">Tutte</button>
                <span className="text-gray-300">·</span>
                <button type="button" onClick={() => setSelectedSlots(new Set())} className="hover:underline">Nessuna</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allTimeSlots.map(ts => (
                <button
                  key={ts.id}
                  type="button"
                  onClick={() => toggleSlot(ts.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedSlots.has(ts.id)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {ts.name}
                </button>
              ))}
            </div>
          </div>

          {/* Day toggles */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600">Giorni</span>
              <div className="flex gap-2 text-xs text-indigo-600">
                <button type="button" onClick={() => setSelectedDays(new Set([0, 1, 2, 3, 4, 5, 6]))} className="hover:underline">Tutti</button>
                <span className="text-gray-300">·</span>
                <button type="button" onClick={() => setSelectedDays(new Set())} className="hover:underline">Nessuno</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedDays.has(i)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {label} <span className="opacity-60">{weekDates[i].slice(8)}</span>
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleAssign} disabled={saving} className="w-full sm:w-auto">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvataggio…</> : 'Assegna reperibilità'}
          </Button>
        </CardContent>
      </Card>

      {/* Weekly grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Reperibili settimana</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWeekStart(w => addWeeks(w, -1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium px-2 min-w-[200px] text-center">{weekLabel(weekStart)}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWeekStart(w => addWeeks(w, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingWeek ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {weekDates.map((date, i) => {
                const rows = assignmentsByDate.get(date) ?? []
                return (
                  <div key={date} className="min-w-0">
                    <div className="text-center mb-1.5">
                      <div className="text-xs font-semibold text-gray-500">{DAY_LABELS[i]}</div>
                      <div className="text-xs text-gray-400">{date.slice(8)}</div>
                    </div>
                    <div className="space-y-1">
                      {rows.length === 0 && (
                        <div className="text-xs text-gray-300 text-center py-2">—</div>
                      )}
                      {rows.map(row => (
                        <div key={row.id} className="bg-gray-50 rounded p-1.5 text-xs group relative">
                          <div className="flex items-start gap-1 pr-4">
                            <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${priorityStyle[row.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                              {row.priority}
                            </span>
                            <span className="min-w-0 truncate font-medium leading-tight">{row.employee_name}</span>
                          </div>
                          {row.time_slot_name && (
                            <div className="text-gray-400 truncate mt-0.5 pl-5 text-[11px]">{row.time_slot_name}</div>
                          )}
                          <button
                            onClick={() => handleRemove(row.id)}
                            disabled={removing === row.id}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                            aria-label="Rimuovi"
                          >
                            {removing === row.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <X className="w-3 h-3" />
                            }
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
