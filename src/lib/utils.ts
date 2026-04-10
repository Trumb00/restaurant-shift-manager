import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date (string or Date) as a localised Italian date.
 * e.g. "10 aprile 2026"
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Format a PostgreSQL TIME string (HH:MM:SS or HH:MM) as HH:MM.
 * e.g. "09:00:00" → "09:00"
 */
export function formatTime(time: string): string {
  // Accept "HH:MM" or "HH:MM:SS"
  const parts = time.split(':')
  if (parts.length < 2) return time
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
}

/**
 * Return an array of 7 Date objects (Mon–Sun) for the week containing
 * the given weekStart date.  If weekStart is already a Monday the same
 * value is used as the first element.
 */
export function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

/**
 * Return the Monday of the ISO week that contains the given date.
 * The returned Date has its time portion zeroed out (midnight UTC).
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  // getDay() returns 0 = Sunday … 6 = Saturday; ISO week starts on Monday (1)
  const day = d.getUTCDay()
  // distance back to Monday: Sunday (0) → 6 days back, Mon (1) → 0, Tue (2) → 1, …
  const distToMonday = (day + 6) % 7
  d.setUTCDate(d.getUTCDate() - distToMonday)
  return d
}

/**
 * Format a TIMESTAMPTZ / ISO datetime string as a short Italian
 * date + time string.
 * e.g. "2026-04-10T09:00:00+00:00" → "10/04/2026, 09:00"
 */
export function formatDateTime(datetime: string | Date): string {
  const d = typeof datetime === 'string' ? new Date(datetime) : datetime
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Return the ISO week number (1–53) for a given date.
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  // Thursday of the current week determines the year
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

/**
 * Clamp a number between min and max (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Capitalise the first character of a string.
 */
export function capitalize(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Convert a day-of-week index (0 = Sunday … 6 = Saturday) to its
 * Italian abbreviated name.
 */
export function dayOfWeekLabel(day: number): string {
  const labels = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
  return labels[day] ?? ''
}

/**
 * Return the full Italian name for a day-of-week index.
 */
export function dayOfWeekLabelFull(day: number): string {
  const labels = [
    'Domenica',
    'Lunedì',
    'Martedì',
    'Mercoledì',
    'Giovedì',
    'Venerdì',
    'Sabato',
  ]
  return labels[day] ?? ''
}
