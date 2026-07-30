-- 발급 사유 템플릿
CREATE TABLE "grant_templates" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "is_auto" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "grant_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_grant_templates_store" ON "grant_templates"("store_id");
CREATE INDEX "idx_grant_templates_auto" ON "grant_templates"("is_auto");

ALTER TABLE "grant_templates" ADD CONSTRAINT "grant_templates_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;

-- 권한설정 변경 이력
CREATE TABLE "grant_change_logs" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "grant_type" TEXT NOT NULL,
    "changed_field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "grant_change_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_grant_change_logs_store" ON "grant_change_logs"("store_id");
CREATE INDEX "idx_grant_change_logs_time" ON "grant_change_logs"("created_at" DESC);

ALTER TABLE "grant_change_logs" ADD CONSTRAINT "grant_change_logs_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "grant_change_logs" ADD CONSTRAINT "grant_change_logs_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "users"("id");

-- 기존 테이블에 batch_id, template_id 컬럼 추가
ALTER TABLE "point_grant_history"
    ADD COLUMN "batch_id" TEXT,
    ADD COLUMN "template_id" INTEGER;

CREATE INDEX IF NOT EXISTS "idx_point_grant_history_batch" ON "point_grant_history"("batch_id");

ALTER TABLE "point_grant_history" ADD CONSTRAINT "point_grant_history_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "grant_templates"("id");

ALTER TABLE "coupon_issue_history"
    ADD COLUMN "batch_id" TEXT,
    ADD COLUMN "template_id" INTEGER;

CREATE INDEX IF NOT EXISTS "idx_coupon_issue_history_batch" ON "coupon_issue_history"("batch_id");

ALTER TABLE "coupon_issue_history" ADD CONSTRAINT "coupon_issue_history_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "grant_templates"("id");

-- 기본 템플릿 시드
INSERT INTO "grant_templates" ("title", "reason", "is_auto") VALUES
    ('생일축하', '생일을 진심으로 축하드립니다!', false),
    ('방문감사', '방문해 주셔서 감사합니다.', false),
    ('첫방문 기념', '첫 방문을 환영합니다!', false),
    ('이벤트 당첨', '이벤트에 당첨되셨습니다. 축하드립니다!', false),
    ('리뷰 감사', '소중한 리뷰를 남겨주셔서 감사합니다.', false),
    ('재방문 감사', '다시 방문해 주셔서 감사합니다.', false);
