import { imageLoader } from '@/lib/image-loader'

test('mentor photos use a same-origin route regardless of storage environment', () => {
  expect(imageLoader({ src: '11111111-2222-3333-4444-555555555555', version: 42 })).toBe('/api/mentor-photos/11111111-2222-3333-4444-555555555555?v=42')
})
