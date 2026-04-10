'use client'

import * as React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Link2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ShiftCardData {
  id: string
  employee_name: string
  role_name: string
  role_color: string
  status: string
  is_split_shift: boolean
}

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-gray-400',
  published: 'bg-blue-500',
  confirmed: 'bg-green-500',
  completed: 'bg-green-700',
  cancelled: 'bg-red-500',
}

interface ShiftCardProps {
  shift: ShiftCardData
  onClick: (id: string) => void
}

export function ShiftCard({ shift, onClick }: ShiftCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shift.id,
    data: shift,
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const initials = shift.employee_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderLeftColor: shift.role_color, backgroundColor: `${shift.role_color}18` }}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded border-l-2 cursor-grab text-xs group select-none',
        isDragging && 'opacity-50 cursor-grabbing',
        shift.is_split_shift && 'border-dashed'
      )}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        onClick(shift.id)
      }}
    >
      {/* Avatar */}
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 text-[9px] font-bold"
        style={{ backgroundColor: shift.role_color }}
      >
        {initials}
      </div>

      {/* Name */}
      <span className="flex-1 font-medium text-gray-800 truncate">{shift.employee_name}</span>

      {/* Icons */}
      <div className="flex items-center gap-1 shrink-0">
        {shift.is_split_shift && <Link2 className="w-3 h-3 text-gray-400" />}
        <div className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT[shift.status] ?? 'bg-gray-400')} />
      </div>
    </div>
  )
}
