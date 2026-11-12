-- Synthetic fixtures only. Re-running must preserve edits made through the UI.
BEGIN;
INSERT INTO moderators (id, name, email, role)
VALUES ('a0000000-0000-4000-8000-000000000001', 'Локальный администратор', 'demo-admin@openmentor.test', 'admin')
ON CONFLICT (id) DO NOTHING;
INSERT INTO mentors (id, slug, name, job_title, workplace, about, details, competencies, experience, price, status, email, preferred_contact, privacy)
VALUES
('b0000000-0000-4000-8000-000000000001', 'local-mentor', 'Тестовый ментор', 'Эколог', 'Локальная экологическая практика', 'Тестовый профиль для редактирования кабинета ментора.', 'Помогаю разрабатывать и проверять локальный OpenMentor.', 'Экологическая отчётность', '5-10', 'Free', 'active', 'demo-mentor@openmentor.test', '@local_mentor', false),
('b0000000-0000-4000-8000-000000000002', 'local-pending', 'Ментор на модерации', 'Тестировщик', 'Локальная разработка', 'Синтетическая заявка для проверки кабинета администратора.', 'Можно одобрить или вернуть на доработку.', 'Тестирование', '2-5', 'Free', 'pending', 'pending-mentor@openmentor.test', '@local_pending', false)
ON CONFLICT (id) DO NOTHING;
-- Explicit synthetic QA fixture upgrade, never a migration of real mentors.
UPDATE mentors SET job_title = 'Эколог', workplace = 'Локальная экологическая практика',
    competencies = 'Экологическая отчётность'
WHERE id = 'b0000000-0000-4000-8000-000000000001'
  AND email = 'demo-mentor@openmentor.test' AND job_title = 'Разработчик';
INSERT INTO mentor_tags (mentor_id, tag_id)
SELECT mentor.id, tags.id FROM mentors mentor CROSS JOIN tags
WHERE mentor.id = 'b0000000-0000-4000-8000-000000000001'
  AND mentor.email = 'demo-mentor@openmentor.test'
  AND tags.name = 'Экологическая отчётность'
  AND EXISTS (SELECT 1 FROM mentor_tags old JOIN tags legacy ON legacy.id = old.tag_id
              WHERE old.mentor_id = mentor.id AND legacy.name = 'Backend')
ON CONFLICT DO NOTHING;
DELETE FROM mentor_tags mt USING mentors mentor, tags legacy
WHERE mt.mentor_id = mentor.id AND mt.tag_id = legacy.id
  AND mentor.id = 'b0000000-0000-4000-8000-000000000001'
  AND mentor.email = 'demo-mentor@openmentor.test' AND legacy.name = 'Backend'
  AND EXISTS (SELECT 1 FROM mentor_tags selected JOIN tags ecology ON ecology.id = selected.tag_id
              WHERE selected.mentor_id = mentor.id AND ecology.name = 'Экологическая отчётность');
INSERT INTO mentor_tags (mentor_id, tag_id)
SELECT mentor.id, tags.id FROM mentors mentor CROSS JOIN tags
WHERE ((mentor.id = 'b0000000-0000-4000-8000-000000000001' AND mentor.email = 'demo-mentor@openmentor.test')
    OR (mentor.id = 'b0000000-0000-4000-8000-000000000002' AND mentor.email = 'pending-mentor@openmentor.test'))
  AND tags.name = 'Экологическая отчётность'
  AND NOT EXISTS (SELECT 1 FROM mentor_tags existing WHERE existing.mentor_id = mentor.id)
ON CONFLICT DO NOTHING;
INSERT INTO client_requests (id, mentor_id, email, name, preferred_contact, description, level, status)
VALUES ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'mentee@openmentor.test', 'Тестовый участник', '@local_mentee', 'Тестовый запрос: хочу обсудить план обучения разработке.', 'junior', 'pending')
ON CONFLICT (id) DO NOTHING;
COMMIT;
