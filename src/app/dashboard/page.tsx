import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  Umbrella,
  AlertCircle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { AppRole } from '@/lib/supabase/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWeekRange(): { start: string; end: string } {
  const now = new Date()
  const day = now.getUTCDay()
  const distToMonday = (day + 6) % 7
  const monday = new Date(now)
  monday.setUTCHours(0, 0, 0, 0)
  monday.setUTCDate(now.getUTCDate() - distToMonday)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  }
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string
  value: string | number
  description: string
  icon: React.ElementType
  badge?: { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }
  href?: string
}

function StatCard({ title, value, description, icon: Icon, badge, href }: StatCardProps) {
  const inner = (
    <Card className={href ? 'hover:border-[var(--primary)]/40 transition-colors cursor-pointer' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[var(--muted-fg)]">{title}</CardTitle>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--primary-light)]">
          <Icon className="w-4 h-4 text-[var(--primary)]" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold text-[var(--foreground)]">{value}</div>
            <p className="text-xs text-[var(--muted-fg)] mt-0.5">{description}</p>
          </div>
          {badge && (
            <Badge variant={badge.variant} className="text-xs">
              {badge.label}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href}>{inner}</Link>
  }
  return inner
}

// ── Quick action card ─────────────────────────────────────────────────────────

interface QuickLinkProps {
  href: string
  icon: React.ElementType
  label: string
  description: string
}

function QuickLink({ href, icon: Icon, label, description }: QuickLinkProps) {
  return (
    <Link href={href}>
      <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--primary)]/40 hover:shadow-sm transition-all group">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--surface-alt)] group-hover:bg-[var(--primary-light)] transition-colors">
          <Icon className="w-5 h-5 text-[var(--muted-fg)] group-hover:text-[var(--primary)] transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
          <p className="text-xs text-[var(--muted-fg)] truncate">{description}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--primary)] transition-colors shrink-0" />
      </div>
    </Link>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  // Fetch employee profile
  const { data: employee } = await supabase
    .from('employees')
    .select('first_name, last_name, app_role')
    .eq('user_id', session.user.id)
    .single()

  const firstName = employee?.first_name ?? 'Utente'
  const userRole: AppRole = (employee?.app_role as AppRole) ?? 'employee'

  const { start: weekStart, end: weekEnd } = getWeekRange()

  // Parallel data fetching
  const [
    { count: totalEmployees },
    { count: shiftsThisWeek },
    { count: publishedShifts },
    { count: pendingVacations },
    { data: recentVacations },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('shifts')
      .select('*', { count: 'exact', head: true })
      .gte('date', weekStart)
      .lte('date', weekEnd),
    supabase
      .from('shifts')
      .select('*', { count: 'exact', head: true })
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .eq('status', 'published'),
    supabase
      .from('vacations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('vacations')
      .select('id, start_date, end_date, type, status, employees(first_name, last_name)')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(5),
  ])

  const coveragePct =
    shiftsThisWeek && shiftsThisWeek > 0
      ? Math.round(((publishedShifts ?? 0) / shiftsThisWeek) * 100)
      : 0

  const isAdminOrManager = userRole === 'admin' || userRole === 'manager'

  const vacationTypeLabel: Record<string, string> = {
    ferie: 'Ferie',
    permesso: 'Permesso',
    malattia: 'Malattia',
    altro: 'Altro',
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Welcome banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--foreground)]">
            Buongiorno, {firstName}!
          </h2>
          <p className="text-sm text-[var(--muted-fg)] mt-0.5">
            Ecco una panoramica della settimana corrente.
          </p>
        </div>
        {isAdminOrManager && (
          <Button asChild size="sm">
            <Link href="/dashboard/turni">
              <Calendar className="w-4 h-4" />
              Gestisci turni
            </Link>
          </Button>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isAdminOrManager && (
          <StatCard
            title="Dipendenti attivi"
            value={totalEmployees ?? 0}
            description="Totale personale in organico"
            icon={Users}
            href="/dashboard/dipendenti"
          />
        )}
        <StatCard
          title="Turni questa settimana"
          value={shiftsThisWeek ?? 0}
          description={`${weekStart} — ${weekEnd}`}
          icon={Calendar}
          href="/dashboard/turni"
        />
        <StatCard
          title="Copertura turni"
          value={`${coveragePct}%`}
          description="Turni pubblicati vs totali"
          icon={TrendingUp}
          badge={
            coveragePct >= 80
              ? { label: 'Buona', variant: 'success' }
              : coveragePct >= 50
              ? { label: 'Parziale', variant: 'warning' }
              : { label: 'Bassa', variant: 'destructive' }
          }
        />
        <StatCard
          title="Richieste ferie"
          value={pendingVacations ?? 0}
          description="In attesa di approvazione"
          icon={Umbrella}
          badge={
            (pendingVacations ?? 0) > 0
              ? { label: 'Da gestire', variant: 'warning' }
              : { label: 'Nessuna', variant: 'secondary' }
          }
          href="/dashboard/ferie"
        />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick links */}
        <Card>
          <CardHeader>
            <CardTitle>Accesso rapido</CardTitle>
            <CardDescription>Sezioni principali dell&apos;applicazione</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <QuickLink
              href="/dashboard/turni"
              icon={Calendar}
              label="Calendario turni"
              description="Visualizza e gestisci il programma settimanale"
            />
            <QuickLink
              href="/dashboard/ferie"
              icon={Umbrella}
              label="Ferie & Permessi"
              description="Richiedi o approva assenze e permessi"
            />
            <QuickLink
              href="/dashboard/assenze"
              icon={AlertCircle}
              label="Assenze"
              description="Registra e monitora le assenze del personale"
            />
            {isAdminOrManager && (
              <QuickLink
                href="/dashboard/dipendenti"
                icon={Users}
                label="Dipendenti"
                description="Gestisci il personale e i profili"
              />
            )}
          </CardContent>
        </Card>

        {/* Pending vacation requests */}
        {isAdminOrManager && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Richieste in attesa</CardTitle>
                <CardDescription>Ferie e permessi da approvare</CardDescription>
              </div>
              {(pendingVacations ?? 0) > 0 && (
                <Badge variant="warning">{pendingVacations}</Badge>
              )}
            </CardHeader>
            <CardContent>
              {!recentVacations || recentVacations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-[var(--success)] mb-2" />
                  <p className="text-sm font-medium text-[var(--foreground)]">Tutto in ordine</p>
                  <p className="text-xs text-[var(--muted-fg)] mt-0.5">
                    Nessuna richiesta in attesa
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {recentVacations.map((v) => {
                    const emp = v.employees as unknown as { first_name: string; last_name: string } | null
                    return (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--surface-alt)] shrink-0">
                            <Clock className="w-3.5 h-3.5 text-[var(--muted-fg)]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--foreground)] truncate">
                              {emp ? `${emp.first_name} ${emp.last_name}` : '—'}
                            </p>
                            <p className="text-xs text-[var(--muted-fg)]">
                              {vacationTypeLabel[v.type] ?? v.type} · {v.start_date} – {v.end_date}
                            </p>
                          </div>
                        </div>
                        <Badge variant="warning" className="shrink-0">In attesa</Badge>
                      </li>
                    )
                  })}
                </ul>
              )}
              {(pendingVacations ?? 0) > 5 && (
                <div className="mt-3">
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <Link href="/dashboard/ferie">
                      Vedi tutte le richieste
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
