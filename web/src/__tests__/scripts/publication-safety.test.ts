import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.join(process.cwd(), '..')

it('requires explicit repository opt-in before any production workflow job can run', () => {
  const workflow = readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8')
  for (const job of [
    'validate-inputs',
    'build-frontend',
    'build-backend',
    'deploy',
    'notify-failure',
  ]) {
    const block = workflow.split(`\n  ${job}:`)[1]?.split(/\n {2}[a-z][a-z-]*:/)[0]
    expect(block).toBeDefined()
    const guard = block?.match(/\n {4}if: ([^\n]*(?:\n {6}[^\n]*)*)/)?.[1]
    expect(guard).toContain("vars.ENABLE_PRODUCTION_DEPLOY == 'true'")
  }
})

it.each(['archivo', 'inter', 'schibsted-grotesk'])(
  'includes the %s vendored font license',
  (family) => {
    const license = readFileSync(
      path.join(process.cwd(), `src/assets/og-fonts/${family}-OFL.txt`),
      'utf8',
    )
    expect(license).toContain('SIL OPEN FONT LICENSE Version 1.1')
    expect(license).toContain('Copyright')
  },
)
