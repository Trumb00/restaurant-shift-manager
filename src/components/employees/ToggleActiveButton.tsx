'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { toggleEmployeeActive } from '@/app/actions/employees'
import { useToast } from '@/hooks/use-toast'
import { UserCheck, UserX } from 'lucide-react'

interface ToggleActiveButtonProps {
  employeeId: string
  isActive: boolean
}

export function ToggleActiveButton({ employeeId, isActive }: ToggleActiveButtonProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)

  async function handleToggle() {
    setLoading(true)
    const result = await toggleEmployeeActive(employeeId, !isActive)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: isActive ? 'Dipendente disattivato' : 'Dipendente riattivato' })
    }
    setLoading(false)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className={isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}
    >
      {isActive ? (
        <><UserX className="w-4 h-4 mr-2" /> Disattiva</>
      ) : (
        <><UserCheck className="w-4 h-4 mr-2" /> Riattiva</>
      )}
    </Button>
  )
}
