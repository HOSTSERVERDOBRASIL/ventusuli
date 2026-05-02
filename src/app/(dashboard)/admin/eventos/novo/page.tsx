"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { EventForm } from "@/components/events/event-form";
import { PageHeader } from "@/components/system/page-header";
import type { EventStatus } from "@/components/events/types";
import { createAdminEvent } from "@/services/events-service";

export default function NovoEventoPage() {
  const router = useRouter();
  const { accessToken } = useAuthToken();

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
      await createAdminEvent(values, status, accessToken);
      toast.success(
        status === "PUBLISHED" ? "Prova publicada com sucesso." : "Rascunho salvo com sucesso.",
      );
      router.push("/admin/eventos");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar prova.";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nova Prova"
        subtitle="Cadastre os dados da prova e configure as distâncias."
      />
      <EventForm mode="create" onSubmit={handleSubmit} />
    </div>
  );
}
