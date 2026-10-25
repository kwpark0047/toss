-- Prevent concurrent clock-in requests from creating multiple open records
-- for the same staff member. Existing duplicates must be reviewed explicitly;
-- this migration fails before changing data if any are present.
DO $$
BEGIN
  IF EXISTS (
    SELECT staff_id
    FROM public.staff_attendance
    WHERE clock_out IS NULL
    GROUP BY staff_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'staff_attendance contains multiple open records for a staff member; reconcile them before applying this migration';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_attendance_one_open_per_staff
  ON public.staff_attendance (staff_id)
  WHERE clock_out IS NULL;
