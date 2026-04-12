'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, Loader2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getPeriodHours } from '@/app/actions/hours'
import type { EmployeeWeekHours } from '@/app/actions/hours'
import { getISOWeekNumber } from '@/lib/utils'

type ViewMode = 'week' | 'month' | 'year'

interface Props {
  initialAnchor: string          // first day of the initial period (Monday)
  initialData: EmployeeWeekHours[]
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toUtc(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z')
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function getPeriodBounds(anchor: string, mode: ViewMode): { start: string; end: string; label: string } {
  const d = toUtc(anchor)
  const fmt = (dt: Date) =>
    dt.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' })

  if (mode === 'week') {
    // anchor is always a Monday
    const end = new Date(d)
    end.setUTCDate(end.getUTCDate() + 6)
    const endStr = end.toISOString().split('T')[0]
    const label = `Sett. ${getISOWeekNumber(d)} · ${fmt(d)} – ${fmt(end)} ${end.getUTCFullYear()}`
    return { start: anchor, end: endStr, label }
  }

  if (mode === 'month') {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    const end   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    const label = start.toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    return {
      start: start.toISOString().split('T')[0],
      end:   end.toISOString().split('T')[0],
      label: label.charAt(0).toUpperCase() + label.slice(1),
    }
  }

  // year
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const end   = new Date(Date.UTC(d.getUTCFullYear(), 11, 31))
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
    label: String(d.getUTCFullYear()),
  }
}

function navigate(anchor: string, mode: ViewMode, dir: -1 | 1): string {
  const d = toUtc(anchor)
  if (mode === 'week') {
    d.setUTCDate(d.getUTCDate() + dir * 7)
  } else if (mode === 'month') {
    d.setUTCMonth(d.getUTCMonth() + dir)
    d.setUTCDate(1)
  } else {
    d.setUTCFullYear(d.getUTCFullYear() + dir)
    d.setUTCMonth(0); d.setUTCDate(1)
  }
  return d.toISOString().split('T')[0]
}

/** Derive a mode-appropriate anchor from an existing anchor when switching modes. */
function anchorForMode(anchor: string, mode: ViewMode): string {
  const d = toUtc(anchor)
  if (mode === 'month') return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().split('T')[0]
  if (mode === 'year')  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).toISOString().split('T')[0]
  return anchor // week — keep as-is (already a Monday from initialAnchor)
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmt1(n: number): string {
  return n % 1 === 0 ? `${n}` : n.toFixed(1)
}

function deficitClass(deficit: number, contracted: number): { badge: string; row: string } {
  if (contracted === 0) return { badge: 'bg-gray-100 text-gray-500', row: '' }
  if (deficit >= 0)     return { badge: 'bg-green-100 text-green-700', row: '' }
  const pct = Math.abs(deficit) / contracted
  if (pct <= 0.2)       return { badge: 'bg-amber-100 text-amber-700', row: 'bg-amber-50/40' }
  return                       { badge: 'bg-red-100 text-red-700', row: 'bg-red-50/40' }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HoursDashboard({ initialAnchor, initialData }: Props) {
  const [mode, setMode]         = React.useState<ViewMode>('week')
  const [anchor, setAnchor]     = React.useState(initialAnchor)
  const [capToday, setCapToday] = React.useState(false)
  const [data, setData]         = React.useState<EmployeeWeekHours[]>(initialData)
  const [loading, setLoading]   = React.useState(false)

  const { start, end, label } = getPeriodBounds(anchor, mode)
  const effectiveEnd = capToday ? (end > todayStr() ? todayStr() : end) : end

  const capLabel = capToday && effectiveEnd < end
    ? ` · fino al ${toUtc(effectiveEnd).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`
    : ''

  // Reload when period changes
  const isFirst = React.useRef(true)
  React.useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setLoading(true)
    getPeriodHours(start, effectiveEnd).then(({ data: d }) => {
      setData(d)
      setLoading(false)
    })
  }, [start, effectiveEnd]) // eslint-disable-line react-hooks/exhaustive-deps

  function switchMode(m: ViewMode) {
    setAnchor(anchorForMode(anchor, m))
    setMode(m)
  }

  const underCount     = data.filter(e => e.deficit < 0).length
  const totalShiftH    = data.reduce((s, e) => s + e.shift_hours, 0)
  const totalVacH      = data.reduce((s, e) => s + e.vacation_hours, 0)

  const modes: { key: ViewMode; label: string }[] = [
    { key: 'week',  label: 'Settimana' },
    { key: 'month', label: 'Mese' },
    { key: 'year',  label: 'Anno' },
  ]

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Mode selector */}
        <div className="flex rounded-lg border divide-x overflow-hidden text-sm">
          {modes.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => switchMode(m.key)}
              className={`px-4 py-1.5 font-medium transition-colors ${
                mode === m.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Cap-to-today toggle */}
        <button
          type="button"
          onClick={() => setCapToday(v => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
            capToday
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
            capToday ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
          }`}>
            {capToday && <span className="w-2 h-2 bg-white rounded-sm" />}
          </span>
          Fino ad oggi
        </button>
      </div>

      {/* Navigator + summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setAnchor(a => navigate(a, mode, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium px-3 min-w-[240px] text-center">
            {label}{capLabel}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setAnchor(a => navigate(a, mode, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-4 text-sm text-gray-500">
          <span>Turni: <strong className="text-gray-800">{fmt1(totalShiftH)}h</strong></span>
          <span>Ferie: <strong className="text-gray-800">{fmt1(totalVacH)}h</strong></span>
          {underCount > 0 && (
            <span className="font-medium text-red-600">{underCount} sotto contratto</span>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            Bilancio ore dipendenti
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
