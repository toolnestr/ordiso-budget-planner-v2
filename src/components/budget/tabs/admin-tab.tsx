'use client'

import { useMemo, useState } from 'react'
import {
  Users, UserPlus, Shield, Ban, Receipt, Landmark, MoreHorizontal,
  Search, ShieldCheck, ShieldOff, CheckCircle2, Trash2, ChevronDown,
} from 'lucide-react'
import {
  useAdminStats, useAdminUsers, useAdminUpdateUser, useAdminDeleteUser, useAdminCreateUser,
  type AdminUser,
} from '@/lib/api-hooks'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { StatCard } from '@/components/budget/stat-card'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// Hash-based avatar palette (NO indigo/blue) — warm + cool greens
const AVATAR_COLORS = [
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  'bg-lime-500/15 text-lime-700 dark:text-lime-300',
]

function initials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

type SortKey = 'newest' | 'oldest' | 'name-asc'

const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  'name-asc': 'Name A-Z',
}

function sortUsers(users: AdminUser[], key: SortKey): AdminUser[] {
  const copy = [...users]
  switch (key) {
    case 'oldest':
      return copy.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    case 'name-asc':
      return copy.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    case 'newest':
    default:
      return copy.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  }
}

const ACTION_TOASTS: Record<'promote' | 'demote' | 'ban' | 'unban', string> = {
  promote: 'User promoted to admin',
  demote: 'Admin demoted to user',
  ban: 'User banned',
  unban: 'User unbanned',
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === 'admin'
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1',
        isAdmin
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300'
      )}
    >
      {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <Users className="h-3 w-3" />}
      {isAdmin ? 'Admin' : 'User'}
    </Badge>
  )
}

function StatusBadge({ banned }: { banned: boolean }) {
  return banned ? (
    <Badge className="border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300 gap-1">
      <Ban className="h-3 w-3" /> Banned
    </Badge>
  ) : (
    <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 gap-1">
      <CheckCircle2 className="h-3 w-3" /> Active
    </Badge>
  )
}

