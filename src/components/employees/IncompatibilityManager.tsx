'use client'

import * as React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { addIncompatibility, removeIncompatibility } from '@/app/actions/employees'
import { useToast } from '@/hooks/use-toast'
import { X, UserX, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Employee {
  id: string
  first_name: string
  last_name: string
}

interface Props {
  employeeId: string
  allEmployees: Employee[]
  initialIncompatibleIds: string[]
}

export function IncompatibilityManager({ employeeId, allEmployees, initialIncompatibleIds }: Props) {
  const { toast } = useToast()
  const [incompatibleIds, setIncompatibleIds] = React.useState<string[]>(initialIncompatibleIds)
  const [selectedId, setSelectedId] = React.useState('')
  const [adding, setAdding] = React.useState(false)
  const [removingId, setRemovingId] = React.useState<string | null>(null)

  const incompatibleColleagues = allEmployees.filter((e) => incompatibleIds.includes(e.id))
  const available = allEmployees.filter((e) => !incompatibleIds.includes(e.id))

  async function handleAdd() {
    if (!selectedId) return
    setAdding(true)
    const result = await addIncompatibility(employeeId, selectedId)
    setAdding(false)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      setIncompatibleIds((prev) => [...prev, selectedId])
      setSelectedId('')
    }
  }

  async function handleRemove(otherId: string) {
    setRemovingId(otherId)
    const result = await removeIncompatibility(employeeId, otherId)
    setRemovingId(null)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      setIncompatibleIds((prev) => prev.filter((id) => id !== otherId))
    }
  }

  return (
    <div className="space-y-3">
      {/* Current incompatible colleagues */}
      {incompatibleColleagues.length === 0 ? (
        <p className="text-sm text-gray-400">Nessun collega incompatibile impostato.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {incompatibleColleagues.map((emp) => (
            <span
              key={emp.id}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border border-red-200 bg-red-50 text-red-800 transition-opacity',
                removingId === emp.id && 'opacity-50'
              )}
            >
              <UserX className="w-3.5 h-3.5 shrink-0" />
              {emp.first_name} {emp.last_name}
              <button
                type="button"
                disabled={removingId === emp.id}
                onClick={() => handleRemove(emp.id)}
                className="ml-1 hover:text-red-600 disabled:cursor-not-allowed"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add new */}
      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Aggiungi collega incompatibile..." />
            </SelectTrigger>
            <SelectContent>
              {available.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!selectedId || adding}
            onClick={handleAdd}
          >
            <Plus className="w-4 h-4 mr-1" />
            {adding ? 'Aggiunta...' : 'Aggiungi'}
          </Button>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Un avviso apparirà nel planner se vengono assegnati turni con questi colleghi nella stessa fascia. L&apos;incompatibilità è automaticamente bidirezionale.
      </p>
    </div>
  )
}
