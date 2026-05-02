import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { isAllowedImageUrl } from "@/lib/storage/image-url";
import { getAuthContext } from "@/lib/request-auth";
import { isValidCpf, normalizeCpf } from "@/lib/cpf";

const BRAZILIAN_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const emergencyContactSchema = z.object({
  name: z.string().trim().min(2, "Nome do contato deve ter ao menos 2 caracteres"),
  phone: z.string().trim().min(8, "Telefone do contato deve ter ao menos 8 digitos"),
  relation: z.string().trim().optional(),
});

const sportLevelSchema = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "ELITE"], {
  message: "Nivel esportivo invalido.",
});

const patchProfileSchema = z.object({
  cpf: z
    .string()
    .trim()
    .transform((v) => normalizeCpf(v))
    .refine((v) => isValidCpf(v), {
      message: "CPF invalido. Verifique os digitos e tente novamente.",
    })
    .optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  state: z
    .enum(BRAZILIAN_STATES, { message: "Estado invalido. Use a sigla UF (ex: SP)." })
    .nullable()
    .optional(),
  birth_date: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(new Date(v).getTime()), {
      message: "Data de nascimento invalida.",
    })
    .nullable()
    .optional(),
  gender: z
    .enum(["M", "F", "O"], { message: "Genero invalido. Use M, F ou O." })
    .nullable()
    .optional(),
  sport_level: sportLevelSchema.nullable().optional(),
  sport_goal: z.string().trim().max(160).nullable().optional(),
  next_competition_date: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(new Date(v).getTime()), {
      message: "Data da proxima prova invalida.",
    })
    .nullable()
    .optional(),
  emergency_contact: emergencyContactSchema.nullable().optional(),
  avatar_url: z
    .string()
    .trim()
    .min(1)
    .refine((value) => isAllowedImageUrl(value), {
      message: "URL de avatar invalida. Use upload oficial ou URL http/https.",
    })
    .nullable()
    .optional(),
});

function isAthleteRole(role: string): boolean {
  return role === "ATHLETE" || role === "PREMIUM_ATHLETE";
}

function hasMinimumOnboardingData(profile: {
  cpf: string | null;
  city: string | null;
  state: string | null;
}): boolean {
  return Boolean(profile.cpf && profile.city && profile.state);
}

export async function PATCH(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAthleteRole(auth.role)) {
    return apiError("FORBIDDEN", "Apenas atletas podem atualizar este perfil.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = patchProfileSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Dados invalidos.";
    return apiError("VALIDATION_ERROR", msg, 400);
  }

  const data = parsed.data;
  const profileData: Record<string, unknown> = {};
  if (data.cpf !== undefined) profileData.cpf = data.cpf;
  if (data.phone !== undefined) profileData.phone = data.phone;
  if (data.city !== undefined) profileData.city = data.city;
  if (data.state !== undefined) profileData.state = data.state;
  if (data.birth_date !== undefined)
    profileData.birth_date = data.birth_date ? new Date(data.birth_date) : null;
  if (data.gender !== undefined) profileData.gender = data.gender;
  if (data.sport_level !== undefined) profileData.sport_level = data.sport_level;
  if (data.sport_goal !== undefined) profileData.sport_goal = data.sport_goal;
  if (data.next_competition_date !== undefined)
    profileData.next_competition_date = data.next_competition_date
      ? new Date(data.next_competition_date)
      : null;
  if (data.emergency_contact !== undefined)
    profileData.emergency_contact = data.emergency_contact ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    if (data.avatar_url !== undefined) {
      await tx.user.update({
        where: { id: auth.userId },
        data: { avatar_url: data.avatar_url },
      });
    }

    const profile = await tx.athleteProfile.upsert({
      where: { user_id: auth.userId },
      create: {
        user_id: auth.userId,
        organization_id: auth.organizationId,
        athlete_status: "ACTIVE",
        ...profileData,
      },
      update: profileData,
      select: {
        id: true,
        user_id: true,
        organization_id: true,
        athlete_status: true,
        signup_source: true,
        onboarding_completed_at: true,
        cpf: true,
        phone: true,
        city: true,
        state: true,
        birth_date: true,
        gender: true,
        sport_level: true,
        sport_goal: true,
        next_competition_date: true,
        emergency_contact: true,
      },
    });

    const minimumFilled = hasMinimumOnboardingData({
      cpf: profile.cpf ?? null,
      city: profile.city ?? null,
      state: profile.state ?? null,
    });

    const shouldCompleteOnboarding =
      profile.athlete_status === "ACTIVE" && minimumFilled && !profile.onboarding_completed_at;

    if (shouldCompleteOnboarding) {
      const completedProfile = await tx.athleteProfile.update({
        where: { user_id: auth.userId },
        data: { onboarding_completed_at: new Date() },
        select: {
          id: true,
          user_id: true,
          organization_id: true,
          athlete_status: true,
          signup_source: true,
          onboarding_completed_at: true,
          cpf: true,
          phone: true,
          city: true,
          state: true,
          birth_date: true,
          gender: true,
          sport_level: true,
          sport_goal: true,
          next_competition_date: true,
          emergency_contact: true,
        },
      });

      await tx.user.update({
        where: { id: auth.userId },
        data: { account_status: "ACTIVE" },
      });

      return completedProfile;
    }

    return profile;
  });

  return NextResponse.json({ data: updated });
}
