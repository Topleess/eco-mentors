-- Synthetic fixtures only. Re-running must preserve edits made through the UI.
BEGIN;
INSERT INTO moderators (id, name, email, role)
VALUES ('a0000000-0000-4000-8000-000000000001', 'Локальный администратор', 'demo-admin@openmentor.test', 'admin')
ON CONFLICT (id) DO NOTHING;
INSERT INTO mentors (id, slug, name, job_title, workplace, about, details, competencies, experience, price, status, email, preferred_contact, privacy)
VALUES
('b0000000-0000-4000-8000-000000000001', 'local-mentor', 'Тестовый ментор', 'Разработчик', 'Локальная разработка', 'Тестовый профиль для редактирования кабинета ментора.', 'Помогаю разрабатывать и проверять локальный OpenMentor.', 'Разработка программного обеспечения', '5-10', 'Free', 'active', 'demo-mentor@openmentor.test', '@local_mentor', false),
('b0000000-0000-4000-8000-000000000002', 'local-pending', 'Ментор на модерации', 'Тестировщик', 'Локальная разработка', 'Синтетическая заявка для проверки кабинета администратора.', 'Можно одобрить или вернуть на доработку.', 'Тестирование', '2-5', 'Free', 'pending', 'pending-mentor@openmentor.test', '@local_pending', false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO mentor_tags (mentor_id, tag_id)
SELECT mentor.id, tags.id FROM mentors mentor CROSS JOIN tags
WHERE mentor.id IN ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002')
  AND tags.name = 'Backend'
  AND NOT EXISTS (SELECT 1 FROM mentor_tags existing WHERE existing.mentor_id = mentor.id)
ON CONFLICT DO NOTHING;
INSERT INTO client_requests (id, mentor_id, email, name, preferred_contact, description, level, status)
VALUES ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'mentee@openmentor.test', 'Тестовый участник', '@local_mentee', 'Тестовый запрос: хочу обсудить план обучения разработке.', 'junior', 'pending')
ON CONFLICT (id) DO NOTHING;
COMMIT;
