-- Deliberately retain ecological seeds and any mentor associations.
-- Removing them would cascade user choices; rollback of the application is safe
-- with these additive rows still present. No data is discarded or restored.
SELECT 1;
