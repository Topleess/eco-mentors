/** @jest-environment node */
import seo, { pageTitle } from '@/config/seo'

it('uses the client name and does not send social previews to upstream', () => {
  expect(seo.title).toBe('Наставники ЭкоКарьеры — карьера в сфере экологии')
  expect(pageTitle('Вопросы и ответы')).toBe('Вопросы и ответы | Менторы ЭкоКарьеры')
  expect(seo.description).toBe('Открытое сообщество менторов для передачи опыта, развития навыков и профессионального роста.')
  expect(seo.imageUrl).not.toContain('openmentor.io')
})

it('uses the configured public domain without an upstream origin fallback', () => {
  const previousDomain = process.env.DOMAIN
  try {
    process.env.DOMAIN = 'mentors.example.org'
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const constants = require('@/config/constants').default as { BASE_URL: string }
      expect(constants.BASE_URL).toBe('https://mentors.example.org/')
    })
    delete process.env.DOMAIN
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const constants = require('@/config/constants').default as { BASE_URL: string }
      expect(constants.BASE_URL).not.toContain('openmentor.io')
    })
  } finally {
    if (previousDomain === undefined) delete process.env.DOMAIN
    else process.env.DOMAIN = previousDomain
  }
})
