-- phase: expand
ALTER TABLE moderators DROP CONSTRAINT moderators_role_chk;
ALTER TABLE moderators ADD COLUMN revoked_role TEXT;
ALTER TABLE moderators ADD CONSTRAINT moderators_role_chk CHECK (role IN ('admin', 'moderator', 'revoked'));
ALTER TABLE moderators ADD CONSTRAINT moderators_revoked_role_chk CHECK ((role = 'revoked' AND revoked_role IS NOT NULL AND revoked_role IN ('admin','moderator')) OR (role <> 'revoked' AND revoked_role IS NULL));
