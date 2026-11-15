import type { SEOConfig } from '@/types'
import constants from '@/config/constants'

const seo: SEOConfig = {
  title: 'Наставники ЭкоКарьеры — карьера в сфере экологии',
  titleSuffix: 'Менторы ЭкоКарьеры',
  description:
    'Открытое сообщество менторов для передачи опыта, развития навыков и профессионального роста.',
  imageUrl: `${constants.BASE_URL}images/banner.png`,
}

export function pageTitle(name: string): string {
  return `${name} | ${seo.titleSuffix}`
}

export default seo
