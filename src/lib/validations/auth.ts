import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ required_error: "Email e obrigatorio" })
    .email("Email invalido")
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: "Senha e obrigatoria" })
    .min(8, "Senha deve ter pelo menos 8 caracteres"),
});

export const registerAdminSchema = z.object({
  name: z
    .string({ required_error: "Nome e obrigatorio" })
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no maximo 100 caracteres")
    .trim(),
  email: z
    .string({ required_error: "Email e obrigatorio" })
    .email("Email invalido")
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: "Senha e obrigatoria" })
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiuscula")
    .regex(/[0-9]/, "Senha deve conter ao menos um numero"),
  orgName: z
    .string({ required_error: "Nome da assessoria e obrigatorio" })
    .min(2, "Nome da assessoria deve ter pelo menos 2 caracteres")
    .max(100, "Nome da assessoria deve ter no maximo 100 caracteres")
    .trim(),
});

export const registerAthleteSchemaBase = z.object({
  name: z
    .string({ required_error: "Nome e obrigatorio" })
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no maximo 100 caracteres")
    .trim(),
  email: z
    .string({ required_error: "Email e obrigatorio" })
    .email("Email invalido")
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: "Senha e obrigatoria" })
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiuscula")
    .regex(/[0-9]/, "Senha deve conter ao menos um numero"),
  organizationSlug: z.string().trim().optional(),
  inviteToken: z.string().trim().optional(),
});

export const registerAthleteSchema = registerAthleteSchemaBase
  .superRefine((data, ctx) => {
    if (!data.organizationSlug && !data.inviteToken) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o slug da assessoria ou um token de convite",
        path: ["organizationSlug"],
      });
    }
  });

export const activateAdminSchema = z.object({
  token: z.string({ required_error: "Token e obrigatorio" }).trim().min(12, "Token invalido"),
  name: z
    .string({ required_error: "Nome e obrigatorio" })
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no maximo 100 caracteres")
    .trim(),
  password: z
    .string({ required_error: "Senha e obrigatoria" })
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiuscula")
    .regex(/[0-9]/, "Senha deve conter ao menos um numero"),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: "Email e obrigatorio" })
    .email("Email invalido")
    .toLowerCase()
    .trim(),
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: "Token e obrigatorio" })
    .trim()
    .min(20, "Token invalido"),
  password: z
    .string({ required_error: "Senha e obrigatoria" })
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiuscula")
    .regex(/[0-9]/, "Senha deve conter ao menos um numero"),
});

export const createOrganizationBySuperAdminSchema = z.object({
  orgName: z
    .string({ required_error: "Nome da assessoria e obrigatorio" })
    .min(2, "Nome da assessoria deve ter pelo menos 2 caracteres")
    .max(100, "Nome da assessoria deve ter no maximo 100 caracteres")
    .trim(),
  orgSlug: z
    .string()
    .trim()
    .min(3, "Slug deve ter ao menos 3 caracteres")
    .max(60, "Slug deve ter no maximo 60 caracteres")
    .regex(/^[a-z0-9-]+$/, "Slug invalido")
    .optional(),
  adminEmail: z
    .string({ required_error: "Email do admin e obrigatorio" })
    .email("Email invalido")
    .toLowerCase()
    .trim(),
  inviteExpiresInDays: z.number().int().min(1).max(90).optional(),
  plan: z.enum(["FREE", "STARTER", "PRO", "ENTERPRISE"]).optional(),
  status: z.enum(["PENDING_SETUP", "ACTIVE", "SUSPENDED", "TRIAL", "CANCELLED"]).optional(),
});

export const updateOrganizationBySuperAdminSchema = z.object({
  plan: z.enum(["FREE", "STARTER", "PRO", "ENTERPRISE"]).optional(),
  status: z.enum(["PENDING_SETUP", "ACTIVE", "SUSPENDED", "TRIAL", "CANCELLED"]).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RegisterAdminInput = z.infer<typeof registerAdminSchema>;
export type RegisterAthleteInput = z.infer<typeof registerAthleteSchema>;
export type ActivateAdminInput = z.infer<typeof activateAdminSchema>;
export type CreateOrganizationBySuperAdminInput = z.infer<typeof createOrganizationBySuperAdminSchema>;
export type UpdateOrganizationBySuperAdminInput = z.infer<typeof updateOrganizationBySuperAdminSchema>;
