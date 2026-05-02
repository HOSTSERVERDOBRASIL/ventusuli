import { prisma } from "@/lib/prisma";
import { createLoggingNotificationProviders } from "./providers";
import { NotificationService } from "./service";

export const notificationService = new NotificationService(
  prisma,
  createLoggingNotificationProviders(),
);

export * from "./types";
