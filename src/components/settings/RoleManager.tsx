'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Power } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Role {
  id: string
  name: string
  description: string | null
  color: string
  is_active: boolean
}

const PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6',
  '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#6b7280',
]

interface RoleFormData {
  name: string
  description: string
  color: string
}

function RoleFormDialog({ role, onClose }: { role?: Role; onClose: () => void }) {
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState<RoleFormData>({
    name: role?.name ?? '',
    description: role?.description ?? '',
    color: role?.color ?? '#6366f1',
  })

  async function handleSave() {
    if (!form.name) { toast({ title: 'Nome obbligatorio', variant: 'destructive' }); return }
    setLoading(true)
    const { error } = role
      ? await supabase.from('roles').update(form).eq('id', role.id)
      : await supabase.from('roles').insert({ ...form, is_active: true })
    setLoading(false)
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: role ? 'Ruolo aggiornato' : 'Ruolo creato' })
      router.refresh()
      onClose()
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Nome ruolo *</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Es. Cameriere" />
      </div>
      <div className="space-y-1">
        <Label>Descrizione</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>Colore</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
              onClick={() => setForm({ ...form, color: c })}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">Personalizzato:</span>
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Annulla</Button>
        <Button onClick={handleSave} disabled={loading}>{loading ? 'Salvataggio...' : 'Salva'}</Button>
      </DialogFooter>
    </div>
  )
}

interface RoleManagerProps {
  roles: Role[]
}

export function RoleManager({ roles }: RoleManagerProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()
  const [editRole, setEditRole] = React.useState<Role | undefined>()
  const [dialogOpen, setDialogOpen] = React.useState(false)

  async function toggleActive(role: Role) {
    const { error } = await supabase.from('roles').update({ is_active: !role.is_active }).eq('id', role.id)
    if (error) toast({ title: 'Errore', description: error.message, variant: 'destructive' })
    else router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex justify-end">
          <Dialog open={dialogOpen && !editRole} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditRole(undefined) }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditRole(undefined)}>
                <Plus className="w-4 h-4 mr-1" /> Nuovo ruolo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuovo ruolo operativo</DialogTitle></DialogHeader>
              <RoleFormDialog onClose={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {roles.map((role) => (
            <div key={role.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${role.color}22` }}>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: role.color }} />
                </div>
                <div>
                  <p className="font-medium text-sm">{role.name}</p>
                  {role.description && <p className="text-xs text-gray-400 truncate max-w-[120px]">{role.description}</p>}
                </div>
                {!role.is_active && <Badge variant="secondary" className="text-xs">Inattivo</Badge>}
              </div>
              <div className="flex items-center gap-1">
                <Dialog open={dialogOpen && editRole?.id === role.id} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditRole(undefined) }}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => { setEditRole(role); setDialogOpen(true) }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Modifica ruolo</DialogTitle></DialogHeader>
                    <RoleFormDialog role={editRole} onClose={() => setDialogOpen(false)} />
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" size="sm" onClick={() => toggleActive(role)} className={role.is_active ? 'text-gray-400' : 'text-green-600'}>
                  <Power className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
