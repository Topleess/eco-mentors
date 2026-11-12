import Image from 'next/image'

/** Approved symbol with a live Inter wordmark; mobile keeps only the symbol. */
export default function BrandLogo(): JSX.Element {
  return (
    <span className="inline-flex items-center gap-3">
      <Image src="/brand/logo/svg/ecocareer-symbol.svg" width={44} height={55} alt="" priority className="h-[50px] w-10 shrink-0" />
      <span className="hidden font-sans text-[18px] font-normal leading-[1.18] tracking-[-0.025em] sm:block">
        <span className="block">Лаборатория</span>
        <span className="block">ЭкоКарьеры</span>
      </span>
    </span>
  )
}
