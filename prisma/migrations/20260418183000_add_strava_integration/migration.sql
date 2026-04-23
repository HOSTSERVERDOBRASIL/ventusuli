-- CreateTable
CREATE TABLE "public"."strava_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "strava_athlete_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strava_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."activities" (
    "id" TEXT NOT NULL,
    "external_source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "distance_m" INTEGER,
    "moving_time_s" INTEGER,
    "elapsed_time_s" INTEGER,
    "average_pace_sec_km" DECIMAL(8,2),
    "average_hr" INTEGER,
    "max_hr" INTEGER,
    "elevation_gain_m" INTEGER,
    "activity_date" TIMESTAMP(3) NOT NULL,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "strava_connections_organization_id_strava_athlete_id_key" ON "public"."strava_connections"("organization_id", "strava_athlete_id");

-- CreateIndex
CREATE UNIQUE INDEX "strava_connections_user_id_key" ON "public"."strava_connections"("user_id");

-- CreateIndex
CREATE INDEX "strava_connections_organization_id_updated_at_idx" ON "public"."strava_connections"("organization_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "strava_connections_user_id_idx" ON "public"."strava_connections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "activities_external_source_external_id_key" ON "public"."activities"("external_source", "external_id");

-- CreateIndex
CREATE INDEX "activities_organization_id_user_id_activity_date_idx" ON "public"."activities"("organization_id", "user_id", "activity_date" DESC);

-- CreateIndex
CREATE INDEX "activities_user_id_activity_date_idx" ON "public"."activities"("user_id", "activity_date" DESC);

-- AddForeignKey
ALTER TABLE "public"."strava_connections" ADD CONSTRAINT "strava_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."strava_connections" ADD CONSTRAINT "strava_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
