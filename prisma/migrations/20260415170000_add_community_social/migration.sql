-- CreateTable
CREATE TABLE "public"."community_posts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tab" TEXT NOT NULL DEFAULT 'Feed',
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."community_comments" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_posts_organization_id_created_at_idx" ON "public"."community_posts"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "community_posts_user_id_idx" ON "public"."community_posts"("user_id");

-- CreateIndex
CREATE INDEX "community_comments_post_id_created_at_idx" ON "public"."community_comments"("post_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "community_comments_organization_id_created_at_idx" ON "public"."community_comments"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "community_comments_user_id_idx" ON "public"."community_comments"("user_id");

-- AddForeignKey
ALTER TABLE "public"."community_posts" ADD CONSTRAINT "community_posts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_posts" ADD CONSTRAINT "community_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_comments" ADD CONSTRAINT "community_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_comments" ADD CONSTRAINT "community_comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."community_comments" ADD CONSTRAINT "community_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
