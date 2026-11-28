import { imageLoader, updatedAtToVersion } from '@/lib/image-loader'

const id = '11111111-2222-3333-4444-555555555555'

test('all sizes resolve to the same same-origin photo', () => {
  for (const quality of ['small', 'large', 'full'] as const) {
    expect(imageLoader({ src: id, quality })).toBe(`/api/mentor-photos/${id}`)
  }
  for (const width of [16, 36, 320, 900, 1200]) {
    expect(imageLoader({ src: id, width })).toBe(`/api/mentor-photos/${id}`)
  }
})

test('version is encoded as a query parameter', () => {
  expect(imageLoader({ src: id, version: 1754000000 })).toBe(`/api/mentor-photos/${id}?v=1754000000`)
})

test('converts timestamps to versions', () => {
  expect(updatedAtToVersion('2026-08-01T10:00:00.500Z')).toBe(1785578400)
  expect(updatedAtToVersion(undefined)).toBeUndefined()
  expect(updatedAtToVersion('not a date')).toBeUndefined()
})
