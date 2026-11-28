export type ImageSize = 'full' | 'large' | 'small'

interface ImageLoaderParams {
  src: string
  width?: number
  quality?: ImageSize | number
  version?: string | number
}

/** Same-origin endpoint; the API controls visibility and selects the storage key. */
export function imageLoader({ src, version }: ImageLoaderParams): string {
  const base = `/api/mentor-photos/${encodeURIComponent(src)}`
  return version === undefined ? base : `${base}?v=${encodeURIComponent(version)}`
}

export function updatedAtToVersion(updatedAt: string | undefined): number | undefined {
  if (!updatedAt) return undefined
  const ms = new Date(updatedAt).getTime()
  return isNaN(ms) ? undefined : Math.floor(ms / 1000)
}
