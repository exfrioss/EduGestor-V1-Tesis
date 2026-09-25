-- Invariantes D-01 que Prisma no puede expresar declarativamente.

CREATE INDEX "RoleAssignmentPermission_active_assignment_permission_idx"
  ON "RoleAssignmentPermission"("roleAssignmentId", "permissionId")
  WHERE "revokedAt" IS NULL;

CREATE OR REPLACE FUNCTION authorization_scope_contains(parent_scope_id UUID, child_scope_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  parent_kind "ScopeKind";
  child_kind "ScopeKind";
  parent_institution UUID;
  child_institution UUID;
BEGIN
  SELECT "kind", "institutionId" INTO parent_kind, parent_institution
    FROM "AccessScope" WHERE "id" = parent_scope_id;
  SELECT "kind", "institutionId" INTO child_kind, child_institution
    FROM "AccessScope" WHERE "id" = child_scope_id;

  IF parent_kind IS NULL OR child_kind IS NULL
     OR parent_kind = 'RESOURCE_SET' OR child_kind = 'RESOURCE_SET'
     OR parent_institution IS DISTINCT FROM child_institution THEN
    RETURN FALSE;
  END IF;
  IF parent_kind = 'INSTITUTION' THEN
    RETURN TRUE;
  END IF;
  IF child_kind <> 'COURSE_SET' THEN
    RETURN FALSE;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1
      FROM "ScopeCourse" child_course
      WHERE child_course."scopeId" = child_scope_id
        AND NOT EXISTS (
          SELECT 1 FROM "ScopeCourse" parent_course
            WHERE parent_course."scopeId" = parent_scope_id
              AND parent_course."courseId" = child_course."courseId"
        )
  );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION validate_permission_delegation_parent()
RETURNS trigger AS $$
DECLARE
  child_scope UUID;
  assignment_grantor UUID;
  parent_permission UUID;
  parent_user UUID;
  parent_scope UUID;
  parent_permission_revoked TIMESTAMPTZ;
  parent_assignment_revoked TIMESTAMPTZ;
  parent_user_active BOOLEAN;
  root_kind "AccountKind";
  root_active BOOLEAN;
  cycle_found BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD."roleAssignmentId", OLD."permissionId", OLD."parentGrantId", OLD."delegatedById"
  ) IS DISTINCT FROM (
    NEW."roleAssignmentId", NEW."permissionId", NEW."parentGrantId", NEW."delegatedById"
  ) THEN
    RAISE EXCEPTION 'La procedencia de una concesión es inmutable' USING ERRCODE = '23514';
  END IF;

  SELECT assignment."scopeId", assignment."grantedById"
    INTO child_scope, assignment_grantor
    FROM "RoleAssignment" assignment
    WHERE assignment."id" = NEW."roleAssignmentId";

  IF assignment_grantor IS DISTINCT FROM NEW."delegatedById" THEN
    RAISE EXCEPTION 'El delegante del permiso debe ser quien creó la asignación de rol' USING ERRCODE = '23514';
  END IF;

  IF NEW."parentGrantId" IS NULL THEN
    SELECT "accountKind", "isActive" INTO root_kind, root_active
      FROM "User" WHERE "id" = NEW."delegatedById";
    IF root_kind IS DISTINCT FROM 'TECHNICAL' OR root_active IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Una concesión raíz solo puede proceder de una cuenta técnica activa' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  WITH RECURSIVE ancestors AS (
    SELECT permission_grant."id", permission_grant."parentGrantId",
           ARRAY[permission_grant."id"] AS path, FALSE AS cycle
      FROM "RoleAssignmentPermission" permission_grant
      WHERE permission_grant."id" = NEW."parentGrantId"
    UNION ALL
    SELECT parent."id", parent."parentGrantId", ancestors.path || parent."id",
           parent."id" = ANY(ancestors.path)
      FROM "RoleAssignmentPermission" parent
      JOIN ancestors ON parent."id" = ancestors."parentGrantId"
      WHERE NOT ancestors.cycle
  )
  SELECT COALESCE(BOOL_OR(cycle OR "id" = NEW."id"), FALSE) INTO cycle_found FROM ancestors;
  IF cycle_found THEN
    RAISE EXCEPTION 'La cadena de delegación no puede contener ciclos' USING ERRCODE = '23514';
  END IF;

  SELECT parent."permissionId", assignment."userId", assignment."scopeId",
         parent."revokedAt", assignment."revokedAt", holder."isActive"
    INTO parent_permission, parent_user, parent_scope,
         parent_permission_revoked, parent_assignment_revoked, parent_user_active
    FROM "RoleAssignmentPermission" parent
    JOIN "RoleAssignment" assignment ON assignment."id" = parent."roleAssignmentId"
    JOIN "User" holder ON holder."id" = assignment."userId"
    WHERE parent."id" = NEW."parentGrantId";

  IF parent_permission IS DISTINCT FROM NEW."permissionId"
     OR parent_user IS DISTINCT FROM NEW."delegatedById" THEN
    RAISE EXCEPTION 'La concesión padre debe pertenecer al delegante y conceder el mismo permiso' USING ERRCODE = '23514';
  END IF;
  IF parent_permission_revoked IS NOT NULL OR parent_assignment_revoked IS NOT NULL
     OR parent_user_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'La concesión padre debe estar vigente' USING ERRCODE = '23514';
  END IF;
  IF NOT authorization_scope_contains(parent_scope, child_scope) THEN
    RAISE EXCEPTION 'El ámbito delegado no puede superar al ámbito padre' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_scope_course_mutation_when_used()
RETURNS trigger AS $$
DECLARE
  affected_scope UUID;
BEGIN
  affected_scope := CASE WHEN TG_OP = 'DELETE' THEN OLD."scopeId" ELSE NEW."scopeId" END;
  IF EXISTS (SELECT 1 FROM "RoleAssignment" WHERE "scopeId" = affected_scope) THEN
    RAISE EXCEPTION 'No se puede modificar el conjunto de cursos de un ámbito concedido' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."scopeId" IS DISTINCT FROM NEW."scopeId"
     AND EXISTS (SELECT 1 FROM "RoleAssignment" WHERE "scopeId" = OLD."scopeId") THEN
    RAISE EXCEPTION 'No se puede modificar el conjunto de cursos de un ámbito concedido' USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ScopeCourse_immutable_when_used_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "ScopeCourse"
FOR EACH ROW EXECUTE FUNCTION prevent_scope_course_mutation_when_used();

CREATE OR REPLACE FUNCTION prevent_role_assignment_context_mutation()
RETURNS trigger AS $$
BEGIN
  IF (OLD."userId", OLD."roleId", OLD."scopeId", OLD."grantedById") IS DISTINCT FROM
     (NEW."userId", NEW."roleId", NEW."scopeId", NEW."grantedById")
     AND EXISTS (
       SELECT 1 FROM "RoleAssignmentPermission" WHERE "roleAssignmentId" = OLD."id"
     ) THEN
    RAISE EXCEPTION 'El contexto de una concesión con permisos es inmutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RoleAssignment_context_immutable_trigger"
BEFORE UPDATE ON "RoleAssignment"
FOR EACH ROW EXECUTE FUNCTION prevent_role_assignment_context_mutation();
