export interface ActivitySummary {
  kmNoAno: number;
  volume30dKm: number;
  previous30dKm: number;
  movingTime30dSeconds: number;
  previousMovingTime30dSeconds: number;
  activityCount30d: number;
  previousActivityCount30d: number;
  consistencyPercent: number;
  activeWeeksInYear: number;
  activityCountInYear: number;
}

export interface EvolutionPoint {
  month: string;
  current: number;
  previous: number;
  durationMinutes: number;
  previousDurationMinutes: number;
  sessions: number;
  previousSessions: number;
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

export interface RecentActivityItem {
  id: string;
  name: string;
  type: string;
  source: string;
  distanceKm: number;
  durationMinutes: number;
  pace: string | null;
  activityDate: string;
}
