'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Bell, ChevronDown, LogOut, User, Settings } from 'lucide-react'
import { Sidebar } from './Sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { AppRole } from '@/lib/supabase/types'

interface DashboardLayoutProps {
  children: React.ReactNode
  userName: string
  userEmail: string
  userRole: AppRole
  avatarUrl?: string | null
  pageTitle?: string
}

export function DashboardLayout({
  children,
  userName,
  userEmail,
  userRole,
  avatarUrl,
  pageTitle,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const router = useRouter()
  const supabase = createClient()

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      {/* Sidebar */}
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        userRole={userRole}
        avatarUrl={avatarUrl}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-[var(--header-border)] bg-[var(--header-bg)] px-4 sm:px-6">
          {/* Hamburger (mobile only) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-md text-[var(--muted-fg)] hover:text-[var(--foreground)] hover:bg-[var(--surface-alt)] transition-colors"
            aria-label="Apri menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Page title */}
          <div className="flex-1 min-w-0">
            {pageTitle && (
              <h1 className="text-base font-semibold text-[var(--foreground)] truncate">
                {pageTitle}
              </h1>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="relative text-[var(--muted-fg)] hover:text-[var(--foreground)]"
              aria-label="Notifiche"
            >
              <Bell className="w-5 h-5" />
              {/* Notification dot — shown when there are unread notifications */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--primary)] ring-2 ring-[var(--header-bg)]" />
            </Button>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
                    'hover:bg-[var(--surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
                  )}
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={userName}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--primary)] text-white text-xs font-semibold">
                      {initials}
                    </div>
                  )}
                  <span className="hidden sm:block font-medium text-[var(--foreground)] max-w-[120px] truncate">
                    {userName}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--muted-fg)] hidden sm:block" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{userName}</span>
                    <span className="text-xs text-[var(--muted-fg)] font-normal truncate">{userEmail}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/dashboard/profilo')}>
                  <User className="w-4 h-4" />
                  Il mio profilo
                </DropdownMenuItem>
                {userRole === 'admin' && (
                  <DropdownMenuItem onClick={() => router.push('/dashboard/impostazioni')}>
                    <Settings className="w-4 h-4" />
                    Impostazioni
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-[var(--destructive)] focus:text-[var(--destructive)] focus:bg-[var(--destructive-light)]"
                >
                  <LogOut className="w-4 h-4" />
                  Esci
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
