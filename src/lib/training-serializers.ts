import { Prisma } from "@prisma/client";
import {
  AthleteTrainingProfile,
  TrainingSessionFeedback,
  TrainingPlanSummary,
  TrainingSessionSummary,
} from "@/services/types";

export function mapAthleteTrainingProfile(
  profile:
    | {
        primary_modality: string | null;
        sport_level: string | null;
        sport_goal: string | null;
        injury_history: string | null;
        weekly_availability: Prisma.JsonValue | null;
        available_equipment: string[];
        resting_heart_rate: number | null;
        threshold_pace: string | null;
        max_load_notes: string | null;
        next_competition_date: Date | null;
        medical_restrictions: string | null;
        coach_notes: string | null;
      }
    | null
    | undefined,
): AthleteTrainingProfile | null {
  if (!profile) return null;
  return {
    primaryModality: profile.primary_modality,
    sportLevel: (profile.sport_level as AthleteTrainingProfile["sportLevel"]) ?? null,
    sportGoal: profile.sport_goal,
    injuryHistory: profile.injury_history,
    weeklyAvailability:
      profile.weekly_availability && typeof profile.weekly_availability === "object" && !Array.isArray(profile.weekly_availability)
        ? (profile.weekly_availability as Record<string, unknown>)
        : null,
    availableEquipment: profile.available_equipment ?? [],
    restingHeartRate: profile.resting_heart_rate,
    thresholdPace: profile.threshold_pace,
    maxLoadNotes: profile.max_load_notes,
    nextCompetitionDate: profile.next_competition_date?.toISOString() ?? null,
    medicalRestrictions: profile.medical_restrictions,
    coachNotes: profile.coach_notes,
  };
}

export function mapTrainingSession(
  session: {
    id: string;
    status: string;
    perceived_effort: number | null;
    coach_notes: string | null;
    athlete_notes: string | null;
    completed_at: Date | null;
    training_day: {
      id: string;
      scheduled_date: Date;
      title: string;
      objective: string | null;
      is_rest_day: boolean;
      items: Array<{
        id: string;
        sort_order: number;
        exercise_id: string | null;
        exercise_name: string;
        instructions: string | null;
        intensity_label: string | null;
        duration_minutes: number | null;
        series: number | null;
        repetitions: string | null;
        load_description: string | null;
        distance_meters: number | null;
        pace_target: string | null;
        heart_rate_target: string | null;
        target_rpe: number | null;
        notes: string | null;
      }>;
    };
    feedback?: {
      id: string;
      completed_flag: string;
      perceived_effort: number | null;
      pain_level: number | null;
      pain_area: string | null;
      discomfort_notes: string | null;
      observation: string | null;
      actual_duration_minutes: number | null;
      actual_load: string | null;
      actual_distance_m: number | null;
      actual_pace: string | null;
      actual_heart_rate: number | null;
      submitted_at: Date;
    } | null;
  },
): TrainingSessionSummary {
  return {
    id: session.id,
    trainingDayId: session.training_day.id,
    scheduledDate: session.training_day.scheduled_date.toISOString(),
    title: session.training_day.title,
    objective: session.training_day.objective,
    isRestDay: session.training_day.is_rest_day,
    status: session.status as TrainingSessionSummary["status"],
    perceivedEffort: session.perceived_effort,
    coachNotes: session.coach_notes,
    athleteNotes: session.athlete_notes,
    completedAt: session.completed_at?.toISOString() ?? null,
    exercises: session.training_day.items.map((item) => ({
      id: item.id,
      sortOrder: item.sort_order,
      exerciseId: item.exercise_id,
      exerciseName: item.exercise_name,
      instructions: item.instructions,
      intensityLabel: item.intensity_label,
      durationMinutes: item.duration_minutes,
      series: item.series,
      repetitions: item.repetitions,
      loadDescription: item.load_description,
      distanceMeters: item.distance_meters,
      paceTarget: item.pace_target,
      heartRateTarget: item.heart_rate_target,
      targetRpe: item.target_rpe,
      notes: item.notes,
    })),
    feedback: session.feedback
      ? {
          id: session.feedback.id,
          completedFlag: session.feedback.completed_flag as TrainingSessionFeedback["completedFlag"],
          perceivedEffort: session.feedback.perceived_effort,
          painLevel: session.feedback.pain_level,
          painArea: session.feedback.pain_area,
          discomfortNotes: session.feedback.discomfort_notes,
          observation: session.feedback.observation,
          actualDurationMinutes: session.feedback.actual_duration_minutes,
          actualLoad: session.feedback.actual_load,
          actualDistanceM: session.feedback.actual_distance_m,
          actualPace: session.feedback.actual_pace,
          actualHeartRate: session.feedback.actual_heart_rate,
          submittedAt: session.feedback.submitted_at.toISOString(),
        }
      : null,
  };
}

