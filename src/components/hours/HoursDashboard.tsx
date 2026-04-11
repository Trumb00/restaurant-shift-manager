'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, Loader2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getWeekHours } from '@/app/actions/hours'
import type { EmployeeWeekHours } from '@/app/actions/hours'
import { getISOWeekNumber } from '@/lib/utils'

interface Props {
  initialWeekStart: string
  initialData: EmployeeWeekHours[]
}

function addWeeks(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n * 7)
  return d.toISOString().split('T')[0]
}

function weekLabel(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00Z')
  const end = new Date(weekStart + 'T00:00:00Z')
  end.setUTCDate(end.getUTCDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `Sett. ${getISOWeekNumber(start)} · ${fmt(start)} – ${fmt(end)} ${end.getUTCFullYear()}`
}

function fmt1(n: number): string {
  return n % 1 === 0 ? `${n}` : n.toFixed(1)
}

function deficitClass(deficit: number, contracted: number): { badge: string; row: string } {
  if (contracted === 0) return { badge: 'bg-gray-100 text-gray-500', row: '' }
  if (deficit >= 0) return { badge: 'bg-green-100 text-green-700', row: '' }
  if (deficit >= -contracted * 0.2) return { badge: 'bg-amber-100 text-amber-700', row: 'bg-amber-50/40' }
  return { badge: 'bg-red-100 text-red-700', row: 'bg-red-50/40' }
}

export function HoursDashboard({ initialWeekStart, initialData }: Props) {
  const [weekStart, setWeekStart] = React.useState(initialWeekStart)
  const [data, setData] = React.useState<EmployeeWeekHours[]>(initialData)
  const [loading, setLoading] = React.useState(false)

  const isFirstRender = React.useRef(true)
  React.useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setLoading(true)
    getWeekHours(weekStart).then(({ data: d }) => {
      setData(d)
      setLoading(false)
    })
  }, [weekStart])

  const underCount = data.filter(e => e.deficit < 0).length
  const totalShiftH = data.reduce((s, e) => s + e.shift_hours, 0)
  const totalVacH = data.reduce((s, e) => s + e.vacation_hours, 0)

  return (
    <div className="space-y-4">
      {/* Week navigator + summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(w => addWeeks(w, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium px-3 min-w-[220px] text-center">{weekLabel(weekStart)}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(w => addWeeks(w, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-3 text-sm text-gray-500">
          <span>Turni: <strong className="text-gray-800">{fmt1(totalShiftH)}h</strong></span>
          <span>Ferie: <strong className="text-gray-800">{fmt1(totalVacH)}h</strong></span>
          {underCount > 0 && (
            <span className="text-red-600 font-medium">{underCount} sotto contratto</span>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            Ore settimanali per dipendente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center px-4">
              Nessun dipendente con contratto orario trovato.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/60">
                    <th className="text-left font-medium text-gray-500 px-4 py-2.5">Dipendente</th>
                    <th className="text-right font-medium text-gray-500 px-3 py-2.5">Contratto</th>
                    <th className="text-right font-medium text-gray-500 px-3 py-2.5">Turni</th>
                    <th className="text-right font-medium text-gray-500 px-3 py-2.5">Ferie</th>
                    <th className="text-right font-medium text-gray-500 px-3 py-2.5">Totale</th>
                    <th className="text-right font-medium text-gray-500 px-4 py-2.5">Differenza</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(emp => {
                    const { badge, row } = deficitClass(emp.deficit, emp.contracted_hours)
                    return (
                      <tr key={emp.employee_id} className={`border-b last:border-0 ${row}`}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {emp.last_name} {emp.first_name}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">
                          {fmt1(emp.contracted_hours)}h
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">
                          {fmt1(emp.shift_hours)}h
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">
                          {emp.vacation_hours > 0 ? `${fmt1(emp.vacation_hours)}h` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-800 tabular-nums">
                          {fmt1(emp.total_hours)}h
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${badge}`}>
                            {emp.deficit >= 0 ? '+' : ''}{fmt1(emp.deficit)}h
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
