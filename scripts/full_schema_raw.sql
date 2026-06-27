-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "content" TEXT NOT NULL,
    "author_id" INTEGER NOT NULL,
    "author_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "order_id" INTEGER,
    "payment_id" INTEGER,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics" (
    "id" SERIAL NOT NULL,
    "endpoint" TEXT,
    "method" TEXT,
    "response_time" INTEGER,
    "status_code" INTEGER,
    "store_id" INTEGER,
    "user_id" INTEGER,
    "timestamp" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "product_name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "options" TEXT,
    "user_phone" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "table_id" INTEGER,
    "order_number" TEXT NOT NULL,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "notes" TEXT,
    "status" TEXT DEFAULT 'pending',
    "method" TEXT,
    "payment_status" TEXT DEFAULT 'pending',
    "total_amount" INTEGER DEFAULT 0,
    "queue_number" INTEGER,
    "estimated_minutes" INTEGER,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "toss_user_key" TEXT,
    "updated_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "is_takeout" INTEGER DEFAULT 0,
    "preparing_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "split_type" TEXT DEFAULT 'NONE',
    "is_split_payment" BOOLEAN DEFAULT false,
    "split_status" TEXT DEFAULT 'PENDING',
    "handled_by_staff_id" INTEGER,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "store_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" INTEGER NOT NULL,
    "point_amount" INTEGER DEFAULT 0,
    "cash_amount" INTEGER DEFAULT 0,
    "toss_pay_token" TEXT,
    "payment_key" TEXT,
    "toss_transaction_id" TEXT,
    "transfer_confirmed" BOOLEAN DEFAULT false,
    "transfer_confirmed_at" TIMESTAMP(3),
    "transfer_reference" TEXT,
    "points_earned" INTEGER DEFAULT 0,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "order_name" TEXT,
    "method" TEXT,
    "receipt_url" TEXT,
    "checkout_url" TEXT,
    "card_company" TEXT,
    "card_number" TEXT,
    "installment_months" INTEGER DEFAULT 0,
    "easy_pay_provider" TEXT,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "raw_response" TEXT,
    "payer_phone" TEXT,
    "is_partial" BOOLEAN DEFAULT false,
    "approved_at" TIMESTAMP(3),
    "cancel_reason" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_requests" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "current_plan" TEXT NOT NULL DEFAULT 'free',
    "requested_plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "admin_note" TEXT,
    "reviewed_by" INTEGER,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "plan_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_transactions" (
    "id" SERIAL NOT NULL,
    "user_point_id" INTEGER NOT NULL,
    "store_id" INTEGER NOT NULL,
    "order_id" INTEGER,
    "payment_id" INTEGER,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT,
    "reference_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" SERIAL NOT NULL,
    "board_type" TEXT NOT NULL DEFAULT 'free',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" INTEGER NOT NULL,
    "author_name" TEXT NOT NULL,
    "is_pinned" BOOLEAN DEFAULT false,
    "view_count" INTEGER DEFAULT 0,
    "comment_count" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "image_url" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "is_sold_out" BOOLEAN DEFAULT false,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "detail_description" TEXT,
    "options" TEXT,
    "nutrition_info" TEXT,
    "allergens" TEXT,
    "ingredients" TEXT,
    "spicy_level" INTEGER DEFAULT 0,
    "is_popular" INTEGER DEFAULT 0,
    "is_new" INTEGER DEFAULT 0,
    "tags" TEXT,
    "detail_images" TEXT,
    "cooking_time" INTEGER DEFAULT 5,
    "updated_at" TIMESTAMP(3),
    "stock_quantity" INTEGER,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_history" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "store_id" INTEGER NOT NULL,
    "change" INTEGER NOT NULL,
    "qty_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "order_id" INTEGER,
    "note" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "total_sales" INTEGER DEFAULT 0,
    "total_refunds" INTEGER DEFAULT 0,
    "commission_amount" INTEGER DEFAULT 0,
    "vat_amount" INTEGER DEFAULT 0,
    "net_amount" INTEGER DEFAULT 0,
    "status" TEXT DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" TEXT DEFAULT 'staff',
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_account_requests" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "count" INTEGER DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "admin_note" TEXT,
    "reviewed_by" INTEGER,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "staff_account_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_accounts" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "bank_code" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_holder" TEXT NOT NULL,
    "toss_account_id" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_point_settings" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "is_enabled" BOOLEAN DEFAULT true,
    "earn_rate" DOUBLE PRECISION DEFAULT 1.0,
    "min_earn_amount" INTEGER DEFAULT 1000,
    "max_use_rate" DOUBLE PRECISION DEFAULT 100,
    "min_use_points" INTEGER DEFAULT 100,
    "expiry_days" INTEGER DEFAULT 365,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_point_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_receipt_settings" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "header_logo" TEXT,
    "title" TEXT DEFAULT '영수증',
    "greetings" TEXT DEFAULT '방문해 주셔서 감사합니다.',
    "footer_text" TEXT DEFAULT '교환/환불은 영수증 지참 시 7일 이내 가능합니다.',
    "show_order_number" BOOLEAN DEFAULT true,
    "show_item_details" BOOLEAN DEFAULT true,
    "show_store_address" BOOLEAN DEFAULT true,
    "show_points" BOOLEAN DEFAULT true,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_receipt_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_staff" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "name" TEXT NOT NULL,
    "role" TEXT DEFAULT 'staff',
    "pin_code" TEXT,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "theme" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "can_send_sms" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "business_type" TEXT,
    "open_time" TEXT,
    "close_time" TEXT,
    "plan" TEXT DEFAULT 'free',

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tables" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "table_number" TEXT NOT NULL,
    "qr_code" TEXT NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "capacity" INTEGER DEFAULT 2,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT DEFAULT 'available',
    "x" INTEGER DEFAULT 0,
    "y" INTEGER DEFAULT 0,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_points" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "toss_user_key" TEXT,
    "phone" TEXT,
    "total_points" INTEGER DEFAULT 0,
    "lifetime_earned" INTEGER DEFAULT 0,
    "lifetime_used" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT DEFAULT 'user',
    "fcm_token" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "customer_phone" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "sender_id" INTEGER,
    "sender_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_cart_items" (
    "id" SERIAL NOT NULL,
    "table_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "user_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waiting_list" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "customer_name" TEXT,
    "customer_phone" TEXT NOT NULL,
    "party_size" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "queue_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "called_at" TIMESTAMP(3),

    CONSTRAINT "waiting_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "order_id" INTEGER,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "content" TEXT NOT NULL,
    "image_url" TEXT,
    "is_best" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_likes" (
    "id" SERIAL NOT NULL,
    "review_id" INTEGER NOT NULL,
    "user_phone" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_customers" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "customer_name" TEXT,
    "customer_phone" TEXT NOT NULL,
    "toss_user_key" TEXT,
    "visit_count" INTEGER NOT NULL DEFAULT 1,
    "total_spent" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'GENERAL',
    "last_visit_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "store_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_tier_settings" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "tier_name" TEXT NOT NULL,
    "min_spent" INTEGER NOT NULL DEFAULT 0,
    "earn_rate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "store_tier_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "min_order_amount" INTEGER NOT NULL DEFAULT 0,
    "valid_days" INTEGER NOT NULL DEFAULT 30,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_coupons" (
    "id" SERIAL NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "coupon_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNUSED',
    "used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "user_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_settings" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "target_tier" TEXT,
    "coupon_id" INTEGER NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "campaign_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "party_size" INTEGER NOT NULL DEFAULT 2,
    "reservation_time" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_templates" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "option_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_comments_parent" ON "comments"("parent_id");

-- CreateIndex
CREATE INDEX "idx_comments_post" ON "comments"("post_id");

-- CreateIndex
CREATE INDEX "idx_ledger_store" ON "ledger"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "idx_orders_created_at" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "idx_orders_store_id" ON "orders"("store_id");

-- CreateIndex
CREATE INDEX "idx_payments_payment_key" ON "payments"("payment_key");

-- CreateIndex
CREATE INDEX "idx_payments_store_id" ON "payments"("store_id");

-- CreateIndex
CREATE INDEX "idx_payments_order_id" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "idx_payments_status" ON "payments"("status");

-- CreateIndex
CREATE INDEX "idx_payments_store" ON "payments"("store_id");

-- CreateIndex
CREATE INDEX "idx_payments_order" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "idx_plan_requests_status" ON "plan_requests"("status");

-- CreateIndex
CREATE INDEX "idx_plan_requests_store" ON "plan_requests"("store_id");

-- CreateIndex
CREATE INDEX "idx_point_transactions_store" ON "point_transactions"("store_id");

-- CreateIndex
CREATE INDEX "idx_point_transactions_user" ON "point_transactions"("user_point_id");

-- CreateIndex
CREATE INDEX "idx_posts_pinned" ON "posts"("is_pinned");

-- CreateIndex
CREATE INDEX "idx_posts_author" ON "posts"("author_id");

-- CreateIndex
CREATE INDEX "idx_posts_board_type" ON "posts"("board_type");

-- CreateIndex
CREATE INDEX "idx_stock_history_product" ON "stock_history"("product_id");

-- CreateIndex
CREATE INDEX "idx_stock_history_store_time" ON "stock_history"("store_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_settlements_store" ON "settlements"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "sqlite_autoindex_staff_1" ON "staff"("store_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_staff_requests_status" ON "staff_account_requests"("status");

-- CreateIndex
CREATE INDEX "idx_staff_requests_store" ON "staff_account_requests"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "sqlite_autoindex_store_accounts_1" ON "store_accounts"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "sqlite_autoindex_store_point_settings_1" ON "store_point_settings"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "sqlite_autoindex_store_receipt_settings_1" ON "store_receipt_settings"("store_id");

-- CreateIndex
CREATE INDEX "idx_store_staff_store_id" ON "store_staff"("store_id");

-- CreateIndex
CREATE INDEX "idx_stores_user_id" ON "stores"("user_id");

-- CreateIndex
CREATE INDEX "idx_notifications_store_read" ON "notifications"("store_id", "is_read");

-- CreateIndex
CREATE INDEX "idx_notifications_store_time" ON "notifications"("store_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sqlite_autoindex_tables_1" ON "tables"("qr_code");

-- CreateIndex
CREATE UNIQUE INDEX "sqlite_autoindex_user_points_1" ON "user_points"("toss_user_key");

-- CreateIndex
CREATE INDEX "idx_user_points_phone" ON "user_points"("phone");

-- CreateIndex
CREATE INDEX "idx_user_points_toss_key" ON "user_points"("toss_user_key");

-- CreateIndex
CREATE UNIQUE INDEX "sqlite_autoindex_users_1" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_chat_rooms_store" ON "chat_rooms"("store_id");

-- CreateIndex
CREATE INDEX "idx_chat_messages_room" ON "chat_messages"("room_id");

-- CreateIndex
CREATE INDEX "idx_shared_cart_table" ON "shared_cart_items"("table_id");

-- CreateIndex
CREATE INDEX "idx_waiting_list_store" ON "waiting_list"("store_id");

-- CreateIndex
CREATE INDEX "idx_waiting_list_phone" ON "waiting_list"("customer_phone");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_order_id_key" ON "reviews"("order_id");

-- CreateIndex
CREATE INDEX "idx_reviews_store" ON "reviews"("store_id");

-- CreateIndex
CREATE INDEX "idx_reviews_created" ON "reviews"("created_at");

-- CreateIndex
CREATE INDEX "idx_review_likes_id" ON "review_likes"("review_id");

-- CreateIndex
CREATE INDEX "idx_store_customers_store" ON "store_customers"("store_id");

-- CreateIndex
CREATE INDEX "idx_store_customers_phone" ON "store_customers"("customer_phone");

-- CreateIndex
CREATE UNIQUE INDEX "store_customers_store_id_customer_phone_key" ON "store_customers"("store_id", "customer_phone");

-- CreateIndex
CREATE INDEX "idx_tier_settings_store" ON "store_tier_settings"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_tier_settings_store_id_tier_name_key" ON "store_tier_settings"("store_id", "tier_name");

-- CreateIndex
CREATE INDEX "idx_coupons_store" ON "coupons"("store_id");

-- CreateIndex
CREATE INDEX "idx_user_coupons_phone" ON "user_coupons"("customer_phone");

-- CreateIndex
CREATE INDEX "idx_campaigns_store" ON "campaign_settings"("store_id");

-- CreateIndex
CREATE INDEX "idx_reservations_store" ON "reservations"("store_id");

-- CreateIndex
CREATE INDEX "idx_reservations_phone" ON "reservations"("customer_phone");

-- CreateIndex
CREATE INDEX "idx_reservations_time" ON "reservations"("reservation_time");

-- CreateIndex
CREATE INDEX "idx_option_templates_store" ON "option_templates"("store_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_handled_by_staff_id_fkey" FOREIGN KEY ("handled_by_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_requests_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_point_id_fkey" FOREIGN KEY ("user_point_id") REFERENCES "user_points"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_account_requests" ADD CONSTRAINT "staff_account_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_account_requests" ADD CONSTRAINT "staff_account_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_account_requests" ADD CONSTRAINT "staff_account_requests_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "store_accounts" ADD CONSTRAINT "store_accounts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "store_point_settings" ADD CONSTRAINT "store_point_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "store_receipt_settings" ADD CONSTRAINT "store_receipt_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "store_staff" ADD CONSTRAINT "store_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "store_staff" ADD CONSTRAINT "store_staff_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_points" ADD CONSTRAINT "user_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_cart_items" ADD CONSTRAINT "shared_cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_cart_items" ADD CONSTRAINT "shared_cart_items_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_customers" ADD CONSTRAINT "store_customers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_tier_settings" ADD CONSTRAINT "store_tier_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_settings" ADD CONSTRAINT "campaign_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_templates" ADD CONSTRAINT "option_templates_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

