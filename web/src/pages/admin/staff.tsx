import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import NoIndexHead from '@/components/layout/NoIndexHead'
import { AdminLayout } from '@/components/admin-moderation/AdminLayout'
import { AdminAuthProvider, useAdminAuth } from '@/components/admin-moderation/AdminAuthContext'
import { useLocale } from '@/i18n'

type Account = { id: string; name: string; email: string; role: string; active: boolean }
function Content(): JSX.Element {
  const router = useRouter()
  const { isAuthenticated, isLoading, session } = useAdminAuth()
  const ru = useLocale() === 'ru'
  const [accounts, setAccounts] = useState<Account[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('moderator')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const title = ru ? 'Администраторы и модераторы' : 'Administrators and moderators'
  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) void router.replace('/admin/login')
    else if (session?.role !== 'admin') void router.replace('/admin/mentors/pending')
  }, [isLoading, isAuthenticated, session?.role, router])
  const load = async (): Promise<void> => {
    const response = await fetch('/api/admin/staff')
    if (!response.ok) throw new Error('load')
    const data = await response.json() as { accounts: Account[] }
    setAccounts(data.accounts)
  }
  useEffect(() => { if (isAuthenticated && session?.role === 'admin') void load().catch(() => setError(ru ? 'Не удалось загрузить список' : 'Could not load accounts')) }, [isAuthenticated, session?.role, ru])
  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, role }) })
      if (!response.ok) throw new Error(response.status === 409 ? 'duplicate' : 'save')
      setName(''); setEmail(''); await load()
    } catch (err) { setError(err instanceof Error && err.message === 'duplicate' ? (ru ? 'Этот адрес уже используется' : 'This email is already in use') : (ru ? 'Не удалось сохранить или обновить список' : 'Could not save or reload accounts')) }
    finally { setBusy(false) }
  }
  const update = async (account: Account, active: boolean): Promise<void> => {
    if (!window.confirm(ru ? 'Изменить доступ этого сотрудника?' : 'Change this account’s access?')) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/admin/staff/${encodeURIComponent(account.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: account.role, active }) })
      if (!response.ok) throw new Error(response.status === 409 ? 'last-admin' : 'save')
      await load()
    } catch (err) { setError(err instanceof Error && err.message === 'last-admin' ? (ru ? 'Нельзя удалить последнего администратора' : 'Cannot remove the last administrator') : (ru ? 'Не удалось изменить доступ' : 'Could not change access')) }
    finally { setBusy(false) }
  }
  if (isLoading || !isAuthenticated || session?.role !== 'admin') return <p role="status">{ru ? 'Проверяем доступ…' : 'Checking access…'}</p>
  return <><NoIndexHead title={title} /><AdminLayout title={title}>
    <p>{ru ? 'Добавленные пользователи смогут войти по ссылке, отправленной на почту.' : 'Added users can sign in using a link sent to their email.'}</p>
    {error && <p role="alert">{error}</p>}
    <form onSubmit={(e) => void submit(e)} className="grid gap-3 rounded-panel border border-line bg-white p-6 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-end">
      <label className="grid min-w-0 gap-2 text-sm font-medium">{ru ? 'Имя' : 'Name'}<input className="field min-h-11 w-full text-base" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="grid min-w-0 gap-2 text-sm font-medium">{ru ? 'Эл. почта' : 'Email'}<input className="field min-h-11 w-full text-base" required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="grid min-w-0 gap-2 text-sm font-medium">{ru ? 'Роль' : 'Role'}<select aria-label={ru ? 'Роль' : 'Role'} className="field min-h-11 w-full text-base" value={role} onChange={(e) => setRole(e.target.value)}><option value="moderator">{ru ? 'Модератор' : 'Moderator'}</option><option value="admin">{ru ? 'Администратор' : 'Administrator'}</option></select></label>
      <button className="button" disabled={busy} type="submit">{ru ? 'Добавить' : 'Add account'}</button>
    </form>
    <ul>{accounts.map((account) => <li key={account.id} className="flex flex-wrap items-center gap-3 py-3">
      <span>{account.name} — {account.email} — {account.active ? (ru ? 'Активен' : 'Active') : (ru ? 'Доступ отозван' : 'Revoked')}</span>
      <select className="field" aria-label={ru ? `Роль: ${account.name}` : `Role for ${account.name}`} disabled={busy} value={account.role} onChange={(e) => setAccounts((items) => items.map((item) => item.id === account.id ? { ...item, role: e.target.value } : item))}><option value="moderator">{ru ? 'Модератор' : 'Moderator'}</option><option value="admin">{ru ? 'Администратор' : 'Administrator'}</option></select>
      <button type="button" className="button" disabled={busy} onClick={() => void update(account, account.active)}>{ru ? `Сохранить: ${account.name}` : `Save ${account.name}`}</button>
      <button type="button" className="button-ghost" disabled={busy} onClick={() => void update(account, !account.active)}>{account.active ? (ru ? `Отозвать: ${account.name}` : `Revoke ${account.name}`) : (ru ? `Восстановить: ${account.name}` : `Reinstate ${account.name}`)}</button>
    </li>)}</ul>
  </AdminLayout></>
}
export default function StaffPage(): JSX.Element { return <AdminAuthProvider><Content /></AdminAuthProvider> }
