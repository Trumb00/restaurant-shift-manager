'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { requestVacation } from '@/app/actions/vacations'
import { useToast } from '@/hooks/use-toast'
import type { VacationType } from '@/lib/supabase/types'

const schema = z.object({
  start_date: z.string().min(1, 'Data inizio obbligatoria'),
  end_date: z.string().min(1, 'Data fine obbligatoria'),
  type: z.enum(['ferie', 'permesso', 'malattia', 'altro']),
  reason: z.string().optional(),
}).refine((d) => new Date(d.end_date) >= new Date(d.start_date), {
  message: 'La data fine deve essere uguale o successiva alla data inizio',
  path: ['end_date'],
})

type FormData = z.infer<typeof schema>

const TYPE_LABELS: Record<VacationType, string> = {
  ferie: 'Ferie',
  permesso: 'Permesso',
  malattia: 'Malattia',
  altro: 'Altro',
}

interface VacationRequestFormProps {
  onSuccess?: () => void
}

export function VacationRequestForm({ onSuccess }: VacationRequestFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      start_date: '',
      end_date: '',
      type: 'ferie',
      reason: '',
    },
  })

  const startDate = form.watch('start_date')
  const endDate = form.watch('end_date')
  const days = startDate && endDate
    ? Math.max(0, Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
    : 0

  async function onSubmit(values: FormData) {
    setLoading(true)
    const result = await requestVacation(values)
    setLoading(false)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Richiesta inviata', description: 'Il manager riceverà una notifica.' })
      form.reset()
      onSuccess?.()
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label>Tipo</Label>
        <Select
          value={form.watch('type')}
          onValueChange={(v) => form.setValue('type', v as VacationType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="start_date">Data inizio *</Label>
          <Input id="start_date" type="date" {...form.register('start_date')} />
          {form.formState.errors.start_date && (
            <p className="text-xs text-red-500">{form.formState.errors.start_date.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="end_date">Data fine *</Label>
          <Input id="end_date" type="date" {...form.register('end_date')} min={startDate} />
          {form.formState.errors.end_date && (
            <p className="text-xs text-red-500">{form.formState.errors.end_date.message}</p>
          )}
        </div>
      </div>

      {days > 0 && (
        <p className="text-sm text-indigo-600 font-medium">{days} giorn{days === 1 ? 'o' : 'i'}</p>
      )}

      <div className="space-y-1">
        <Label htmlFor="reason">Motivazione (opzionale)</Label>
        <Textarea id="reason" {...form.register('reason')} rows={2} placeholder="Aggiungi una nota..." />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Invio...' : 'Invia richiesta'}
      </Button>
    </form>
  )
}
