'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { EmployeeForm } from './EmployeeForm'
import { Plus, Pencil } from 'lucide-react'

interface AvailableRole {
  id: string
  name: string
  color: string
}

interface EmployeeDialogProps {
  mode: 'create' | 'edit'
  employeeId?: string
  defaultValues?: Record<string, unknown>
  availableRoles: AvailableRole[]
  isAdmin?: boolean
  trigger?: React.ReactNode
}

export function EmployeeDialog({
  mode,
  employeeId,
  defaultValues,
  availableRoles,
  isAdmin,
  trigger,
}: EmployeeDialogProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant={mode === 'create' ? 'default' : 'outline'} size="sm">
            {mode === 'create' ? (
              <>
                <Plus className="w-4 h-4 mr-2" /> Nuovo dipendente
              </>
            ) : (
              <>
                <Pencil className="w-4 h-4 mr-2" /> Modifica
              </>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Nuovo dipendente' : 'Modifica dipendente'}
          </DialogTitle>
        </DialogHeader>
        <EmployeeForm
          employeeId={employeeId}
          defaultValues={defaultValues as Parameters<typeof EmployeeForm>[0]['defaultValues']}
          availableRoles={availableRoles}
          isAdmin={isAdmin}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
