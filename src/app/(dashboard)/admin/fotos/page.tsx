"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Camera, Download, Image, Plus, ShieldCheck, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { ModuleTabs, type ModuleTabItem } from "@/components/system/module-tabs";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type PhotosTab = "overview" | "galleries" | "pricing";

interface GalleryRow {
  id: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  photosCount: number;
  createdAt: string;
}

interface PhotoRow {
  id: string;
  galleryId: string;
  originalUrl: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  priceCents: number;
  pointsCost: number;
  status: "PROCESSING" | "PUBLISHED" | "HIDDEN" | "ARCHIVED";
  uploadedAt: string;
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusTone(status: string): "positive" | "warning" | "neutral" {
  if (status === "PUBLISHED" || status === "ACTIVE") return "positive";
  if (status === "DRAFT" || status === "PROCESSING") return "warning";
  return "neutral";
}

export default function AdminFotosPage() {
  const { accessToken, hydrated } = useAuthToken();
  const [activeTab, setActiveTab] = useState<PhotosTab>("overview");
  const [loading, setLoading] = useState(true);
  const [galleries, setGalleries] = useState<GalleryRow[]>([]);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [savingGallery, setSavingGallery] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [galleryForm, setGalleryForm] = useState({ title: "", description: "", status: "DRAFT" });
  const [photoForm, setPhotoForm] = useState({
    galleryId: "",
    imageUrl: "",
    priceCents: "0",
    pointsCost: "0",
    status: "PUBLISHED",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
      const [galleryResponse, photoResponse] = await Promise.all([
        fetch("/api/admin/photos/galleries", { headers, cache: "no-store" }),
        fetch("/api/admin/photos", { headers, cache: "no-store" }),
      ]);
      const galleryPayload = (await galleryResponse.json()) as { data?: GalleryRow[] };
      const photoPayload = (await photoResponse.json()) as { data?: PhotoRow[] };
      setGalleries(galleryResponse.ok ? galleryPayload.data ?? [] : []);
      setPhotos(photoResponse.ok ? photoPayload.data ?? [] : []);
    } catch {
      toast.error("Não foi possível carregar fotos.");
      setGalleries([]);
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
    const publishedPhotos = photos.filter((photo) => photo.status === "PUBLISHED").length;
    const pending = photos.filter((photo) => photo.status === "PROCESSING").length;
    const pointsEligible = photos.filter((photo) => photo.pointsCost > 0).length;
    const revenuePotential = photos.reduce((sum, photo) => sum + photo.priceCents, 0);
    return { publishedPhotos, pending, pointsEligible, revenuePotential };
  }, [photos]);

  const tabs = useMemo<ModuleTabItem<PhotosTab>[]>(
    () => [
      {
        key: "overview",
        label: "Painel",
        audience: "Gestão",
        description: "Galerias, publicações, downloads e pendências.",
        icon: Image,
        metricLabel: "Galerias",
        metricValue: galleries.length,
        metricTone: galleries.length ? "positive" : "neutral",
      },
      {
        key: "galleries",
        label: "Galerias",
        audience: "Operação",
        description: "Organização por prova e pipeline de arquivos.",
        icon: Camera,
        metricLabel: "Fotos",
        metricValue: photos.length,
        metricTone: photos.length ? "positive" : "neutral",
      },
      {
        key: "pricing",
        label: "Vendas",
        audience: "Comercial",
        description: "Precificação, pontos, pacotes e desbloqueios.",
        icon: Download,
        metricLabel: "Pontos",
        metricValue: metrics.pointsEligible,
        metricTone: metrics.pointsEligible ? "positive" : "neutral",
      },
    ],
    [galleries.length, metrics.pointsEligible, photos.length],
  );

  const createGallery = async () => {
    if (!galleryForm.title.trim()) return toast.error("Informe o título da galeria.");
    setSavingGallery(true);
    try {
      const response = await fetch("/api/admin/photos/galleries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          title: galleryForm.title,
          description: galleryForm.description || null,
          status: galleryForm.status,
        }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Falha ao criar galeria.");
      setGalleryForm({ title: "", description: "", status: "DRAFT" });
      toast.success("Galeria criada.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar galeria.");
    } finally {
      setSavingGallery(false);
    }
  };

  const createPhoto = async () => {
    if (!photoForm.galleryId) return toast.error("Selecione uma galeria.");
    if (!photoForm.imageUrl.trim()) return toast.error("Informe a URL da foto.");
    setSavingPhoto(true);
    try {
      const response = await fetch("/api/admin/photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          galleryId: photoForm.galleryId,
          originalStorageKey: `manual/${Date.now()}`,
          originalUrl: photoForm.imageUrl,
          previewUrl: photoForm.imageUrl,
          thumbnailUrl: photoForm.imageUrl,
          watermarkUrl: photoForm.imageUrl,
          priceCents: Number(photoForm.priceCents) || 0,
          pointsCost: Number(photoForm.pointsCost) || 0,
          status: photoForm.status,
        }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Falha ao cadastrar foto.");
      setPhotoForm((current) => ({ ...current, imageUrl: "", priceCents: "0", pointsCost: "0" }));
      toast.success("Foto cadastrada.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao cadastrar foto.");
    } finally {
      setSavingPhoto(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fotos"
        subtitle="Operação de galerias, upload, precificação, desbloqueio por pontos e downloads seguros."
        actions={
          <ActionButton asChild intent="secondary">
            <Link href="/admin/eventos">Vincular a provas</Link>
          </ActionButton>
        }
      />

      {loading ? (
        <LoadingState lines={5} />
      ) : (
        <>
          <SectionCard title="Módulo de fotos" description="Indicadores, galerias e regras comerciais em abas.">
            <ModuleTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} columnsClassName="md:grid-cols-3" />
          </SectionCard>

          <div className={activeTab === "overview" ? "grid gap-3 sm:grid-cols-4" : "hidden"}>
            <MetricCard label="Galerias" value={galleries.length} icon={Image} tone="highlight" />
            <MetricCard label="Fotos publicadas" value={metrics.publishedPhotos} icon={Camera} />
            <MetricCard label="Elegíveis pontos" value={metrics.pointsEligible} icon={Download} />
            <MetricCard label="Pendentes" value={metrics.pending} icon={UploadCloud} />
          </div>

          <div className={activeTab === "galleries" ? "grid gap-4 xl:grid-cols-[1.1fr_0.9fr]" : "hidden"}>
            <SectionCard title="Galerias por prova" description="Publicação e organização comercial por evento.">
              {galleries.length === 0 ? (
                <EmptyState title="Sem galerias" description="Crie a primeira galeria para começar o pipeline de fotos." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Galeria</th>
                        <th className="px-3 py-2 text-left">Fotos</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {galleries.map((gallery) => (
                        <tr key={gallery.id}>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-white">{gallery.title}</p>
                            <p className="text-xs text-slate-400">{gallery.description ?? "Sem descrição"}</p>
                          </td>
                          <td className="px-3 py-3 text-slate-200">{gallery.photosCount}</td>
                          <td className="px-3 py-3">
                            <StatusBadge label={gallery.status} tone={statusTone(gallery.status)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Nova galeria" description="Crie galerias e publique quando estiverem prontas.">
              <div className="space-y-3">
                <Input placeholder="Título da galeria" value={galleryForm.title} onChange={(event) => setGalleryForm((current) => ({ ...current, title: event.target.value }))} />
                <Input placeholder="Descrição curta" value={galleryForm.description} onChange={(event) => setGalleryForm((current) => ({ ...current, description: event.target.value }))} />
                <Select value={galleryForm.status} onChange={(event) => setGalleryForm((current) => ({ ...current, status: event.target.value }))}>
                  <option value="DRAFT">Rascunho</option>
                  <option value="PUBLISHED">Publicada</option>
                  <option value="ARCHIVED">Arquivada</option>
                </Select>
                <ActionButton onClick={() => void createGallery()} disabled={savingGallery}>
                  <Plus className="mr-2 h-4 w-4" />
                  {savingGallery ? "Criando..." : "Criar galeria"}
                </ActionButton>
              </div>
            </SectionCard>
          </div>

          <div className={activeTab === "pricing" ? "grid gap-4 xl:grid-cols-[1fr_0.9fr]" : "hidden"}>
            <SectionCard title="Cadastrar foto" description="Cadastro manual por URL, com preço e custo em pontos.">
              <div className="grid gap-3 md:grid-cols-2">
                <Select value={photoForm.galleryId} onChange={(event) => setPhotoForm((current) => ({ ...current, galleryId: event.target.value }))}>
                  <option value="">Selecione a galeria</option>
                  {galleries.map((gallery) => (
                    <option key={gallery.id} value={gallery.id}>{gallery.title}</option>
                  ))}
                </Select>
                <Select value={photoForm.status} onChange={(event) => setPhotoForm((current) => ({ ...current, status: event.target.value }))}>
                  <option value="PUBLISHED">Publicada</option>
                  <option value="PROCESSING">Processando</option>
                  <option value="HIDDEN">Oculta</option>
                  <option value="ARCHIVED">Arquivada</option>
                </Select>
                <Input className="md:col-span-2" placeholder="URL da imagem" value={photoForm.imageUrl} onChange={(event) => setPhotoForm((current) => ({ ...current, imageUrl: event.target.value }))} />
                <Input type="number" min={0} placeholder="Preço em centavos" value={photoForm.priceCents} onChange={(event) => setPhotoForm((current) => ({ ...current, priceCents: event.target.value }))} />
                <Input type="number" min={0} placeholder="Custo em pontos" value={photoForm.pointsCost} onChange={(event) => setPhotoForm((current) => ({ ...current, pointsCost: event.target.value }))} />
              </div>
              <ActionButton className="mt-4" onClick={() => void createPhoto()} disabled={savingPhoto}>
                <UploadCloud className="mr-2 h-4 w-4" />
                {savingPhoto ? "Salvando..." : "Cadastrar foto"}
              </ActionButton>
            </SectionCard>

            <SectionCard title="Fotos cadastradas" description={`Potencial comercial: ${formatMoney(metrics.revenuePotential)}.`}>
              {photos.length === 0 ? (
                <EmptyState title="Sem fotos" description="As fotos cadastradas aparecerão aqui." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {photos.slice(0, 12).map((photo) => (
                    <article key={photo.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#102640]">
                      {photo.thumbnailUrl || photo.previewUrl || photo.originalUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo.thumbnailUrl ?? photo.previewUrl ?? photo.originalUrl ?? ""} alt="Foto cadastrada" className="h-32 w-full object-cover" />
                      ) : null}
                      <div className="space-y-2 p-3 text-sm text-slate-300">
                        <StatusBadge label={photo.status} tone={statusTone(photo.status)} />
                        <p>{formatMoney(photo.priceCents)} · {photo.pointsCost} pts</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Pipeline de storage" description="Separação entre banco transacional e arquivos.">
            <div className="grid gap-2 md:grid-cols-4">
              {["Original privado", "Preview com watermark", "Thumbnail cacheado", "Download assinado"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#102640] px-3 py-3 text-sm text-slate-200">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