export function mapTrainingPlan(
  plan: {
    id: string;
    athlete_id: string;
    coach_id: string;
    name: string;
    cycle_goal: string;
    objective: string | null;
    focus_modality: string | null;
    start_date: Date;
    end_date: Date;
    status: string;
    ai_generated: boolean;
    version: number;
    notes: string | null;
    athlete: { name: string };
    coach: { name: string };
    weeks: Array<{
      id: string;
      week_number: number;
      focus: string | null;
      notes: string | null;
      days: Array<{
        id: string;
        scheduled_date: Date;
        title: string;
        objective: string | null;
        is_rest_day: boolean;
        sessions: Array<{
          id: string;
          status: string;
          perceived_effort: number | null;
          coach_notes: string | null;
          athlete_notes: string | null;
          completed_at: Date | null;
          feedback: {
            id: string;
            completed_flag: string;
            perceived_effort: number | null;
            pain_level: number | null;
            pain_area: string | null;
            discomfort_notes: string | null;
            observation: string | null;
            actual_duration_minutes: number | null;
            actual_load: string | null;
            actual_distance_m: number | null;
            actual_pace: string | null;
            actual_heart_rate: number | null;
            submitted_at: Date;
          } | null;
        }>;
        items: Array<{
          id: string;
          sort_order: number;
          exercise_id: string | null;
          exercise_name: string;
          instructions: string | null;
          intensity_label: string | null;
          duration_minutes: number | null;
          series: number | null;
          repetitions: string | null;
          load_description: string | null;
          distance_meters: number | null;
          pace_target: string | null;
          heart_rate_target: string | null;
          target_rpe: number | null;
          notes: string | null;
        }>;
      }>;
    }>;
    ai_recommendations: Array<{
      id: string;
      recommendation_type: string;
      summary: string;
      rationale: string | null;
      status: string;
      created_at: Date;
      reviewed_at: Date | null;
    }>;
  },
): TrainingPlanSummary {
  return {
    id: plan.id,
    athleteId: plan.athlete_id,
    athleteName: plan.athlete.name,
    coachId: plan.coach_id,
    coachName: plan.coach.name,
    name: plan.name,
    cycleGoal: plan.cycle_goal,
    objective: plan.objective,
    focusModality: plan.focus_modality,
    startDate: plan.start_date.toISOString(),
    endDate: plan.end_date.toISOString(),
    status: plan.status as TrainingPlanSummary["status"],
    aiGenerated: plan.ai_generated,
    version: plan.version,
    notes: plan.notes,
    weeks: plan.weeks.map((week) => ({
      id: week.id,
      weekNumber: week.week_number,
      focus: week.focus,
      notes: week.notes,
      days: week.days.map((day) => {
        const session = day.sessions[0];
        return mapTrainingSession({
          id: session?.id ?? `${day.id}-virtual`,
          status: session?.status ?? "PENDING",
          perceived_effort: session?.perceived_effort ?? null,
          coach_notes: session?.coach_notes ?? null,
          athlete_notes: session?.athlete_notes ?? null,
          completed_at: session?.completed_at ?? null,
          feedback: session?.feedback ?? null,
          training_day: {
            id: day.id,
            scheduled_date: day.scheduled_date,
            title: day.title,
            objective: day.objective,
            is_rest_day: day.is_rest_day,
            items: day.items,
          },
        });
      }),
    })),
    recommendations: plan.ai_recommendations.map((item) => ({
      id: item.id,
      recommendationType: item.recommendation_type,
      summary: item.summary,
      rationale: item.rationale,
      status: item.status as TrainingPlanSummary["recommendations"][number]["status"],
      createdAt: item.created_at.toISOString(),
      reviewedAt: item.reviewed_at?.toISOString() ?? null,
    })),
  };
}
