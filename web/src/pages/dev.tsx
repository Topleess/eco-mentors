import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { NoIndexHead } from '@/components'
import { isLocalDevelopment } from '@/server/dev-access'

type Role = 'mentor' | 'admin'

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  res.setHeader('Cache-Control', 'no-store')
  if (!isLocalDevelopment(req.headers.host)) return { notFound: true }
  return { props: {} }
}

export default function DevPage(): JSX.Element {
  const router = useRouter()
  const [pending, setPending] = useState<Role | null>(null)
  const [error, setError] = useState(false)

  async function enter(role: Role): Promise<void> {
    setPending(role)
    setError(false)
    try {
      const response = await fetch('/api/dev/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const result = (await response.json()) as { success?: boolean; role?: string }
      if (!response.ok || !result.success || result.role !== role) throw new Error('Login failed')
      await router.replace(role === 'mentor' ? '/mentor' : '/admin/mentors/pending')
    } catch {
      setError(true)
    } finally {
      setPending(null)
    }
  }

  return (
    <main className="bg-surface px-5 py-12">
      <NoIndexHead title="Локальная разработка — OpenMentor" />
      <section className="mx-auto max-w-xl space-y-6 rounded-panel border border-line bg-white p-6 sm:p-10">
        <p className="meta-mono text-brand-cobalt">LOCAL DEVELOPMENT</p>
        <h1>Локальная разработка</h1>
        <p className="text-ink-soft">
          Быстрый вход в существующие кабинеты с локальными тестовыми аккаунтами.
          Это не публичное демо только для чтения.
        </p>
        <p className="rounded-field bg-surface p-4 text-mint-ink">
          Сохранение изменений включено: изменения записываются в локальную базу разработки.
        </p>
        <div className="flex flex-col gap-4">
          <button className="button w-full" type="button" disabled={pending !== null} onClick={() => void enter('mentor')}>
            {pending === 'mentor' ? 'Входим…' : 'Войти как ментор'}
          </button>
          <button className="button-secondary w-full" type="button" disabled={pending !== null} onClick={() => void enter('admin')}>
            {pending === 'admin' ? 'Входим…' : 'Войти как администратор'}
          </button>
        </div>
        {error && <p role="alert" className="text-danger">Не удалось войти. Проверьте локальный API и тестовые аккаунты, затем попробуйте ещё раз.</p>}
      </section>
    </main>
  )
}
