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
import { Plus, Pencil, Mail, Loader2, CheckCircle2 } from 'lucide-react'
import { sendEmployeeInvite } from '@/app/actions/auth'
import { useToast } from '@/hooks/use-toast'

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
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [createdEmployee, setCreatedEmployee] = React.useState<{
    id: string
    firstName: string
    lastName: string
  } | null>(null)
  const [inviteLoading, setInviteLoading] = React.useState(false)

  function handleOpenChange(value: boolean) {
    setOpen(value)
    if (!value) setCreatedEmployee(null)
  }

  async function handleSendInvite() {
    if (!createdEmployee) return
    setInviteLoading(true)
    const result = await sendEmployeeInvite(createdEmployee.id)
    setInviteLoading(false)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Email inviata', description: `Invito inviato a ${createdEmployee.firstName} ${createdEmployee.lastName}` })
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant={mode === 'create' ? 'default' : 'outline'} size="sm">
            {mode === 'create' ? (
              <><Plus className="w-4 h-4 mr-2" /> Nuovo dipendente</>
            ) : (
              <><Pencil className="w-4 h-4 mr-2" /> Modifica</>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {createdEmployee ? 'Dipendente creato' : mode === 'create' ? 'Nuovo dipendente' : 'Modifica dipendente'}
          </DialogTitle>
        </DialogHeader>

        {createdEmployee ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-50">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-base">
                {createdEmployee.firstName} {createdEmployee.lastName} è stato aggiunto!
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Vuoi inviare un&apos;email per impostare la password?
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-2">
              <Button onClick={handleSendInvite} disabled={inviteLoading} className="gap-2">
                {inviteLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Invio in corso...</>
                  : <><Mail className="w-4 h-4" />Invia email di benvenuto</>
                }
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={inviteLoading}>
                Salta
              </Button>
            </div>
          </div>
        ) : (
          <EmployeeForm
            employeeId={employeeId}
            defaultValues={defaultValues as Parameters<typeof EmployeeForm>[0]['defaultValues']}
            availableRoles={availableRoles}
            isAdmin={isAdmin}
            onSuccess={(created) => {
              if (mode === 'create' && created) {
                setCreatedEmployee(created)
              } else {
                setOpen(false)
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
