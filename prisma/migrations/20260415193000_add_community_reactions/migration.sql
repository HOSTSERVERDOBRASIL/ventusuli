DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommunityReactionType') THEN
    CREATE TYPE "public"."CommunityReactionType" AS ENUM ('LIKE', 'FIRE', 'APPLAUSE');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "public"."community_reactions" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "public"."CommunityReactionType" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_reactions_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_reactions_post_id_fkey'
  ) THEN
    ALTER TABLE "public"."community_reactions"
      ADD CONSTRAINT "community_reactions_post_id_fkey"
      FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_reactions_organization_id_fkey'
  ) THEN
    ALTER TABLE "public"."community_reactions"
      ADD CONSTRAINT "community_reactions_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_reactions_user_id_fkey'
  ) THEN
    ALTER TABLE "public"."community_reactions"
      ADD CONSTRAINT "community_reactions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "community_reactions_post_id_user_id_type_key"
  ON "public"."community_reactions"("post_id", "user_id", "type");

CREATE INDEX IF NOT EXISTS "community_reactions_post_id_type_idx"
  ON "public"."community_reactions"("post_id", "type");

CREATE INDEX IF NOT EXISTS "community_reactions_organization_id_created_at_idx"
  ON "public"."community_reactions"("organization_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "community_reactions_user_id_idx"
  ON "public"."community_reactions"("user_id");
