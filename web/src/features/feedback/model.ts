export const feedbackCategories = ['suggestion', 'problem', 'question'] as const
export type FeedbackCategory = typeof feedbackCategories[number]
export const feedbackPageSize = 25
export const feedbackMessageLimit = 3000

export interface FeedbackEntry {
  id: string
  category: FeedbackCategory
  message: string
  email?: string | null
  createdAt: string
}

export interface FeedbackPage {
  items: FeedbackEntry[]
  hasMore: boolean
}

export const feedbackMessages = {
  title: { ru: 'Обратная связь', en: 'Feedback' },
  suggestion: { ru: 'Предложение', en: 'Suggestion' },
  problem: { ru: 'Проблема', en: 'Problem' },
  question: { ru: 'Вопрос', en: 'Question' },
} as const
