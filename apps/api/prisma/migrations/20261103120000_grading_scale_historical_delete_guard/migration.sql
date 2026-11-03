-- A scale remains historically used after its active assignment reference is removed.
CREATE FUNCTION prevent_used_grading_scale_delete() RETURNS trigger AS $$
BEGIN
  IF OLD."lockedAt" IS NOT NULL
     OR EXISTS (SELECT 1 FROM "TeachingAssignment" WHERE "gradingScaleId" = OLD."id") THEN
    RAISE EXCEPTION 'Used grading scale cannot be deleted' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GradingScale_preserve_used_history_trigger" BEFORE DELETE ON "GradingScale"
FOR EACH ROW EXECUTE FUNCTION prevent_used_grading_scale_delete();
