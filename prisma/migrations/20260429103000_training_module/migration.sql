DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'SportLevel' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."SportLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ELITE');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'TrainingPlanStatus' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."TrainingPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'WorkoutSessionStatus' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."WorkoutSessionStatus" AS ENUM ('PENDING', 'COMPLETED', 'PARTIAL', 'MISSED');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AIRecommendationStatus' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."AIRecommendationStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');
  END IF;
END
$$;

ALTER TABLE "public"."athlete_profiles"
ADD COLUMN IF NOT EXISTS "primary_modality" TEXT,
ADD COLUMN IF NOT EXISTS "sport_level" "public"."SportLevel",
ADD COLUMN IF NOT EXISTS "sport_goal" TEXT,
ADD COLUMN IF NOT EXISTS "injury_history" TEXT,
ADD COLUMN IF NOT EXISTS "weekly_availability" JSONB,
ADD COLUMN IF NOT EXISTS "available_equipment" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "resting_heart_rate" INTEGER,
ADD COLUMN IF NOT EXISTS "threshold_pace" TEXT,
ADD COLUMN IF NOT EXISTS "max_load_notes" TEXT,
ADD COLUMN IF NOT EXISTS "next_competition_date" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "medical_restrictions" TEXT,
ADD COLUMN IF NOT EXISTS "coach_notes" TEXT;

