import { NextRequest, NextResponse } from "next/server";
import { EventStatus, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { isAllowedImageUrl } from "@/lib/storage/image-url";

const listQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  page: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(EventStatus).optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

const createEventSchema = z.object({
  name: z.string().trim().min(3, "Nome deve ter ao menos 3 caracteres"),
  city: z.string().trim().min(1, "Cidade é obrigatória"),
  state: z
    .string()
    .trim()
    .length(2, "Estado deve ter 2 caracteres")
    .transform((v) => v.toUpperCase()),
  address: z.string().trim().max(255).optional(),
  event_date: z.string().datetime(),
  registration_deadline: z.string().datetime().optional(),
  description: z.string().trim().max(5000).optional(),
  image_url: z
    .string()
    .trim()
    .min(1)
    .refine((value) => isAllowedImageUrl(value), {
      message: "Imagem da prova invalida. Use upload oficial ou URL http/https.",
    })
    .optional(),
  external_url: z.string().url().optional(),
  status: z.nativeEnum(EventStatus).optional(),
  distances: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(50),
        distance_km: z.number().positive(),
        price_cents: z.number().int().min(0),
        max_slots: z.number().int().positive().optional(),
      }),
    )
    .min(1, "Informe ao menos uma distância"),
});

function getAuthContext(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role") as UserRole | null;
  const organizationId = req.headers.get("x-org-id");

  if (!userId || !role || !organizationId) {
    return null;
  }

  return { userId, role, organizationId };
}

function isAdminRole(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

function prismaToApiError(error: unknown): NextResponse {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return apiError("VALIDATION_ERROR", "Conflito de dados únicos.", 409);
    }
    if (error.code === "P2025") {
      return apiError("USER_NOT_FOUND", "Registro não encontrado.", 404);
    }
  }
  return apiError("INTERNAL_ERROR", "Erro interno ao processar evento.", 500);
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const parsed = listQuerySchema.safeParse({
    cursor: req.nextUrl.searchParams.get("cursor") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    search: req.nextUrl.searchParams.get("search") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Query inválida.", 400);
  }

  const { limit, status, search } = parsed.data;
  const cursor = parsed.data.cursor ?? parsed.data.page;
  const canViewDraft = isAdminRole(auth.role);

  if (!canViewDraft && status === EventStatus.DRAFT) {
    return apiError("FORBIDDEN", "Apenas administradores podem ver rascunhos.", 403);
  }

  const where: Prisma.EventWhereInput = {
    organization_id: auth.organizationId,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(!canViewDraft && !status ? { status: { not: EventStatus.DRAFT } } : {}),
  };

  try {
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [{ event_date: "asc" }, { created_at: "asc" }],
        include: {
          distances: {
            orderBy: { distance_km: "asc" },
          },
          _count: {
            select: { registrations: true },
          },
        },
      }),
      prisma.event.count({ where }),
    ]);

    const hasNext = events.length > limit;
    const data = hasNext ? events.slice(0, limit) : events;
    const nextCursor = hasNext ? (data[data.length - 1]?.id ?? null) : null;

    return NextResponse.json({
      data: data.map((event) => ({
        ...event,
        registrations_count: event._count.registrations,
      })),
      nextCursor,
      total,
    });
  } catch (error) {
    return prismaToApiError(error);
  }
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) {
    return apiError("FORBIDDEN", "Apenas administradores podem criar provas.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body inválido.", 400);
  }

  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados inválidos.", 400);
  }

  const input = parsed.data;

  try {
    const eventId = await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          organization_id: auth.organizationId,
          created_by: auth.userId,
          name: input.name,
          city: input.city,
          state: input.state,
          address: input.address,
          event_date: new Date(input.event_date),
          registration_deadline: input.registration_deadline
            ? new Date(input.registration_deadline)
            : null,
          description: input.description,
          image_url: input.image_url,
          external_url: input.external_url,
          status: input.status ?? EventStatus.DRAFT,
        },
        select: { id: true },
      });

      await tx.eventDistance.createMany({
        data: input.distances.map((distance) => ({
          event_id: event.id,
          label: distance.label,
          distance_km: new Prisma.Decimal(distance.distance_km),
          price_cents: distance.price_cents,
          max_slots: distance.max_slots ?? null,
        })),
      });

      return event.id;
    });

    const created = await prisma.event.findUnique({
      where: { id: eventId },
      include: { distances: { orderBy: { distance_km: "asc" } } },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return prismaToApiError(error);
  }
}
