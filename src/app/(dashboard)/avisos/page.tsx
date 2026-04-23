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

export default function AvisosPage() {
  const { accessToken, hydrated } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getNotices({ accessToken, status: "PUBLISHED" });
        if (!cancelled) setNotices(data);
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Falha ao carregar avisos.";
          setNotices([]);
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avisos"
        subtitle="Comunicados oficiais publicados pela assessoria para sua organização."
      />

      <SectionCard title="Mural oficial" description="Somente avisos publicados e liberados para o seu perfil">
        {loading ? (
          <LoadingState lines={4} />
        ) : error ? (
          <EmptyState
            title="Avisos indisponíveis"
            description={error}
            action={(
              <ActionButton
                size="sm"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  void getNotices({ accessToken, status: "PUBLISHED" })
                    .then((data) => {
                      setNotices(data);
                    })
                    .catch((retryError) => {
                      const message = retryError instanceof Error ? retryError.message : "Falha ao carregar avisos.";
                      setNotices([]);
                      setError(message);
                      toast.error(message);
                    })
                    .finally(() => {
                      setLoading(false);
                    });
                }}
              >
                Tentar novamente
              </ActionButton>
            )}
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
