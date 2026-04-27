"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EventCard } from "@/components/events/event-card";
import type { EventStatus, EventView } from "@/components/events/types";
import { uploadImageFile } from "@/services/upload-service";

const distanceSchema = z.object({
  label: z.string().trim().min(1, "Informe o label"),
  distance_km: z.coerce.number().positive("Informe a distÃ¢ncia"),
  price_brl: z.coerce.number().min(0, "Valor invÃ¡lido"),
  max_slots: z.union([z.coerce.number().int().positive(), z.nan()]).optional(),
});

const eventFormSchema = z.object({
  name: z.string().trim().min(3, "Nome deve ter ao menos 3 caracteres"),
  city: z.string().trim().min(2, "Cidade obrigatÃ³ria"),
  state: z.string().trim().length(2, "UF invÃ¡lida"),
  event_date: z.string().min(1, "Data obrigatÃ³ria"),
  registration_deadline: z.string().optional(),
  description: z.string().optional(),
  image_url: z.string().trim().optional(),
  distances: z.array(distanceSchema).min(1, "Adicione ao menos uma distÃ¢ncia"),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const UF_OPTIONS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];

export function EventForm({
  mode,
  initialEvent,
  onSubmit,
}: {
  mode: "create" | "edit";
  initialEvent?: EventView;
  onSubmit: (payload: {
    status: EventStatus;
    values: {
      name: string;
      city: string;
      state: string;
      event_date: string;
      registration_deadline?: string;
      description?: string;
      image_url?: string;
      distances: Array<{
        label: string;
        distance_km: number;
        price_cents: number;
        max_slots?: number;
      }>;
    };
  }) => Promise<void>;
}) {
  const [submitMode, setSubmitMode] = useState<EventStatus | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const { accessToken } = useAuthToken();

  const {
    register,
    setValue,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    mode: "onChange",
    defaultValues: {
      name: initialEvent?.name ?? "",
      city: initialEvent?.city ?? "",
      state: initialEvent?.state ?? "",
      event_date: initialEvent?.event_date
        ? format(new Date(initialEvent.event_date), "yyyy-MM-dd")
        : "",
      registration_deadline: initialEvent?.registration_deadline
        ? format(new Date(initialEvent.registration_deadline), "yyyy-MM-dd")
        : "",
      description: initialEvent?.description ?? "",
      image_url: initialEvent?.image_url ?? "",
      distances: initialEvent?.distances?.map((distance) => ({
        label: distance.label,
        distance_km: distance.distance_km,
        price_brl: distance.price_cents / 100,
        max_slots: distance.max_slots ?? undefined,
      })) ?? [{ label: "5K", distance_km: 5, price_brl: 99, max_slots: undefined }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "distances",
  });

  const values = watch();

  const previewEvent = useMemo<EventView>(
    () => ({
      id: initialEvent?.id ?? "preview",
      name: values.name || "Nova prova",
      city: values.city || "Cidade",
      state: (values.state || "UF").toUpperCase(),
      event_date: values.event_date
        ? new Date(`${values.event_date}T08:00:00.000Z`).toISOString()
        : new Date().toISOString(),
      registration_deadline: values.registration_deadline
        ? new Date(`${values.registration_deadline}T23:59:59.000Z`).toISOString()
        : null,
      description: values.description,
      image_url: values.image_url || null,
      status: submitMode === "PUBLISHED" ? "PUBLISHED" : (initialEvent?.status ?? "DRAFT"),
      registrations_count: initialEvent?.registrations_count ?? 0,
      distances: (values.distances ?? []).map((distance) => ({
        label: distance.label || "DistÃ¢ncia",
        distance_km: Number(distance.distance_km) || 0,
        price_cents: Math.round((Number(distance.price_brl) || 0) * 100),
        max_slots: Number.isFinite(distance.max_slots as number)
          ? Number(distance.max_slots)
          : undefined,
      })),
    }),
    [initialEvent, submitMode, values],
  );

  const submit = async (status: EventStatus, formValues: EventFormValues) => {
    setSubmitMode(status);

    await onSubmit({
      status,
      values: {
        name: formValues.name,
        city: formValues.city,
        state: formValues.state.toUpperCase(),
        event_date: new Date(`${formValues.event_date}T08:00:00.000Z`).toISOString(),
        registration_deadline: formValues.registration_deadline
          ? new Date(`${formValues.registration_deadline}T23:59:59.000Z`).toISOString()
          : undefined,
        description: formValues.description,
        image_url: formValues.image_url?.trim() ? formValues.image_url.trim() : undefined,
        distances: formValues.distances.map((distance) => ({
          label: distance.label,
          distance_km: Number(distance.distance_km),
          price_cents: Math.round(Number(distance.price_brl) * 100),
          max_slots: Number.isFinite(distance.max_slots as number)
            ? Number(distance.max_slots)
            : undefined,
        })),
      },
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <Card className="border-white/10 bg-[#1E3A5F]/90 text-white">
        <CardHeader>
          <CardTitle>{mode === "create" ? "Nova prova" : "Editar prova"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" className="border-white/15 bg-[#0F2743]" {...register("name")} />
              {errors.name ? <p className="text-xs text-amber-300">{errors.name.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" className="border-white/15 bg-[#0F2743]" {...register("city")} />
              {errors.city ? <p className="text-xs text-amber-300">{errors.city.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">Estado (UF)</Label>
              <Select id="state" className="border-white/15 bg-[#0F2743]" {...register("state")}>
                <option value="">Selecione</option>
                {UF_OPTIONS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Select>
              {errors.state ? (
                <p className="text-xs text-amber-300">{errors.state.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_date">Data da prova</Label>
              <Input
                id="event_date"
                type="date"
                className="border-white/15 bg-[#0F2743]"
                {...register("event_date")}
              />
              {errors.event_date ? (
                <p className="text-xs text-amber-300">{errors.event_date.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="registration_deadline">Prazo de inscriÃ§Ã£o</Label>
              <Input
                id="registration_deadline"
                type="date"
                className="border-white/15 bg-[#0F2743]"
                {...register("registration_deadline")}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">DescriÃ§Ã£o</Label>
              <textarea
                id="description"
                className="min-h-24 w-full rounded-xl border border-white/15 bg-[#0F2743] px-3 py-2 text-sm"
                {...register("description")}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="image_url">Imagem da prova (URL ou upload)</Label>
              <Input
                id="image_url"
                className="border-white/15 bg-[#0F2743]"
                placeholder="https://seu-cdn.com/prova.png"
                {...register("image_url")}
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/20">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      setUploadingImage(true);
                      try {
                        const upload = await uploadImageFile(file, "events", accessToken);
                        setValue("image_url", upload.url, { shouldDirty: true, shouldTouch: true });
                        toast.success("Imagem da prova enviada com sucesso.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Falha ao enviar imagem.",
                        );
                      } finally {
                        setUploadingImage(false);
                      }
                    }}
                    disabled={uploadingImage}
                  />
                  {uploadingImage ? "Enviando..." : "Fazer upload"}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  className="border border-white/15 bg-transparent text-white hover:bg-white/10"
                  onClick={() =>
                    setValue("image_url", "", { shouldDirty: true, shouldTouch: true })
                  }
                >
                  Remover imagem
                </Button>
              </div>
              {values.image_url ? (
                <div className="mt-2 h-36 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0F2743]">
                  <img
                    src={values.image_url}
                    alt="Preview da imagem da prova"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#102D4B] p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">DistÃ¢ncias</h3>
              <Button
                type="button"
                variant="secondary"
                className="gap-2 border border-white/10 bg-white/10 text-white hover:bg-white/20"
                onClick={() =>
                  append({ label: "", distance_km: 5, price_brl: 99, max_slots: undefined })
                }
              >
                <Plus className="h-4 w-4" />
                Adicionar distÃ¢ncia
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-3 rounded-xl border border-white/10 bg-[#0F2743] p-3 md:grid-cols-4"
                >
                  <div className="space-y-1">
                    <Label>Label</Label>
                    <Input
                      placeholder="5K"
                      className="border-white/15"
                      {...register(`distances.${index}.label`)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>DistÃ¢ncia (km)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      className="border-white/15"
                      {...register(`distances.${index}.distance_km`, { valueAsNumber: true })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="border-white/15"
                      {...register(`distances.${index}.price_brl`, { valueAsNumber: true })}
                    />
                    <p className="text-xs text-slate-300">
                      {BRL.format(Number(values.distances?.[index]?.price_brl) || 0)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label>Vagas</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        className="border-white/15"
                        {...register(`distances.${index}.max_slots`, { valueAsNumber: true })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-red-200 hover:bg-red-500/20 hover:text-red-100"
                        onClick={() => remove(index)}
                        disabled={fields.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {errors.distances ? (
              <p className="text-xs text-amber-300">{errors.distances.message as string}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={isSubmitting}
              className="bg-slate-200 text-slate-900 hover:bg-white"
              onClick={handleSubmit((formValues) => submit("DRAFT", formValues))}
            >
              Salvar Rascunho
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              className="bg-[#F5A623] font-semibold text-[#0A1628] hover:bg-[#e59a1f]"
              onClick={handleSubmit((formValues) => submit("PUBLISHED", formValues))}
            >
              Publicar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-100">Preview</h3>
        <EventCard event={previewEvent} mode="admin" />
        <p className="text-xs text-slate-300">
          Atualizado em tempo real - {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}
