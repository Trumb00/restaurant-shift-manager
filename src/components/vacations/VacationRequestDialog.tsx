'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { VacationRequestForm } from './VacationRequestForm'
import { Plus } from 'lucide-react'

export function VacationRequestDialog() {
  const [open, setOpen] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" /> Nuova richiesta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuova richiesta ferie/permesso</DialogTitle>
        </DialogHeader>
        <VacationRequestForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
