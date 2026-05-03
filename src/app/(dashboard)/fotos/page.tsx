"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Camera, Download, Gift, LockKeyhole, ShoppingBag, Unlock } from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";

interface MyPhoto {
  id: string;
  galleryId: string;
  eventId: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  watermarkUrl: string | null;
  priceCents: number;
  pointsCost: number;
  takenAt: string | null;
  uploadedAt: string;
  matchType: string;
  matchStatus: string;
  isUnlocked: boolean;
  unlockType: string | null;
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string | null): string {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-BR");
}

export default function FotosPage() {
  const { accessToken, hydrated } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<MyPhoto[]>([]);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/photos/my", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        cache: "no-store",
      });
      const payload = (await response.json()) as { data?: MyPhoto[] };
      setPhotos(response.ok ? payload.data ?? [] : []);
    } catch {
      toast.error("Não foi possível carregar suas fotos.");
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!hydrated) return;
    void load();
  }, [hydrated, load]);

  const metrics = useMemo(() => {
    const unlocked = photos.filter((photo) => photo.isUnlocked).length;
    const pointsEligible = photos.filter((photo) => photo.pointsCost > 0 && !photo.isUnlocked).length;
    const paidPotential = photos.filter((photo) => photo.priceCents > 0).length;
    return { unlocked, pointsEligible, paidPotential };
  }, [photos]);

  const unlockWithPoints = async (photo: MyPhoto) => {
    setBusyPhotoId(photo.id);
    try {
      const response = await fetch(`/api/photos/${photo.id}/unlock-with-points`, {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const payload = (await response.json()) as { error?: { message?: string }; alreadyUnlocked?: boolean };
      if (!response.ok) throw new Error(payload.error?.message ?? "Falha ao desbloquear foto.");
      toast.success(payload.alreadyUnlocked ? "Foto já estava desbloqueada." : "Foto desbloqueada com pontos.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao desbloquear foto.");
    } finally {
      setBusyPhotoId(null);
    }
  };

  const requestDownload = async (photo: MyPhoto) => {
    setBusyPhotoId(photo.id);
    try {
      const response = await fetch(`/api/photos/${photo.id}/download`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const payload = (await response.json()) as {
        data?: { downloadUrl?: string | null; storageKey?: string };
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Falha ao solicitar download.");
      if (payload.data?.downloadUrl) window.open(payload.data.downloadUrl, "_blank", "noopener,noreferrer");
      toast.success("Download liberado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao solicitar download.");
    } finally {
      setBusyPhotoId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fotos"
        subtitle="Galerias de provas, compras, desbloqueios por pontos e downloads liberados."
        actions={
          <ActionButton asChild intent="secondary">
            <Link href="/recompensas">Ver pontos</Link>
          </ActionButton>
        }
      />

      {loading ? (
        <LoadingState lines={5} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard label="Minhas fotos" value={photos.length} icon={Camera} tone="highlight" />
            <MetricCard label="Liberadas" value={metrics.unlocked} icon={LockKeyhole} />
            <MetricCard label="Com preço" value={metrics.paidPotential} icon={ShoppingBag} />
            <MetricCard label="Por pontos" value={metrics.pointsEligible} icon={Download} />
          </div>

          <SectionCard title="Minhas fotos" description="Fotos vinculadas ao atleta por prova, número de peito ou curadoria da equipe.">
            {photos.length === 0 ? (
              <EmptyState
                title="Nenhuma foto vinculada"
                description="Quando uma galeria for publicada e houver fotos vinculadas ao seu perfil, elas aparecerão aqui."
                action={
                  <ActionButton asChild intent="secondary">
                    <Link href="/provas">Ver provas</Link>
                  </ActionButton>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {photos.map((photo) => (
                  <article key={photo.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#102640] text-white">
                    <div className="relative h-48 bg-[#07192b]">
                      {photo.thumbnailUrl || photo.previewUrl || photo.watermarkUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.isUnlocked ? photo.previewUrl ?? photo.thumbnailUrl ?? "" : photo.watermarkUrl ?? photo.thumbnailUrl ?? photo.previewUrl ?? ""}
                          alt="Foto do atleta"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-500">
                          <Camera className="h-8 w-8" />
                        </div>
                      )}
                      <div className="absolute left-3 top-3">
                        <StatusBadge label={photo.isUnlocked ? "Liberada" : "Bloqueada"} tone={photo.isUnlocked ? "positive" : "warning"} />
                      </div>
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3 text-sm">
                        <div>
                          <p className="font-semibold">Foto vinculada</p>
                          <p className="text-xs text-slate-400">{formatDate(photo.takenAt ?? photo.uploadedAt)}</p>
                        </div>
                        <p className="text-right text-xs text-slate-300">
                          {photo.pointsCost > 0 ? `${photo.pointsCost} pts` : formatMoney(photo.priceCents)}
                        </p>
                      </div>
                      {photo.isUnlocked ? (
                        <ActionButton size="sm" className="w-full" onClick={() => void requestDownload(photo)} disabled={busyPhotoId === photo.id}>
                          <Download className="mr-2 h-4 w-4" />
                          Baixar foto
                        </ActionButton>
                      ) : photo.pointsCost > 0 ? (
                        <ActionButton size="sm" className="w-full" onClick={() => void unlockWithPoints(photo)} disabled={busyPhotoId === photo.id}>
                          <Unlock className="mr-2 h-4 w-4" />
                          Desbloquear com pontos
                        </ActionButton>
                      ) : (
                        <ActionButton size="sm" className="w-full" disabled>
                          <ShoppingBag className="mr-2 h-4 w-4" />
                          Compra em breve
                        </ActionButton>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-3">
            {[
              ["Fotos por prova", "Galerias agrupadas por evento, modalidade e data."],
              ["Comprar fotos", "Checkout para fotos individuais ou pacotes."],
              ["Desbloquear com pontos", "Uso do saldo disponível para liberar downloads elegíveis."],
            ].map(([title, description]) => (
              <article key={title} className="rounded-xl border border-white/10 bg-[#102640] p-4 text-white">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-sky-400/10 text-sky-200">
                  <Gift className="h-5 w-5" />
                </div>
                <p className="text-lg font-semibold">{title}</p>
                <p className="mt-2 min-h-[44px] text-sm leading-6 text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
