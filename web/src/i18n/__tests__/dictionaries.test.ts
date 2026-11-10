/** @jest-environment node */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Message, Messages } from '@/i18n/core'

const directory = join(__dirname, '..', 'messages')
const templates = (message: Message): string[] => typeof message === 'string' ? [message] : Object.values(message)
const parameters = (message: Message): string[] => [...new Set(templates(message).flatMap((value) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1])))].sort()

for (const filename of readdirSync(directory).filter((file) => file.endsWith('.ts'))) {
  describe(`dictionary ${filename}`, () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dictionaries = Object.values(require(join(directory, filename)) as Record<string, unknown>).filter((value): value is Messages => typeof value === 'object' && value !== null)
    it('provides both languages and matching interpolation parameters', () => {
      expect(dictionaries.length).toBeGreaterThan(0)
      for (const messages of dictionaries) {
      expect(Object.keys(messages).length).toBeGreaterThan(0)
      for (const [key, entry] of Object.entries(messages)) {
        expect({ key, translated: Boolean(entry.ru) }).toEqual({ key, translated: true })
        if (!entry.ru) continue
        expect({ key, parameters: parameters(entry.ru) }).toEqual({ key, parameters: parameters(entry.en) })
        for (const template of [...templates(entry.en), ...templates(entry.ru)]) expect(template.trim()).not.toBe('')
      }
      }
    })
  })
}
