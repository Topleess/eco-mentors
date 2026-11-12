/** @jest-environment node */
import { readFileSync } from 'fs'
import { resolve } from 'path'

const read = (path: string): Buffer => readFileSync(resolve(process.cwd(), path))

describe('EcoCareer asset contract', () => {
  it('serves the canonical approved symbol and desktop lockup unchanged', () => {
    for (const name of ['ecocareer-symbol.svg', 'ecocareer-logo-desktop.svg', 'logomark.svg', 'logo-horizontal.svg', 'logo-horizontal-dark.svg']) {
      expect(read(`public/brand/logo/svg/${name}`)).toEqual(read(`../brand/logo/svg/${name}`))
    }
    const symbol = read('public/brand/logo/svg/ecocareer-symbol.svg').toString()
    for (const stroke of ['M19 119 V31 L31 43', 'M90 17 V104 L77 92', 'M41 66 L90 17', 'M19 119 L68 70']) expect(symbol).toContain(stroke)
  })

  it('keeps the served favicon and CSS palette synchronized with source', () => {
    expect(read('public/favicon.ico')).toEqual(read('../brand/logo/ico/favicon.ico'))
    expect(read('src/styles/brand-tokens.css')).toEqual(read('../brand/colors/tokens.css'))
    for (const color of ['#000000', '#70E852', '#C9FFBF', '#FFFFFF']) expect(read('src/styles/brand-tokens.css').toString()).toContain(color)
    const manifest = JSON.parse(read('public/site.webmanifest').toString())
    expect(manifest.name).toBe('Лаборатория ЭкоКарьеры')
    expect(manifest.theme_color).toBe('#70E852')
    for (const size of [192, 512]) expect(read(`public/brand/logo/png/icon-app/icon-app-${size}.png`)).toEqual(read(`../brand/logo/png/icon-app/icon-app-${size}.png`))
  })
})
