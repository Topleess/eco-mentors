import type { Messages } from '@/i18n/core'
export const messages = {
  title: {
    ru: 'Исследования',
    en: 'Research',
  },
  back: {
    ru: 'Все исследования',
    en: 'All research',
  },
  search: {
    ru: 'Поиск исследований',
    en: 'Search research',
  },
  category: {
    ru: 'Категория',
    en: 'Category',
  },
  year: {
    ru: 'Год',
    en: 'Year',
  },
  all: {
    ru: 'Все',
    en: 'All',
  },
  empty: {
    ru: 'Исследований не найдено',
    en: 'No research found',
  },
  sample: {
    ru: 'Учебный пример на русском языке. Не реальные результаты исследования.',
    en: 'Sample Russian content. Not real research findings.',
  },
  learn: {
    ru: 'Изучить',
    en: 'Learn / Inspect',
  },
  explore: {
    ru: 'Каталог',
    en: 'Explore',
  },
  toc: {
    ru: 'Содержание',
    en: 'Contents',
  },
  findings: {
    ru: 'Основные выводы',
    en: 'Key findings',
  },
  citation: {
    ru: 'Как цитировать',
    en: 'Citation',
  },
  share: {
    ru: 'Поделиться',
    en: 'Share',
  },
  shared: {
    ru: 'Ссылка скопирована',
    en: 'Link copied',
  },
  shareError: {
    ru: 'Не удалось поделиться ссылкой',
    en: 'Could not share the link',
  },
  pdf: {
    ru: 'Открыть PDF',
    en: 'Open PDF',
  },
  download: {
    ru: 'Скачать PDF',
    en: 'Download PDF',
  },
  minutes: {
    ru: 'мин чтения',
    en: 'min read',
  },
  new: {
    ru: 'Создать исследование',
    en: 'New research',
  },
  edit: {
    ru: 'Редактор исследования',
    en: 'Research editor',
  },
  save: {
    ru: 'Сохранить',
    en: 'Save',
  },
  saved: {
    ru: 'Сохранено и проверено',
    en: 'Saved and verified',
  },
  saving: {
    ru: 'Сохранение…',
    en: 'Saving…',
  },
  error: {
    ru: 'Не удалось сохранить. Данные сохранены в форме. Повторите попытку.',
    en: 'Save failed. Your edits remain in the form. Please retry.',
  },
  conflict: {
    ru: 'Конфликт версий. Изменения оставлены в форме. Откройте актуальную запись в другой вкладке и сравните перед повтором.',
    en: 'Version conflict. Your edits remain here. Open the current record in another tab and compare before retrying.',
  },
  loading: {
    ru: 'Загрузка…',
    en: 'Loading…',
  },
  loadError: {
    ru: 'Не удалось загрузить данные',
    en: 'Could not load data',
  },
  retry: {
    ru: 'Повторить',
    en: 'Retry',
  },
  public: {
    ru: 'Открыть публикацию',
    en: 'View publication',
  },
  unsaved: {
    ru: 'Есть несохранённые изменения. Покинуть страницу?',
    en: 'You have unsaved changes. Leave this page?',
  },
  titleField: {
    ru: 'Заголовок',
    en: 'Title',
  },
  summary: {
    ru: 'Краткое описание',
    en: 'Summary',
  },
  author: {
    ru: 'Автор',
    en: 'Author',
  },
  publishedOn: {
    ru: 'Дата публикации',
    en: 'Publication date',
  },
  readingMinutes: {
    ru: 'Время чтения, минуты',
    en: 'Reading time, minutes',
  },
  coverUrl: {
    ru: 'URL обложки (необязательно)',
    en: 'Cover URL (optional)',
  },
  coverAlt: {
    ru: 'Описание обложки',
    en: 'Cover description',
  },
  pdfUrl: {
    ru: 'URL PDF (необязательно)',
    en: 'PDF URL (optional)',
  },
  status: {
    ru: 'Статус',
    en: 'Status',
  },
  draft: {
    ru: 'Черновик',
    en: 'Draft',
  },
  published: {
    ru: 'Опубликовано',
    en: 'Published',
  },
  archived: {
    ru: 'Архив',
    en: 'Archived',
  },
  sections: {
    ru: 'Разделы',
    en: 'Sections',
  },
  sectionTitle: {
    ru: 'Название раздела',
    en: 'Section title',
  },
  body: {
    ru: 'Текст раздела (абзацы через пустую строку)',
    en: 'Section text (blank lines separate paragraphs)',
  },
  add: {
    ru: 'Добавить раздел',
    en: 'Add section',
  },
  remove: {
    ru: 'Удалить раздел',
    en: 'Remove section',
  },
  up: {
    ru: 'Выше',
    en: 'Move up',
  },
  down: {
    ru: 'Ниже',
    en: 'Move down',
  },
  findingHelp: {
    ru: 'Каждый вывод с новой строки',
    en: 'One finding per line',
  },
  invalid: {
    ru: 'Проверьте обязательные поля, разделы, дату и URL. Допустимы HTTPS или /research-assets/.',
    en: 'Check required fields, sections, date and URLs. Use HTTPS or /research-assets/.',
  },
  coverFileHelp: { ru: 'JPEG, PNG или WEBP, до {limit}', en: 'JPEG, PNG or WEBP, up to {limit}' },
  coverPreviewFailed: { ru: 'Не удалось показать обложку', en: 'Cover preview unavailable' },
  coverReplace: { ru: 'Заменить обложку', en: 'Replace cover' },
  coverRemove: { ru: 'Убрать обложку', en: 'Remove cover' },
  coverEmpty: { ru: 'Обложка не выбрана', en: 'No cover selected' },
  coverManual: { ru: 'Указать URL вручную', en: 'Enter URL manually' },
  coverTooLarge: { ru: 'Файл слишком большой. Выберите изображение меньше 10 MB.', en: 'File too large. Choose a smaller image, up to 10 MB.' },
  coverRejected: { ru: 'Изображение не принято. Выберите другой JPEG, PNG или WEBP.', en: 'Image rejected. Choose another JPEG, PNG or WEBP.' },
  coverUploadError: { ru: 'Не удалось загрузить обложку. Повторите попытку позже.', en: 'Cover upload failed. Please retry later.' },
  coverInvalidFile: { ru: 'Выберите непустой JPEG, PNG или WEBP до 10 MB.', en: 'Choose a non-empty JPEG, PNG or WEBP up to 10 MB.' },
  chooseCover: { ru: 'Выбрать файл обложки', en: 'Choose cover file' },
  coverPreview: { ru: 'Предпросмотр обложки', en: 'Cover preview' },
  coverUpload: { ru: 'Загрузить обложку', en: 'Upload cover' },
  coverUploading: { ru: 'Загрузка обложки…', en: 'Uploading cover…' },
  coverSaveHint: { ru: 'Сохраните исследование, чтобы применить обложку', en: 'Save the research to apply the cover' },
} satisfies Messages
