import fs from 'node:fs'
import path from 'node:path'

it('includes feature-owned vacancy styles in Tailwind source scanning', () => {
  const config = fs.readFileSync(path.join(process.cwd(), 'tailwind.config.js'), 'utf8')
  expect(config).toContain("'./src/features/**/*.{js,ts,jsx,tsx}'")
})
