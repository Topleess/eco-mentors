import { useState, type FormEvent } from 'react'
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { NoIndexHead } from '@/components'

type DemoRole = 'admin' | 'mentor'

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.DEMO_AUTH_ENABLED !== 'true') {
    return { notFound: true }
  }
  return { props: {} }
}

export default function DemoLoginPage(): JSX.Element {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/demo/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = (await response.json()) as { success?: boolean; role?: DemoRole }

      if (!response.ok || !result.success) {
        setError(
          response.status === 404
            ? 'Демо-вход сейчас отключён.'
            : response.status === 401
              ? 'Такой тестовый аккаунт не найден.'
              : 'Не удалось войти. Проверьте адрес и попробуйте ещё раз.'
        )
        return
      }

      if (result.role === 'admin') {
        void router.replace('/admin/mentors/pending')
        return
      }
      if (result.role === 'mentor') {
        void router.replace('/mentor')
        return
      }

      setError('Не удалось определить роль тестового аккаунта.')
    } catch {
      setError('Не удалось связаться с сервером. Попробуйте ещё раз.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-12">
      <NoIndexHead title="Тестовый вход — OpenMentor" />
      <section className="w-full max-w-[460px] rounded-[20px] border border-line bg-white p-7 shadow-[0_20px_50px_-24px_rgba(19,42,82,0.22)] sm:p-10">
        <h1 className="text-[26px] tracking-[-0.02em] text-ink">Тестовый вход</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-ink-soft">
          Это публичное демо: любой посетитель может войти по тестовым адресам ниже. Здесь только
          синтетические данные; реальные регистрации и изменения отключены.
        </p>

        <div className="mb-6 rounded-field border border-line bg-surface p-3.5 text-sm text-ink">
          <p className="m-0">Модератор: demo-admin@openmentor.test</p>
          <p className="mb-0 mt-2">Ментор: demo-mentor@openmentor.test</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="demo-email" className="text-[13px] font-semibold text-ink">
              Почта тестового аккаунта
            </label>
            <input
              id="demo-email"
              type="email"
              autoComplete="email"
              required
              maxLength={255}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="demo-admin@openmentor.test"
              className="rounded-field border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none transition focus:border-brand-cobalt"
            />
          </div>

          {error && (
            <p role="alert" className="m-0 rounded-field border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-cobalt disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Входим…' : 'Войти'}
          </button>
        </form>
      </section>
    </main>
  )
}
