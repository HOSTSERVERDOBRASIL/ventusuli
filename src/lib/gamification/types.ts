import type { Achievement, AchievementCategory } from "@/lib/gamification/achievements";
import type { LevelTier } from "@/lib/gamification/levels";

export type GamificationBreakdownId =
  | "distance"
  | "completion"
  | "race"
  | "personal-record"
  | "group"
  | "streak"
  | "elevation";

export type GamificationBreakdownItem = {
  id: GamificationBreakdownId;
  label: string;
  value: number;
  helper: string;
};

export type GamificationLevelSnapshot = {
  id: string;
  name: string;
  tier: LevelTier;
  color: string;
  description: string;
  minXp: number;
  maxXp: number | null;
  nextLevelName: string | null;
  progressPercent: number;
  xpIntoLevel: number;
  xpForNext: number;
  remainingXp: number;
  unlocks: string[];
};

export type GamificationAchievementSnapshot = Achievement & {
  category: AchievementCategory;
  unlocked: boolean;
};

export type GamificationSnapshot = {
  totalXp: number;
  level: GamificationLevelSnapshot;
  breakdown: GamificationBreakdownItem[];
  achievements: GamificationAchievementSnapshot[];
  stats: {
    totalKm: number;
    completedRuns: number;
    completedRaces: number;
    personalRecords: number;
    groupTrainings: number;
    bestStreakDays: number;
    currentStreakDays: number;
    elevationGainMeters: number;
    lastActivityAt: string | null;
  };
};
