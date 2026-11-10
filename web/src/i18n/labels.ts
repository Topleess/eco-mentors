import type { Locale } from './core'

// Keys are canonical API/filter values. Only the rendered label is translated.
const russianLabels: Record<string, string> = {
  Engineering: 'Разработка', 'AI & Data': 'ИИ и данные', Infrastructure: 'Инфраструктура',
  'Product & Design': 'Продукт и дизайн', 'Leadership & Career': 'Лидерство и карьера',
  'Business & Communication': 'Бизнес и коммуникации', Backend: 'Бэкенд', Frontend: 'Фронтенд',
  Mobile: 'Мобильная разработка', 'System Design': 'Проектирование систем', Security: 'Информационная безопасность',
  'QA & Test Automation': 'Тестирование и автоматизация', 'AI/LLM Engineering': 'Разработка ИИ и языковых моделей',
  'Machine Learning': 'Машинное обучение', 'Data Engineering': 'Инженерия данных', 'Data & Analytics': 'Данные и аналитика',
  'DevOps/SRE': 'DevOps/SRE', 'Platform Engineering': 'Платформенная инженерия', 'Cloud & Infrastructure': 'Облачные технологии и инфраструктура',
  Databases: 'Базы данных', 'Product Management': 'Управление продуктом', 'UX/UI Design': 'UX/UI-дизайн',
  'Engineering Management': 'Управление разработкой', 'Tech Lead': 'Техническое лидерство', 'Staff+/IC Growth': 'Развитие экспертизы Staff+/IC',
  'Career Growth': 'Карьерное развитие', 'Interview Prep': 'Подготовка к собеседованиям',
  'Compensation & Negotiation': 'Зарплата и переговоры', 'Relocation & Working Abroad': 'Релокация и работа за рубежом',
  'Project Management': 'Управление проектами', 'Entrepreneurship & Startups': 'Предпринимательство и стартапы',
  'Freelancing & Consulting': 'Фриланс и консалтинг', 'Developer Relations': 'Работа с сообществом разработчиков',
  'Technical Writing': 'Технические тексты', 'Marketing & Growth': 'Маркетинг и рост', 'People & HR': 'Управление персоналом и HR',
  Free: 'Бесплатно', Negotiable: 'По договорённости', '≤$50': 'До $50', '$50–100': '$50–100', '$100–200': '$100–200', '$200+': 'От $200',
  '2-5 years': '2–5 лет', '5-10 years': '5–10 лет', '10+ years': '10+ лет',
  '2-5': '2–5 лет', '5-10': '5–10 лет', '10+': 'Более 10 лет',
  junior: 'Начинающий', middle: 'Средний уровень', senior: 'Опытный', lead: 'Руководитель',
}

export function translateLabel(locale: Locale, value: string): string {
  return locale === 'ru' ? russianLabels[value] ?? value : value
}
