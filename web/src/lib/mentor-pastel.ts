/** Deterministic mentor colors shared by catalog portraits and social cards. */

/** Pastel photo-block gradients, as full class strings so Tailwind can see them. */
export const MENTOR_PASTEL_GRAD_CLASSES = [
  'bg-pastel-sky-grad',
  'bg-pastel-sand-grad',
  'bg-pastel-sage-grad',
  'bg-pastel-lavender-grad',
  'bg-pastel-rose-grad',
] as const

/**
 * The same five gradients as raw [base, deep] hex pairs, in the SAME ORDER
 * as MENTOR_PASTEL_GRAD_CLASSES (source of truth: tailwind.config.js
 * `backgroundImage.pastel-*-grad`). For surfaces Tailwind can't reach —
 * the satori-rendered social card (/api/og/mentor).
 */
export const MENTOR_PASTEL_GRAD_HEX: ReadonlyArray<readonly [string, string]> = [
  ['#C9FFBF', '#B4F5A7'], // sky
  ['#E5FFDF', '#C9FFBF'], // sand
  ['#C9FFBF', '#B4F5A7'], // sage
  ['#D9F5D3', '#C6E9BF'], // lavender
  ['#ECF8E8', '#D9F5D3'], // rose
]

/** Neutral paper gradient, kept as the fallback when no stable key exists. */
export const MENTOR_PASTEL_NEUTRAL_GRAD_CLASS = 'bg-pastel-neutral-grad'

/** Initials circle fills (fallback B): navy or cobalt by slug hash parity. */
export const MENTOR_INITIALS_CLASSES = ['bg-brand-navy', 'bg-brand-cobalt'] as const

/** Initials fills as hex (brand navy / cobalt), same parity as the classes. */
export const MENTOR_INITIALS_HEX = ['#000000', '#246B20'] as const

/**
 * Deterministic pastel index for a mentor key (0..4). Exposed so non-Tailwind
 * renderers (the social card) pick the SAME hue as the catalog card.
 */
export function mentorPastelIndex(key: string): number {
  return fnv1a(key) % MENTOR_PASTEL_GRAD_CLASSES.length
}

/** Deterministic initials-fill index (0..1), matching mentorInitialsClass. */
export function mentorInitialsIndex(key: string): number {
  return fnv1a(key) % MENTOR_INITIALS_CLASSES.length
}

/** FNV-1a 32-bit hash — the single source of card color determinism. */
function fnv1a(key: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

/**
 * Pick the pastel gradient class for a mentor card photo block.
 * @param key - Stable mentor identifier (slug). Same key -> same gradient.
 */
export function mentorPastelGradClass(key: string): string {
  if (!key) {
    return MENTOR_PASTEL_NEUTRAL_GRAD_CLASS
  }

  return MENTOR_PASTEL_GRAD_CLASSES[fnv1a(key) % MENTOR_PASTEL_GRAD_CLASSES.length]
}

/**
 * Pick the initials-circle fill (navy/cobalt) for a mentor without a photo.
 * @param key - Stable mentor identifier (slug). Same key -> same fill.
 */
export function mentorInitialsClass(key: string): string {
  return MENTOR_INITIALS_CLASSES[fnv1a(key) % MENTOR_INITIALS_CLASSES.length]
}
