export interface ActivitySummary {
  kmNoAno: number;
  volume30dKm: number;
  previous30dKm: number;
  consistencyPercent: number;
  activeWeeksInYear: number;
  activityCountInYear: number;
}

export interface EvolutionPoint {
  month: string;
  current: number;
  previous: number;
}

export interface DistributionSlice {
  name: string;
  value: number;
  color: string;
}

export interface PersonalRecordItem {
  id: "best5k" | "best21k" | "best42k";
  label: string;
  value: string;
  event: string;
  achievedAt: string;
}

export interface AchievementItem {
  id: string;
  label: string;
  tone: "info" | "warning" | "success";
}

export interface RankingEntry {
  id: string;
  name: string;
  points: number;
  position: number;
}

export interface RankingSnapshot {
  leaderboard: RankingEntry[];
  currentUser: RankingEntry | null;
  totalAthletes: number;
}
