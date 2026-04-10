'use client'

import * as React from 'react'

interface Requirement {
  role_id: string
  role_name: string
  min_count: number
  ideal_count: number
  assigned_count: number
}

interface CoverageIndicatorProps {
  requirements: Requirement[]
}

function getCoverageLevel(requirements: Requirement[]): 'green' | 'yellow' | 'red' | 'none' {
  if (requirements.length === 0) return 'none'
  let hasRed = false
  let hasYellow = false
  for (const req of requirements) {
    if (req.assigned_count < req.min_count) hasRed = true
    else if (req.assigned_count < req.ideal_count) hasYellow = true
  }
  if (hasRed) return 'red'
  if (hasYellow) return 'yellow'
  return 'green'
}

export function CoverageIndicator({ requirements }: CoverageIndicatorProps) {
  const [showTooltip, setShowTooltip] = React.useState(false)
  const level = getCoverageLevel(requirements)

  if (level === 'none') return null

  const colors = {
    green: 'bg-green-500',
    yellow: 'bg-amber-400',
    red: 'bg-red-500',
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`w-2 h-2 rounded-full ${colors[level]} cursor-help`} />
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-0 mb-1 w-48 bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg">
          <p className="font-medium mb-1">Copertura:</p>
          {requirements.map((req) => {
            const color =
              req.assigned_count >= req.ideal_count
                ? 'text-green-400'
                : req.assigned_count >= req.min_count
                ? 'text-amber-400'
                : 'text-red-400'
            return (
              <p key={req.role_id} className={color}>
                {req.role_name}: {req.assigned_count}/{req.ideal_count}
                {req.assigned_count < req.min_count && ' ⚠'}
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}
