'use client'

import * as React from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const [search, setSearch] = React.useState('')
  const [roleFilter, setRoleFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState('active')

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

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
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
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Nessun dipendente trovato
                </td>
              </tr>
            )}
            {filtered.map((emp) => (
              <tr
                key={emp.id}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
              >
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
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: emp.primary_role.color }}
                      />
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
    </div>
  )
}
