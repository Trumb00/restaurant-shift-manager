'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { getWeekStart } from '@/lib/utils'

interface WeekNavigatorProps {
  weekStart: Date
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  const startStr = weekStart.toLocaleDateString('it-IT', opts)
  const endStr = weekEnd.toLocaleDateString('it-IT', { ...opts, year: 'numeric' })
  return `${startStr} – ${endStr}`
}

export function WeekNavigator({ weekStart }: WeekNavigatorProps) {
  const router = useRouter()

  function navigate(offset: number) {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + offset * 7)
    router.push(`/dashboard/turni?week=${next.toISOString().split('T')[0]}`)
  }

  function goToToday() {
    const today = getWeekStart(new Date())
    router.push(`/dashboard/turni?week=${today.toISOString().split('T')[0]}`)
  }

  const currentWeekStart = getWeekStart(new Date())
  const isCurrentWeek = weekStart.toISOString().split('T')[0] === currentWeekStart.toISOString().split('T')[0]

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="flex items-center gap-2 min-w-[220px] text-center justify-center">
        <CalendarDays className="w-4 h-4 text-gray-400" />
        <span className="font-medium text-sm">{formatWeekLabel(weekStart)}</span>
      </div>
      <Button variant="outline" size="sm" onClick={() => navigate(1)}>
        <ChevronRight className="w-4 h-4" />
      </Button>
      {!isCurrentWeek && (
        <Button variant="ghost" size="sm" onClick={goToToday}>
          Oggi
        </Button>
      )}
    </div>
  )
}
