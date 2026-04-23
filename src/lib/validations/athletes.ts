import { z } from "zod";

const MODE_VALUES = ["QUICK", "FULL"] as const;

export const createAthleteByAdminSchema = z
  .object({
    mode: z.enum(MODE_VALUES).default("QUICK"),
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
    cpf: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value.replace(/\D/g, "") : undefined)),
    phone: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value.toUpperCase() : undefined)),
    birthDate: z.string().trim().optional(),
    gender: z.string().trim().optional(),
    emergencyContact: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "FULL") {
      if (!data.cpf || data.cpf.length !== 11) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CPF e obrigatorio no cadastro completo (11 digitos)",
          path: ["cpf"],
        });
      }

      if (!data.phone || data.phone.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Telefone e obrigatorio no cadastro completo",
          path: ["phone"],
        });
      }

      if (!data.city || data.city.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Cidade e obrigatoria no cadastro completo",
          path: ["city"],
        });
      }

      if (!data.state || !/^[A-Z]{2}$/.test(data.state)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Estado e obrigatorio no cadastro completo (UF com 2 letras)",
          path: ["state"],
        });
      }
    }

    if (data.birthDate) {
      const birth = new Date(data.birthDate);
      if (Number.isNaN(birth.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Data de nascimento invalida",
          path: ["birthDate"],
        });
      }
    }
  });

export type CreateAthleteByAdminInput = z.infer<typeof createAthleteByAdminSchema>;
