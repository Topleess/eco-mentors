import fs from 'node:fs'
import path from 'node:path'

const pages = ['privacy.tsx', 'terms.tsx', 'mentor/login.tsx', 'mentor/auth/callback.tsx', 'mentor/confirm.tsx', 'admin/login.tsx', 'admin/auth/callback.tsx', 'reviews/new.tsx', 'demo-login.tsx', 'dev.tsx']

describe('Account shell identity boundary', () => {
  it.each([
    'admin-moderation/AdminLayout.tsx',
    'mentor-admin/MentorAdminLayout.tsx',
    'mentor-admin/UsernameCard.tsx',
    'forms/RegisterMentorForm.tsx',
  ])('%s does not display upstream branding or profile URLs', (component) => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/components', component), 'utf8')
    expect(source).not.toMatch(/openmentor\.io|>\s*openmentor\s*</i)
  })
})

describe('Secondary page identity boundary', () => {
  it.each(pages)('%s does not route customers to upstream branding or contacts', (page) => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/pages', page), 'utf8')
    expect(source).not.toMatch(/rgba\(19,42,82|(?:bg|text|border)-gray-/)
    expect(source).not.toMatch(/https:\/\/openmentor\.io|mailto:[^"\s]*openmentor\.io|alt="openmentor\.io"|— OpenMentor|openmentor<span/)
  })
})
