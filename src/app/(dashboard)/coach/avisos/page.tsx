"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { NoticeCard } from "@/components/notices/notice-card";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { getNotices } from "@/services/notice-service";
import { NoticeItem } from "@/services/types";

export default function CoachAvisosPage() {
  const { accessToken, hydrated } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNotices({ accessToken, status: "PUBLISHED" });
      setNotices(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Falha ao carregar avisos.";
      setNotices([]);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getNotices({ accessToken, status: "PUBLISHED" });
        if (!cancelled) setNotices(data);
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof Error ? loadError.message : "Falha ao carregar avisos.";
          setNotices([]);
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coach • Avisos"
        subtitle="Comunicados oficiais da assessoria para suporte da rotina técnica."
      />

      <SectionCard
        title="Mural institucional"
        description="Somente avisos publicados e liberados para o perfil de coach."
      >
        {loading ? (
          <LoadingState lines={4} />
        ) : error ? (
          <EmptyState
            title="Avisos indisponíveis"
            description={error}
            action={
              <ActionButton size="sm" onClick={() => void load()}>
                Tentar novamente
              </ActionButton>
            }
          />
        ) : notices.length === 0 ? (
          <EmptyState
            title="Nenhum aviso publicado"
            description="Não existem comunicados oficiais para o seu perfil no momento."
          />
        ) : (
          <div className="space-y-3">
            {notices.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} canPublish={false} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
