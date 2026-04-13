'use client'

import * as React from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Search, ChevronRight, Mail, UserX, UserCheck, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { bulkSendInvites } from '@/app/actions/auth'
import { bulkToggleActive } from '@/app/actions/employees'
import { useToast } from '@/hooks/use-toast'

interface EmployeeRow {
  id: string
  first_name: string
  last_name: string
  email: string
  contract_type: string | null
  weekly_hours_contract: number | null
  is_active: boolean
  app_role: string
  primary_role?: { name: string; color: string } | null
}

const CONTRACT_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  on_call: 'A chiamata',
}

interface EmployeeTableProps {
  employees: EmployeeRow[]
  roles: Array<{ id: string; name: string }>
}

export function EmployeeTable({ employees, roles }: EmployeeTableProps) {
  const { toast } = useToast()
  const [search, setSearch] = React.useState('')
  const [roleFilter, setRoleFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState('active')
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [confirmDeactivate, setConfirmDeactivate] = React.useState(false)
  const [bulkLoading, setBulkLoading] = React.useState<'invite' | 'deactivate' | 'activate' | null>(null)

  const filtered = employees.filter((emp) => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase()
    const matchesSearch =
      !search ||
      fullName.includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase())

    const matchesRole =
      roleFilter === 'all' || emp.primary_role?.name === roleFilter

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && emp.is_active) ||
      (statusFilter === 'inactive' && !emp.is_active)

    return matchesSearch && matchesRole && matchesStatus
  })

  // Drop selections that are no longer visible
  React.useEffect(() => {
    const filteredIds = new Set(filtered.map((e) => e.id))
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => filteredIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, statusFilter])

  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id))
  const someSelected = selectedIds.size > 0
  const selectedActive = filtered.filter((e) => selectedIds.has(e.id) && e.is_active)
  const selectedInactive = filtered.filter((e) => selectedIds.has(e.id) && !e.is_active)

  function toggleAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((e) => e.id)))
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkInvite() {
    setBulkLoading('invite')
    const { sent, failed } = await bulkSendInvites([...selectedIds])
    setBulkLoading(null)
    if (sent > 0) toast({ title: `Email inviate a ${sent} dipendent${sent === 1 ? 'e' : 'i'}` })
    if (failed > 0) toast({ title: `${failed} invii falliti`, variant: 'destructive' })
    setSelectedIds(new Set())
  }

  async function handleBulkDeactivate() {
    setBulkLoading('deactivate')
    const result = await bulkToggleActive(selectedActive.map((e) => e.id), false)
    setBulkLoading(null)
    setConfirmDeactivate(false)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: `${selectedActive.length} dipendent${selectedActive.length === 1 ? 'e disattivato' : 'i disattivati'}` })
      setSelectedIds(new Set())
    }
  }

  async function handleBulkActivate() {
    setBulkLoading('activate')
    const result = await bulkToggleActive(selectedInactive.map((e) => e.id), true)
    setBulkLoading(null)
    if (result.error) {
      toast({ title: 'Errore', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: `${selectedInactive.length} dipendent${selectedInactive.length === 1 ? 'e attivato' : 'i attivati'}` })
      setSelectedIds(new Set())
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Cerca per nome o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Ruolo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i ruoli</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Attivi</SelectItem>
            <SelectItem value="inactive">Disattivi</SelectItem>
            <SelectItem value="all">Tutti</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-lg flex-wrap">
          <span className="text-sm font-medium text-indigo-700">
            {selectedIds.size} selezionat{selectedIds.size === 1 ? 'o' : 'i'}
          </span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Button
              variant="outline"
              size="sm"
              disabled={!!bulkLoading}
              onClick={handleBulkInvite}
              className="gap-1.5 h-8"
            >
              {bulkLoading === 'invite'
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Mail className="w-3.5 h-3.5" />}
              Reimposta password
            </Button>
            {selectedActive.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={!!bulkLoading}
                onClick={() => setConfirmDeactivate(true)}
                className="gap-1.5 h-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                {bulkLoading === 'deactivate'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <UserX className="w-3.5 h-3.5" />}
                Disattiva ({selectedActive.length})
              </Button>
            )}
            {selectedInactive.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={!!bulkLoading}
                onClick={handleBulkActivate}
                className="gap-1.5 h-8 text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800"
              >
                {bulkLoading === 'activate'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <UserCheck className="w-3.5 h-3.5" />}
                Attiva ({selectedInactive.length})
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              disabled={!!bulkLoading}
              className="gap-1.5 h-8"
            >
              <X className="w-3.5 h-3.5" />
              Deseleziona
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  className="rounded border-gray-300 accent-indigo-600 cursor-pointer"
                  aria-label="Seleziona tutti"
                />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Dipendente</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Ruolo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Contratto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Ore/sett</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Stato</th>
              <th className="w-8 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Nessun dipendente trovato
                </td>
              </tr>
            )}
            {filtered.map((emp) => (
              <tr
                key={emp.id}
                className={cn(
                  'hover:bg-gray-50 transition-colors',
                  selectedIds.has(emp.id) && 'bg-indigo-50/60'
                )}
              >
                <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(emp.id)}
                    onChange={() => toggleOne(emp.id)}
                    className="rounded border-gray-300 accent-indigo-600 cursor-pointer"
                    aria-label={`Seleziona ${emp.first_name} ${emp.last_name}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/dipendenti/${emp.id}`} className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
                      style={{ backgroundColor: emp.primary_role?.color ?? '#6366f1' }}>
                      {emp.first_name[0]}{emp.last_name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 group-hover:text-indigo-600">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <p className="text-gray-400 text-xs">{emp.email}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {emp.primary_role ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: emp.primary_role.color }} />
                      <span className="text-gray-700">{emp.primary_role.name}</span>
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-gray-600">
                  {emp.contract_type ? CONTRACT_LABELS[emp.contract_type] ?? emp.contract_type : '—'}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-gray-600">
                  {emp.weekly_hours_contract ?? '—'}h
                </td>
                <td className="px-4 py-3">
                  <Badge variant={emp.is_active ? 'success' : 'secondary'}>
                    {emp.is_active ? 'Attivo' : 'Inattivo'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/dipendenti/${emp.id}`}>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-400">{filtered.length} dipendenti trovati</p>

      {/* Deactivate confirmation */}
      <Dialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disattiva dipendenti</DialogTitle>
            <DialogDescription>
              Stai per disattivare {selectedActive.length} dipendent{selectedActive.length === 1 ? 'e' : 'i'}.
              Non potranno più accedere al sistema fino a riattivazione.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDeactivate(false)} disabled={bulkLoading === 'deactivate'}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDeactivate}
              disabled={bulkLoading === 'deactivate'}
              className="gap-2"
            >
              {bulkLoading === 'deactivate' && <Loader2 className="w-4 h-4 animate-spin" />}
              Disattiva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
