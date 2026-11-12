import type { Locale } from './core'

// Keys are canonical API/filter values. Only the rendered label is translated.
const russianLabels: Record<string, string> = {
  Free: 'Бесплатно', Negotiable: 'По договорённости', '≤$50': 'До $50', '$50–100': '$50–100', '$100–200': '$100–200', '$200+': 'От $200',
  '2-5 years': '2–5 лет', '5-10 years': '5–10 лет', '10+ years': '10+ лет',
  '2-5': '2–5 лет', '5-10': '5–10 лет', '10+': 'Более 10 лет',
  junior: 'Начинающий', middle: 'Средний уровень', senior: 'Опытный', lead: 'Руководитель',
}

const englishLabels: Record<string, string> = {
  "Экология предприятий": "Enterprise ecology",
  "Природоохранные проекты": "Conservation projects",
  "Климат": "Climate",
  "ESG и устойчивое развитие": "ESG and sustainable development",
  "Карьера и трудоустройство": "Careers and employment",
  "Исследования": "Research",
  "Производственный экологический контроль": "Industrial environmental monitoring",
  "Экологическая отчётность": "Environmental reporting",
  "Оценка воздействия на окружающую среду": "Environmental impact assessment",
  "Экологическое проектирование": "Environmental design",
  "Углеродный учёт": "Carbon accounting",
  "Климатические проекты": "Climate projects",
  "Нефинансовая отчётность": "Non-financial reporting",
  "Зелёные финансы": "Green finance",
  "Выбор карьерной траектории": "Choosing a career path",
  "Резюме и собеседования": "CVs and interviews",
  "Экологические исследования": "Environmental research",
  "ГИС и пространственные данные": "GIS and spatial data"
}

export function translateLabel(locale: Locale, value: string): string {
  return locale === 'ru' ? russianLabels[value] ?? value : englishLabels[value] ?? value
}
