ALTER TABLE "print_jobs" ADD COLUMN "next_retry_at" TIMESTAMP(3);
CREATE INDEX "idx_print_jobs_retry" ON "print_jobs"("store_id", "status", "next_retry_at");
