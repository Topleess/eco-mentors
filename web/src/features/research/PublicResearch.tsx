import analytics from '@/lib/analytics'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import MentorsSearch from '@/components/mentors/MentorsSearch'
import { FilterPill } from '@/components/ui/FilterPill'
import { useTranslation } from '@/i18n'
import { messages } from '@/features/research/messages'
import type { Research } from '@/features/research/model'
function Cover({ research }: { research: Research }): JSX.Element {
  const [failed, setFailed] = useState(false)
  return (
    <div className="relative aspect-[4/3] min-w-0 overflow-hidden rounded-card bg-surface-deep">
      {research.coverUrl && !failed ? (
        <Image
          src={research.coverUrl}
          alt={research.coverAlt}
          fill
          className="object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full items-center justify-center p-8 font-display text-3xl text-brand-navy"
        >
          OPENMENTOR
          <br />
          RESEARCH
        </div>
      )}
    </div>
  )
}
export function ResearchCatalog({ research }: { research: Research[] }): JSX.Element {
  const { t } = useTranslation(messages)
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState(''),
    [year, setYear] = useState('')
  const published = research.filter((row) => row.status === 'published')
  const rows = published.filter(
    (row) =>
      (!category || row.category === category) &&
      (!year || row.publishedOn.startsWith(year)) &&
      `${row.title} ${row.summary} ${row.author}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  )
  return (
    <>
      <p className="meta-mono mb-3">{t('explore')}</p>
      <h1 className="my-0 text-3xl sm:text-[40px]">{t('title')}</h1>
      <div className="my-8 grid items-end gap-4">
        <MentorsSearch
          value={query}
          onChange={setQuery}
          placeholder={t('search')}
          ariaLabel={t('search')}
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill label={t('category')} value={category} onChange={setCategory} options={[
            { value: '', label: t('all'), count: published.length },
            ...[...new Set(published.map(row => row.category))].sort().map(value => ({ value, label: value, count: published.filter(row => row.category === value).length })),
          ]} />
          <FilterPill label={t('year')} value={year} onChange={setYear} options={[
            { value: '', label: t('all'), count: published.length },
            ...[...new Set(published.map(row => row.publishedOn.slice(0, 4)))].sort().reverse().map(value => ({ value, label: value, count: published.filter(row => row.publishedOn.startsWith(value)).length })),
          ]} />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {rows.map((row) => (
          <article key={row.id} className="min-w-0 rounded-panel border border-line p-5">
            <Cover research={row} />
            <p className="meta-mono mt-5">
              {row.category} · {row.publishedOn}
            </p>
            <h2 className="my-3 font-name text-2xl normal-case tracking-normal">
              <Link href={`/research/${row.slug}`}>{row.title}</Link>
            </h2>
            <p className="break-words text-ink-soft">{row.summary}</p>
            {row.provenance === 'synthetic' && (
              <p className="mt-3 text-sm text-ink-mute">{t('sample')}</p>
            )}
            <Link
              href={`/research/${row.slug}`}
              className="button-secondary mt-5 inline-flex min-h-11 items-center"
            >
              {t('learn')}
            </Link>
          </article>
        ))}
      </div>
      {!rows.length && <p role="status">{t('empty')}</p>}
    </>
  )
}
export function ResearchDetail({ research: r }: { research: Research }): JSX.Element {
  const { t } = useTranslation(messages)
  const [shareStatus, setShareStatus] = useState('')
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: r.title, url: window.location.href })
      else {
        await navigator.clipboard.writeText(window.location.href)
        setShareStatus(t('shared'))
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setShareStatus(t('shareError'))
    }
  }
  return (
    <>
      <Link className="button-ghost mb-6 inline-flex min-h-11 items-center" href="/research">
        ← {t('back')}
      </Link>
      <article>
        <div className="overflow-hidden rounded-panel border border-line">
          <div className="grid gap-8 p-5 sm:p-8 md:grid-cols-[2fr_3fr]">
            <Cover research={r} />
            <div className="min-w-0">
              <p className="meta-mono">{r.category}</p>
              <h1 className="my-5 break-words font-name text-3xl normal-case tracking-normal sm:text-4xl">
                {r.title}
              </h1>
              <p className="whitespace-pre-line break-words text-lg text-ink-soft">{r.summary}</p>
              <p className="mt-6">{r.author}</p>
              {r.provenance === 'synthetic' && (
                <p className="mt-3 text-sm text-ink-mute">{t('sample')}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line p-5 sm:px-8">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <time dateTime={r.publishedOn}>{r.publishedOn}</time>
              <span>
                {r.readingMinutes} {t('minutes')}
              </span>
              <button
                className="button-ghost min-h-11"
                onClick={() => {
                  void share()
                }}
              >
                {t('share')}
              </button>
              <span role="status">{shareStatus}</span>
            </div>
            {r.pdfUrl && (
              <div className="flex flex-wrap gap-3">
                <a
                  className="button-secondary min-h-11"
                  href={r.pdfUrl}
                  onClick={() => analytics.event('research_pdf_clicked')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('pdf')}
                </a>
                <a
                  className="button min-h-11"
                  href={r.pdfUrl}
                  onClick={() => analytics.event('research_pdf_clicked')}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('download')}
                </a>
              </div>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-3xl py-12">
          <nav aria-label={t('toc')} className="mb-12 rounded-panel border border-line p-6">
            <h2 className="mb-4 text-xl">{t('toc')}</h2>
            <ul>
              {r.sections.map((s) => (
                <li key={s.id}>
                  <a
                    className="inline-flex min-h-11 items-center text-brand-cobalt underline"
                    href={`#${s.id}`}
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {r.sections.map((s) => (
            <section key={s.id} id={s.id} className="mb-10 scroll-mt-24 break-words">
              <h2 className="mb-4 font-name text-2xl normal-case tracking-normal">{s.title}</h2>
              {s.body.split(/\n\s*\n/).map((p, i) => (
                <p key={i} className="mb-4 whitespace-pre-line leading-relaxed text-ink-soft">
                  {p}
                </p>
              ))}
            </section>
          ))}
          {!!r.keyFindings.length && (
            <section className="mb-10">
              <h2 className="mb-4 text-xl">{t('findings')}</h2>
              <ul className="list-disc space-y-3 pl-6">
                {r.keyFindings.map((finding, i) => (
                  <li className="break-words" key={i}>
                    {finding}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {r.citation && (
            <aside className="border-t border-line pt-6">
              <h2 className="mb-3 text-xl">{t('citation')}</h2>
              <p className="whitespace-pre-line break-words text-ink-soft">{r.citation}</p>
            </aside>
          )}
        </div>
      </article>
    </>
  )
}
