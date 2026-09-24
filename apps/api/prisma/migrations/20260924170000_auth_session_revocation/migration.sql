-- Las desactivaciones invalidan todas las sesiones de acceso inmediatamente,
-- incluso si una operación futura actualiza la entidad fuera del servicio HTTP.

CREATE OR REPLACE FUNCTION revoke_sessions_for_disabled_user()
RETURNS trigger AS $$
BEGIN
  IF OLD."isActive" = true AND NEW."isActive" = false THEN
    UPDATE "AuthSession"
      SET "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP,
          "rowVersion" = "rowVersion" + 1
      WHERE "userId" = NEW."id" AND "revokedAt" IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "User_revoke_sessions_when_disabled_trigger"
AFTER UPDATE OF "isActive" ON "User"
FOR EACH ROW EXECUTE FUNCTION revoke_sessions_for_disabled_user();

CREATE OR REPLACE FUNCTION revoke_sessions_for_disabled_teacher()
RETURNS trigger AS $$
BEGIN
  IF OLD."isActive" = true AND NEW."isActive" = false THEN
    UPDATE "AuthSession"
      SET "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP,
          "rowVersion" = "rowVersion" + 1
      WHERE "userId" = NEW."userId" AND "revokedAt" IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Teacher_revoke_sessions_when_disabled_trigger"
AFTER UPDATE OF "isActive" ON "Teacher"
FOR EACH ROW EXECUTE FUNCTION revoke_sessions_for_disabled_teacher();
