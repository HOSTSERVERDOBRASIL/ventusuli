"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import {
  AthletePerformanceDashboard,
  type ManualActivityFormState,
} from "@/components/dashboard/athlete-performance-dashboard";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { getCommunityFeed } from "@/services/community-service";
import { getDashboardData } from "@/services/dashboard-service";
import type { CommunityFeedData, DashboardData } from "@/services/types";
import { UserRole } from "@/types";

function getLocalDateTimeValue(date = new Date()): string {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function parseDecimalInput(value: string): number {
  return Number(value.replace(",", "."));
}

const EMPTY_MANUAL_ACTIVITY: ManualActivityFormState = {
  distanceKm: "",
  durationMinutes: "",
  activityDate: getLocalDateTimeValue(),
  elevationGainM: "",
  note: "",
};

export default function DashboardPage() {
  const { accessToken, userRole, userRoles } = useAuthToken();
  const [data, setData] = useState<DashboardData | null>(null);
  const [communityFeed, setCommunityFeed] = useState<CommunityFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [manualActivity, setManualActivity] =
    useState<ManualActivityFormState>(EMPTY_MANUAL_ACTIVITY);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const isPremiumAthlete =
    userRole === UserRole.PREMIUM_ATHLETE || userRoles.includes(UserRole.PREMIUM_ATHLETE);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setDashboardError(null);
      setCommunityError(null);

      try {
        const result = await getDashboardData({ accessToken, userRole });
        if (!cancelled) setData(result.data);
      } catch (loadError) {
        if (!cancelled) {
          setData(null);
          setDashboardError(
            loadError instanceof Error
              ? loadError.message
              : "Falha ao carregar dados do dashboard.",
          );
        }
      }

      try {
        const community = await getCommunityFeed({ accessToken });
        if (!cancelled) setCommunityFeed(community.data);
      } catch (communityLoadError) {
        if (!cancelled) {
          setCommunityFeed(null);
          setCommunityError(
            communityLoadError instanceof Error
              ? communityLoadError.message
              : "Falha ao carregar feed da comunidade.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, userRole, reloadKey]);

  const handleManualActivitySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const distanceKm = parseDecimalInput(manualActivity.distanceKm);
    const durationMinutes = parseDecimalInput(manualActivity.durationMinutes);
    const elevationGainM = manualActivity.elevationGainM
      ? Math.round(parseDecimalInput(manualActivity.elevationGainM))
      : undefined;
    const activityDate = new Date(manualActivity.activityDate);

    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      toast.error("Informe uma distância válida.");
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      toast.error("Informe um tempo válido.");
      return;
    }

    if (Number.isNaN(activityDate.getTime())) {
      toast.error("Informe uma data válida para o treino.");
      return;
    }

    if (elevationGainM !== undefined && !Number.isFinite(elevationGainM)) {
      toast.error("Informe uma elevação válida ou deixe o campo em branco.");
      return;
    }

    setManualSubmitting(true);
    try {
      const response = await fetch("/api/activities/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          distanceKm,
          durationMinutes,
          activityDate: activityDate.toISOString(),
          elevationGainM,
          note: manualActivity.note,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Não foi possível salvar o treino manual.");
      }

      toast.success(payload?.message ?? "Treino manual salvo.");
      setManualActivity({ ...EMPTY_MANUAL_ACTIVITY, activityDate: getLocalDateTimeValue() });
      setReloadKey((prev) => prev + 1);
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível salvar o treino manual.",
      );
    } finally {
      setManualSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#04111f] p-4">
        <div className="mx-auto max-w-[1440px] space-y-3">
          <LoadingState lines={2} />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="surface-shimmer h-24 rounded-lg" />
            ))}
          </div>
          <LoadingState lines={5} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#04111f] p-4">
        <EmptyState
          title="Dashboard indisponível"
          description={dashboardError ?? "Não foi possível carregar os dados."}
          action={
            <ActionButton size="sm" onClick={() => setReloadKey((prev) => prev + 1)}>
              Tentar novamente
            </ActionButton>
          }
        />
      </div>
    );
  }

  return (
    <AthletePerformanceDashboard
      data={data}
      warnings={data.dataWarnings ?? []}
      communityFeed={communityFeed}
      communityError={communityError}
      manualActivity={manualActivity}
      setManualActivity={setManualActivity}
      onManualActivitySubmit={handleManualActivitySubmit}
      manualSubmitting={manualSubmitting}
      isPremiumAthlete={isPremiumAthlete}
    />
  );
}
