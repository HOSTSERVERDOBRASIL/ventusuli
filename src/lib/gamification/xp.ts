export type ActivityForXp = {
  distanceKm?: number;
  durationMinutes?: number;
  completedRun?: boolean;
  completedRace?: boolean;
  personalRecord?: boolean;
  groupTraining?: boolean;
  streakDays?: number;
  elevationGainMeters?: number;
};

export type XpBreakdown = {
  distanceXp: number;
  completionXp: number;
  raceXp: number;
  personalRecordXp: number;
  groupXp: number;
  streakXp: number;
  elevationXp: number;
  totalXp: number;
};

export type XpSummaryInput = {
  totalKm: number;
  completedRuns: number;
  completedRaces: number;
  personalRecords: number;
  groupTrainings: number;
  bestStreakDays: number;
  elevationGainMeters: number;
};

export function calculateActivityXp(activity: ActivityForXp): XpBreakdown {
  const distanceKm = activity.distanceKm ?? 0;
  const streakDays = activity.streakDays ?? 0;
  const elevationGainMeters = activity.elevationGainMeters ?? 0;

  const distanceXp = Math.round(distanceKm * 10);
  const completionXp = activity.completedRun ? 20 : 0;
  const raceXp = activity.completedRace ? 100 : 0;
  const personalRecordXp = activity.personalRecord ? 150 : 0;
  const groupXp = activity.groupTraining ? 30 : 0;
  const streakXp = Math.min(streakDays * 5, 150);
  const elevationXp = Math.round(elevationGainMeters / 20);

  const totalXp =
    distanceXp +
    completionXp +
    raceXp +
    personalRecordXp +
    groupXp +
    streakXp +
    elevationXp;

  return {
    distanceXp,
    completionXp,
    raceXp,
    personalRecordXp,
    groupXp,
    streakXp,
    elevationXp,
    totalXp,
  };
}

export function calculateSummaryXp(input: XpSummaryInput): XpBreakdown {
  const distanceXp = Math.round(input.totalKm * 10);
  const completionXp = input.completedRuns * 20;
  const raceXp = input.completedRaces * 100;
  const personalRecordXp = input.personalRecords * 150;
  const groupXp = input.groupTrainings * 30;
  const streakXp = Math.min(input.bestStreakDays * 5, 150);
  const elevationXp = Math.round(input.elevationGainMeters / 20);

  const totalXp =
    distanceXp +
    completionXp +
    raceXp +
    personalRecordXp +
    groupXp +
    streakXp +
    elevationXp;

  return {
    distanceXp,
    completionXp,
    raceXp,
    personalRecordXp,
    groupXp,
    streakXp,
    elevationXp,
    totalXp,
  };
}

export function calculateMonthlyXp(params: {
  totalKm: number;
  completedRuns: number;
  completedRaces: number;
  personalRecords: number;
  groupTrainings: number;
  bestStreakDays: number;
}) {
  return (
    params.totalKm * 10 +
    params.completedRuns * 20 +
    params.completedRaces * 100 +
    params.personalRecords * 150 +
    params.groupTrainings * 30 +
    Math.min(params.bestStreakDays * 5, 150)
  );
}
