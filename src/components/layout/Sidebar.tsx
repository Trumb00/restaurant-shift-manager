'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Users,
  Umbrella,
  AlertCircle,
  Settings,
  UtensilsCrossed,
  LogOut,
  X,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { AppRole } from '@/lib/supabase/types'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles?: AppRole[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Turni', href: '/dashboard/turni', icon: Calendar },
  { label: 'Dipendenti', href: '/dashboard/dipendenti', icon: Users, roles: ['admin', 'manager'] },
  { label: 'Ferie & Permessi', href: '/dashboard/ferie', icon: Umbrella },
  { label: 'Assenze', href: '/dashboard/assenze', icon: AlertCircle },
  { label: 'Impostazioni', href: '/dashboard/impostazioni', icon: Settings, roles: ['admin'] },
]

interface SidebarProps {
  userName: string
  userEmail: string
  userRole: AppRole
  avatarUrl?: string | null
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ userName, userEmail, userRole, avatarUrl, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  // Defer active-state calculation to the client to avoid hydration
  // mismatches after magic-link redirects (server and client can
  // disagree on pathname during the initial render).
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  )

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const roleLabel: Record<AppRole, string> = {
    admin: 'Amministratore',
    manager: 'Manager',
    employee: 'Dipendente',
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] transition-transform duration-200 ease-in-out',
          'lg:static lg:translate-x-0 lg:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-[var(--sidebar-border)]">
          <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={onClose}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--primary)]">
              <UtensilsCrossed className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-[var(--sidebar-fg)] text-sm tracking-tight">
              GestioneTurni
            </span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-[var(--sidebar-fg)]/60 hover:text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover)] transition-colors"
            aria-label="Chiudi menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-0.5">
            {visibleItems.map((item) => {
              const isActive = mounted && (
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href)
              )
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors group',
                      isActive
                        ? 'bg-[var(--sidebar-active)] text-white'
                        : 'text-[var(--sidebar-fg)]/70 hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-fg)]'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive ? 'text-white' : 'text-[var(--sidebar-fg)]/50 group-hover:text-[var(--sidebar-fg)]/80'
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {isActive && (
                      <ChevronRight className="w-3.5 h-3.5 text-white/70" />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User footer */}
        <div className="border-t border-[var(--sidebar-border)] p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            {/* Avatar */}
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={userName}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20"
              />
            ) : (
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--primary)] text-white text-xs font-semibold shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--sidebar-fg)] truncate">{userName}</p>
              <p className="text-xs text-[var(--sidebar-fg)]/50 truncate">{roleLabel[userRole]}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-[var(--sidebar-fg)]/40 hover:text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover)] transition-colors"
              aria-label="Esci"
              title="Esci"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-[var(--sidebar-fg)]/30 truncate px-2 mt-0.5">{userEmail}</p>
        </div>
      </aside>
    </>
  )
}