function UserActionsMenu({
  user,
  onAction,
  onDelete,
  disabled,
}: {
  user: AdminUser
  onAction: (u: AdminUser, action: 'promote' | 'demote' | 'ban' | 'unban') => void
  onDelete: (u: AdminUser) => void
  disabled?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          disabled={disabled}
          aria-label={`Actions for ${user.name || user.email}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground truncate">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.role === 'user' ? (
          <DropdownMenuItem onClick={() => onAction(user, 'promote')}>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Promote to Admin
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onAction(user, 'demote')}>
            <ShieldOff className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            Demote to User
          </DropdownMenuItem>
        )}
        {user.banned ? (
          <DropdownMenuItem onClick={() => onAction(user, 'unban')}>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Unban User
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onAction(user, 'ban')}>
            <Ban className="h-4 w-4 text-rose-600" />
            Ban User
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(user)}
        >
          <Trash2 className="h-4 w-4" />
          Delete User
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserAvatar({ user, className }: { user: AdminUser; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarFallback className={cn('text-xs font-semibold', avatarColor(user.email || user.id))}>
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  )
}

export function AdminTab() {
  const { data: stats, isLoading: statsLoading } = useAdminStats()
  const { data: users, isLoading: usersLoading } = useAdminUsers()
  const updateUser = useAdminUpdateUser()
  const deleteUser = useAdminDeleteUser()
  const createUser = useAdminCreateUser()

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', isAdmin: false })
  const [createError, setCreateError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!users) return []
    const q = search.trim().toLowerCase()
    const matched = q
      ? users.filter(
          (u) =>
            (u.name || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        )
      : users
    return sortUsers(matched, sort)
  }, [users, search, sort])

  const bannedCount = useMemo(
    () => (users ?? []).filter((u) => u.banned).length,
    [users]
  )

  const handleAction = (
    user: AdminUser,
    action: 'promote' | 'demote' | 'ban' | 'unban'
  ) => {
    updateUser.mutate(
      { id: user.id, action },
      {
        onSuccess: () => toast.success(ACTION_TOASTS[action]),
        onError: (e: Error) => toast.error(e.message || 'Action failed'),
      }
    )
  }

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return
    const target = deleteTarget
    deleteUser.mutate(target.id, {
      onSuccess: () => {
        toast.success('User deleted')
        setDeleteTarget(null)
      },
      onError: (e: Error) => toast.error(e.message || 'Delete failed'),
    })
  }

  const statsCards = stats
    ? (
      <>
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          icon={Users}
          iconColor="text-emerald-600"
          sublabel="All registered"
        />
        <StatCard
          label="New This Week"
          value={stats.newThisWeek}
          icon={UserPlus}
          iconColor="text-teal-600"
          sublabel="Last 7 days"
        />
        <StatCard
          label="Admins"
          value={stats.adminUsers}
          icon={Shield}
          iconColor="text-amber-600"
          sublabel="Privileged"
        />
        <StatCard
          label="Banned Users"
          value={stats.bannedUsers}
          icon={Ban}
          iconColor="text-rose-600"
          sublabel="Restricted access"
        />
        <StatCard
          label="Total Transactions"
          value={stats.totalTransactions}
          icon={Receipt}
          iconColor="text-cyan-600"
          sublabel="Across all users"
        />
        <StatCard
          label="Total Accounts"
          value={stats.totalAccounts}
          icon={Landmark}
          iconColor="text-slate-600"
          sublabel="Tracked accounts"
        />
      </>
    )
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Admin Console</h2>
        <p className="text-sm text-muted-foreground">
          Manage users, roles, and platform-wide activity
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {statsLoading || !statsCards
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          : statsCards}
      </div>

      {/* User management card */}
      <Card className="p-0 overflow-hidden">
        {/* Card header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-5 border-b">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h3 className="font-semibold">User Management</h3>
              <p className="text-xs text-muted-foreground">
                {users?.length ?? 0} total · {bannedCount} banned
              </p>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">
              {filtered.length} shown
            </Badge>
          </div>
          <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:w-auto sm:gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="pl-9 h-10 sm:w-64"
                aria-label="Search users"
              />
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 shrink-0 h-10">
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{SORT_LABELS[sort]}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={sort}
                    onValueChange={(v) => setSort(v as SortKey)}
                  >
                    <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="oldest">Oldest first</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name-asc">Name A-Z</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" className="gap-2 shrink-0 h-10 flex-1 sm:flex-none" onClick={() => { setCreateForm({ name: '', email: '', password: '', isAdmin: false }); setCreateError(null); setCreateOpen(true) }}>
                <UserPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Create User</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Body */}
        {usersLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium mb-1">No users found</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              {search
                ? `No users match "${search}". Try a different name or email.`
                : 'No users have registered yet.'}
            </p>
            {search && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setSearch('')}
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-5">User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right pr-5">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow
                      key={u.id}
                      className={cn(u.banned && 'bg-rose-500/[0.04] hover:bg-rose-500/10')}
                    >
                      <TableCell className="pl-5 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <UserAvatar user={u} className="size-9" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {u.name || 'Unnamed'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><RoleBadge role={u.role} /></TableCell>
                      <TableCell><StatusBadge banned={u.banned} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell className="text-right pr-5">
                        <UserActionsMenu
                          user={u}
                          onAction={handleAction}
                          onDelete={setDeleteTarget}
                          disabled={updateUser.isPending || deleteUser.isPending}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {filtered.map((u) => (
                <div
                  key={u.id}
                  className={cn(
                    'p-4 space-y-3',
                    u.banned && 'bg-rose-500/[0.04]'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar user={u} className="size-10 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {u.name || 'Unnamed'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.email}
                        </p>
                      </div>
                    </div>
                    <UserActionsMenu
                      user={u}
                      onAction={handleAction}
                      onDelete={setDeleteTarget}
                      disabled={updateUser.isPending || deleteUser.isPending}
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <RoleBadge role={u.role} />
                    <StatusBadge banned={u.banned} />
                    <span className="text-xs text-muted-foreground ml-auto">
                      Joined {formatDate(u.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Delete confirmation dialog (controlled, top-level) */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.name || deleteTarget?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user and ALL their financial data.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUser.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteUser.isPending}
              className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60"
            >
              {deleteUser.isPending ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create new user</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setCreateError(null)
              if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) {
                setCreateError('All fields are required.')
                return
              }
              if (createForm.password.length < 6) {
                setCreateError('Password must be at least 6 characters.')
                return
              }
              try {
                await createUser.mutateAsync({
                  name: createForm.name.trim(),
                  email: createForm.email.trim(),
                  password: createForm.password,
                  role: createForm.isAdmin ? 'admin' : 'user',
                })
                toast.success(`Account created for ${createForm.name.trim()}`)
                setCreateOpen(false)
              } catch (err) {
                setCreateError((err as Error).message || 'Could not create user.')
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="cu-name">Full name</Label>
              <Input
                id="cu-name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Jane Doe"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-email">Email</Label>
              <Input
                id="cu-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="jane@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-password">Password</Label>
              <Input
                id="cu-password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="At least 6 characters"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Admin access</p>
                <p className="text-xs text-muted-foreground">Allow this user to manage other accounts</p>
              </div>
              <Switch
                checked={createForm.isAdmin}
                onCheckedChange={(v) => setCreateForm({ ...createForm, isAdmin: v })}
              />
            </div>
            {createError && (
              <p role="alert" className="text-sm font-medium text-rose-600 dark:text-rose-400">{createError}</p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={createUser.isPending}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={createUser.isPending} className="gap-2">
                {createUser.isPending ? 'Creating…' : 'Create user'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
