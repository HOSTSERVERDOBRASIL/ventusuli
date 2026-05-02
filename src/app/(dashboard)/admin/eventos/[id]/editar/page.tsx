"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { EventForm } from "@/components/events/event-form";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { type EventStatus, type EventView } from "@/components/events/types";
import { getEventById, updateAdminEvent } from "@/services/events-service";

export default function EditarEventoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuthToken();
  const [event, setEvent] = useState<EventView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const payload = await getEventById(params.id, accessToken);
        if (!cancelled) setEvent(payload);
      } catch {
        if (!cancelled) setEvent(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, params.id]);

  const handleSubmit = async ({
    status,
    values,
  }: {
    status: EventStatus;
    values: {
      name: string;
      city: string;
      state: string;
      address?: string;
      latitude?: number | null;
      longitude?: number | null;
      check_in_radius_m?: number;
      proximity_radius_m?: number;
      event_date: string;
      registration_deadline?: string;
      description?: string;
      image_url?: string;
      external_url?: string;
      distances: Array<{
        label: string;
        distance_km: number;
        price_cents: number;
        max_slots?: number;
      }>;
    };
  }) => {
    try {
      await updateAdminEvent(params.id, values, status, accessToken);
      toast.success(status === "PUBLISHED" ? "Prova publicada com sucesso." : "Prova atualizada.");
      router.push("/admin/eventos");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar prova.";
      toast.error(message);
    }
  };

  if (loading) {
    return <LoadingState lines={4} />;
  }

  if (!event) {
    return (
      <EmptyState
        title="Prova não encontrada"
        description="Não foi possível carregar os dados da prova selecionada."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar Prova"
        subtitle="Atualize os dados e distâncias da prova selecionada."
      />
      <EventForm mode="edit" initialEvent={event} onSubmit={handleSubmit} />
    </div>
  );
}
