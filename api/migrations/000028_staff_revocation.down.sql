-- phase: contract
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM moderators WHERE role = 'revoked') THEN
    RAISE EXCEPTION 'Cannot roll back while staff accounts are revoked';
  END IF;
END $$;
ALTER TABLE moderators DROP CONSTRAINT moderators_revoked_role_chk;
ALTER TABLE moderators DROP CONSTRAINT moderators_role_chk;
ALTER TABLE moderators DROP COLUMN revoked_role;
ALTER TABLE moderators ADD CONSTRAINT moderators_role_chk CHECK (role IN ('admin', 'moderator'));