CREATE TABLE IF NOT EXISTS "public"."exercises" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "created_by" TEXT,
  "name" TEXT NOT NULL,
  "modality" TEXT NOT NULL,
  "stimulus_type" TEXT,
  "intensity_label" TEXT,
  "duration_minutes" INTEGER,
  "series" INTEGER,
  "repetitions" TEXT,
  "load_description" TEXT,
  "distance_meters" INTEGER,
  "video_url" TEXT,
  "image_url" TEXT,
  "instructions" TEXT,
  "contraindications" TEXT,
  "level_recommended" "public"."SportLevel",
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exercises_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exercises_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exercises_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."training_plans" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "athlete_id" TEXT NOT NULL,
  "athlete_profile_id" TEXT,
  "coach_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cycle_goal" TEXT NOT NULL,
  "objective" TEXT,
  "focus_modality" TEXT,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3) NOT NULL,
  "status" "public"."TrainingPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "ai_generated" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "training_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "training_plans_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "training_plans_athlete_profile_id_fkey" FOREIGN KEY ("athlete_profile_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "training_plans_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."training_weeks" (
  "id" TEXT NOT NULL,
  "training_plan_id" TEXT NOT NULL,
  "week_number" INTEGER NOT NULL,
  "focus" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_weeks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "training_weeks_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."training_days" (
  "id" TEXT NOT NULL,
  "training_week_id" TEXT NOT NULL,
  "scheduled_date" TIMESTAMP(3) NOT NULL,
  "day_label" TEXT,
  "title" TEXT NOT NULL,
  "objective" TEXT,
  "is_rest_day" BOOLEAN NOT NULL DEFAULT false,
  "coach_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_days_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "training_days_training_week_id_fkey" FOREIGN KEY ("training_week_id") REFERENCES "public"."training_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."training_day_items" (
  "id" TEXT NOT NULL,
  "training_day_id" TEXT NOT NULL,
  "exercise_id" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "exercise_name" TEXT NOT NULL,
  "instructions" TEXT,
  "intensity_label" TEXT,
  "duration_minutes" INTEGER,
  "series" INTEGER,
  "repetitions" TEXT,
  "load_description" TEXT,
  "distance_meters" INTEGER,
  "pace_target" TEXT,
  "heart_rate_target" TEXT,
  "target_rpe" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_day_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "training_day_items_training_day_id_fkey" FOREIGN KEY ("training_day_id") REFERENCES "public"."training_days"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "training_day_items_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."workout_sessions" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "training_plan_id" TEXT NOT NULL,
  "training_day_id" TEXT NOT NULL,
  "athlete_id" TEXT NOT NULL,
  "athlete_profile_id" TEXT,
  "coach_id" TEXT NOT NULL,
  "status" "public"."WorkoutSessionStatus" NOT NULL DEFAULT 'PENDING',
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "perceived_effort" INTEGER,
  "actual_duration_minutes" INTEGER,
  "actual_load" TEXT,
  "actual_distance_m" INTEGER,
  "actual_pace" TEXT,
  "actual_heart_rate" INTEGER,
  "athlete_notes" TEXT,
  "coach_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workout_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workout_sessions_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workout_sessions_training_day_id_fkey" FOREIGN KEY ("training_day_id") REFERENCES "public"."training_days"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workout_sessions_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workout_sessions_athlete_profile_id_fkey" FOREIGN KEY ("athlete_profile_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "workout_sessions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."athlete_feedbacks" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "workout_session_id" TEXT NOT NULL,
  "athlete_id" TEXT NOT NULL,
  "completed_flag" TEXT NOT NULL,
  "perceived_effort" INTEGER,
  "pain_level" INTEGER,
  "pain_area" TEXT,
  "discomfort_notes" TEXT,
  "observation" TEXT,
  "actual_duration_minutes" INTEGER,
  "actual_load" TEXT,
  "actual_distance_m" INTEGER,
  "actual_pace" TEXT,
  "actual_heart_rate" INTEGER,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "athlete_feedbacks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "athlete_feedbacks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "athlete_feedbacks_workout_session_id_fkey" FOREIGN KEY ("workout_session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "athlete_feedbacks_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."ai_recommendations" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "athlete_id" TEXT,
  "coach_id" TEXT NOT NULL,
  "training_plan_id" TEXT,
  "workout_session_id" TEXT,
  "reviewer_id" TEXT,
  "recommendation_type" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "rationale" TEXT,
  "input_snapshot" JSONB,
  "output_snapshot" JSONB,
  "status" "public"."AIRecommendationStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_recommendations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_recommendations_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_recommendations_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_recommendations_training_plan_id_fkey" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_recommendations_workout_session_id_fkey" FOREIGN KEY ("workout_session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_recommendations_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "exercises_organization_id_modality_active_idx" ON "public"."exercises"("organization_id", "modality", "active");
CREATE INDEX IF NOT EXISTS "training_plans_organization_id_athlete_id_status_idx" ON "public"."training_plans"("organization_id", "athlete_id", "status");
CREATE INDEX IF NOT EXISTS "training_plans_organization_id_coach_id_status_idx" ON "public"."training_plans"("organization_id", "coach_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "training_weeks_training_plan_id_week_number_key" ON "public"."training_weeks"("training_plan_id", "week_number");
CREATE INDEX IF NOT EXISTS "training_days_scheduled_date_idx" ON "public"."training_days"("scheduled_date");
CREATE UNIQUE INDEX IF NOT EXISTS "training_days_training_week_id_scheduled_date_key" ON "public"."training_days"("training_week_id", "scheduled_date");
CREATE INDEX IF NOT EXISTS "training_day_items_training_day_id_sort_order_idx" ON "public"."training_day_items"("training_day_id", "sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "workout_sessions_training_day_id_athlete_id_key" ON "public"."workout_sessions"("training_day_id", "athlete_id");
CREATE INDEX IF NOT EXISTS "workout_sessions_organization_id_athlete_id_status_idx" ON "public"."workout_sessions"("organization_id", "athlete_id", "status");
CREATE INDEX IF NOT EXISTS "workout_sessions_organization_id_coach_id_status_idx" ON "public"."workout_sessions"("organization_id", "coach_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "athlete_feedbacks_workout_session_id_key" ON "public"."athlete_feedbacks"("workout_session_id");
CREATE INDEX IF NOT EXISTS "athlete_feedbacks_organization_id_athlete_id_submitted_at_idx" ON "public"."athlete_feedbacks"("organization_id", "athlete_id", "submitted_at" DESC);
CREATE INDEX IF NOT EXISTS "ai_recommendations_organization_id_coach_id_status_created_at_idx" ON "public"."ai_recommendations"("organization_id", "coach_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "ai_recommendations_organization_id_athlete_id_created_at_idx" ON "public"."ai_recommendations"("organization_id", "athlete_id", "created_at" DESC);
