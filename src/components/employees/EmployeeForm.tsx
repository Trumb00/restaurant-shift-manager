'use client'

import * as React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { createEmployee, updateEmployee } from '@/app/actions/employees'
import { useToast } from '@/hooks/use-toast'
import { Plus, Trash2 } from 'lucide-react'
import type { AppRole, ContractType } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const schema = z.object({
  first_name: z.string().min(1, 'Nome obbligatorio'),
  last_name: z.string().min(1, 'Cognome obbligatorio'),
  email: z.email('Email non valida'),
  phone: z.string().optional(),
  contract_type: z.enum(['full_time', 'part_time', 'on_call']),
  weekly_hours_contract: z.number().min(1).max(60),
  hire_date: z.string().optional(),
  app_role: z.enum(['admin', 'manager', 'employee']).optional(),
  roles: z.array(z.object({
    role_id: z.string().min(1),
    is_primary: z.boolean(),
    proficiency_level: z.number().int().min(1).max(3),
  })).optional(),
})

type FormData = z.infer<typeof schema>

interface AvailableRole {
  id: string
  name: string
  color: string
}

interface EmployeeFormProps {
  employeeId?: string
  defaultValues?: Partial<FormData>
  availableRoles: AvailableRole[]
  isAdmin?: boolean
  onSuccess?: () => void
}

const CONTRACT_LABELS: Record<ContractType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  on_call: 'A chiamata',
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Amministratore',
  manager: 'Manager',
  employee: 'Dipendente',
}

export function EmployeeForm({ employeeId, defaultValues, availableRoles, isAdmin, onSuccess }: EmployeeFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      contract_type: 'full_time',
      weekly_hours_contract: 40,
      hire_date: '',
      app_role: 'employee',
      roles: [],
      ...defaultValues,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'roles',
  })

  async function onSubmit(values: FormData) {
    setLoading(true)
    try {
      const payload = {
        ...values,
        weekly_hours_contract: Number(values.weekly_hours_contract),
      }
      const result = employeeId
        ? await updateEmployee(employeeId, payload)
        : await createEmployee(payload)

      if ('error' in result && result.error) {
        toast({ title: 'Errore', description: result.error, variant: 'destructive' })
      } else {
        toast({ title: employeeId ? 'Dipendente aggiornato' : 'Dipendente creato' })
        onSuccess?.()
      }
    } finally {
      setLoading(false)
    }
  }

  const selectedRoleIds = fields.map((f) => f.role_id)

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="first_name">Nome *</Label>
          <Input id="first_name" {...form.register('first_name')} />
          {form.formState.errors.first_name && (
            <p className="text-xs text-red-500">{form.formState.errors.first_name.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="last_name">Cognome *</Label>
          <Input id="last_name" {...form.register('last_name')} />
          {form.formState.errors.last_name && (
            <p className="text-xs text-red-500">{form.formState.errors.last_name.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="email">Email *</Label>
        <Input id="email" type="email" {...form.register('email')} />
        {form.formState.errors.email && (
          <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="phone">Telefono</Label>
        <Input id="phone" type="tel" {...form.register('phone')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Tipo contratto *</Label>
          <Select
            value={form.watch('contract_type')}
            onValueChange={(v) => form.setValue('contract_type', v as ContractType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CONTRACT_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="weekly_hours_contract">Ore/settimana *</Label>
          <Input
            id="weekly_hours_contract"
            type="number"
            min={1}
            max={60}
            {...form.register('weekly_hours_contract', { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="hire_date">Data assunzione</Label>
        <Input id="hire_date" type="date" {...form.register('hire_date')} />
      </div>

      {isAdmin && (
        <div className="space-y-1">
          <Label>Ruolo applicazione</Label>
          <Select
            value={form.watch('app_role')}
            onValueChange={(v) => form.setValue('app_role', v as AppRole)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Ruoli operativi</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ role_id: '', is_primary: fields.length === 0, proficiency_level: 1 })}
          >
            <Plus className="w-4 h-4 mr-1" /> Aggiungi ruolo
          </Button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2 p-2 border rounded-lg">
            <Select
              value={form.watch(`roles.${index}.role_id`)}
              onValueChange={(v) => form.setValue(`roles.${index}.role_id`, v)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Seleziona ruolo" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles
                  .filter((r) => !selectedRoleIds.includes(r.id) || r.id === field.role_id)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: r.color }}
                        />
                        {r.name}
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select
              value={String(form.watch(`roles.${index}.proficiency_level`))}
              onValueChange={(v) => form.setValue(`roles.${index}.proficiency_level`, Number(v))}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Base</SelectItem>
                <SelectItem value="2">Intermedio</SelectItem>
                <SelectItem value="3">Esperto</SelectItem>
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={() => {
                const isPrimary = form.watch(`roles.${index}.is_primary`)
                form.setValue(`roles.${index}.is_primary`, !isPrimary)
              }}
              className={cn(
                'text-xs px-2 py-1 rounded border transition-colors',
                form.watch(`roles.${index}.is_primary`)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 text-gray-600'
              )}
            >
              Primario
            </button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(index)}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvataggio...' : employeeId ? 'Aggiorna' : 'Crea dipendente'}
        </Button>
      </div>
    </form>
  )
}
