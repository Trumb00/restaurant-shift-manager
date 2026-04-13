// Browser-only utility — do NOT import from server components or server actions.
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatTime } from '@/lib/utils'

interface PdfShift {
  employee_id: string
  time_slot_id: string
  date: string
  employees: { first_name: string; last_name: string } | null
  roles: { name: string } | null
}

interface PdfSlot {
  id: string
  name: string
  start_time: string
  end_time: string
}

export interface WeekPDFParams {
  weekDates: Date[]
  timeSlots: PdfSlot[]
  shifts: PdfShift[]
}

export interface WeekBlock {
  weekStart: string
  weekEnd: string
  weekDates: Date[]
  shifts: PdfShift[]
}

export interface MonthlyPDFParams {
  year: number
  month: number
  timeSlots: PdfSlot[]
  weeks: WeekBlock[]
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function dayLabel(d: Date): string {
  const wd = d.toLocaleDateString('it-IT', { weekday: 'short', timeZone: 'UTC' })
  const dm = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)}\n${dm}`
}

function buildWeekBody(weekDates: Date[], timeSlots: PdfSlot[], shifts: PdfShift[]): string[][] {
  return timeSlots.map((slot) => {
    const timeRange = `${formatTime(slot.start_time)}–${formatTime(slot.end_time)}`
    const dayCells = weekDates.map((d) => {
      const iso = toISODate(d)
      return shifts
        .filter((s) => s.time_slot_id === slot.id && s.date === iso)
        .map((s) => s.employees ? `${s.employees.first_name} ${s.employees.last_name}` : '')
        .filter(Boolean)
        .join('\n')
    })
    return [slot.name, timeRange, ...dayCells]
  })
}

function weekRangeLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  return `${fmt(start)} – ${fmt(end)}`
}

export function downloadWeeklyPDF({ weekDates, timeSlots, shifts }: WeekPDFParams): void {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })

  const rangeLabel = weekRangeLabel(weekDates[0], weekDates[6])
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(`Turni – ${rangeLabel}`, 14, 14)

  const head = [['Fascia', 'Orario', ...weekDates.map(dayLabel)]]
  const body = buildWeekBody(weekDates, timeSlots, shifts)

  autoTable(doc, {
    head,
    body,
    startY: 20,
    styles: { fontSize: 7, overflow: 'linebreak', cellPadding: 2, valign: 'top' },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 18 } },
    theme: 'grid',
  })

  const weekStartISO = toISODate(weekDates[0])
  doc.save(`turni-${weekStartISO}.pdf`)
}

export function downloadMonthlyPDF({ year, month, timeSlots, weeks }: MonthlyPDFParams): void {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(`Turni – ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`, 14, 14)

  if (weeks.length === 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Nessun turno trovato per questo mese.', 14, 26)
    doc.save(`turni-${year}-${String(month).padStart(2, '0')}.pdf`)
    return
  }

  let currentY = 22

  for (const week of weeks) {
    const rangeLabel = weekRangeLabel(week.weekDates[0], week.weekDates[6])

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(`Settimana ${rangeLabel}`, 14, currentY)
    currentY += 4

    const head = [['Fascia', 'Orario', ...week.weekDates.map(dayLabel)]]
    const body = buildWeekBody(week.weekDates, timeSlots, week.shifts)

    autoTable(doc, {
      head,
      body,
      startY: currentY,
      styles: { fontSize: 6, overflow: 'linebreak', cellPadding: 1.5, valign: 'top' },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 6 },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 16 } },
      theme: 'grid',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentY = (doc as any).lastAutoTable.finalY + 10
  }

  doc.save(`turni-${year}-${String(month).padStart(2, '0')}.pdf`)
}
