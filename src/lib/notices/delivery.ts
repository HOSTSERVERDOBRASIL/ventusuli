import { NoticeChannel, NoticeDeliveryStatus, NoticeStatus, PrismaClient } from "@prisma/client";
import { sendNoticeToTelegram } from "@/lib/integrations/telegram";
import { notifyNoticePublished } from "@/lib/notifications/domain-events";
import { resolveTelegramSettings } from "@/lib/notices/telegram-config";

function audienceLabel(audience: string): string {
  if (audience === "ATHLETES") return "Atletas";
  if (audience === "COACHES") return "Coaches";
  if (audience === "ADMINS") return "Administradores";
  return "Todos";
}

interface DeliverOptions {
  forceTelegram?: boolean;
}

export async function deliverNoticeChannels(
  prisma: PrismaClient,
  noticeId: string,
  organizationId: string | null,
  options: DeliverOptions = {},
): Promise<void> {
  const now = new Date();

  const notice = await prisma.notice.findFirst({
    where: {
      id: noticeId,
      organization_id: organizationId,
    },
    include: {
      organization: {
        select: {
          name: true,
          settings: true,
        },
      },
    },
  });

  if (!notice) return;

  const currentDeliveries = await prisma.noticeDelivery.findMany({
    where: {
      notice_id: notice.id,
      organization_id: organizationId,
    },
    select: {
      channel: true,
      status: true,
      attempt_count: true,
    },
  });
  const inAppDelivery = currentDeliveries.find((item) => item.channel === NoticeChannel.IN_APP);
  const telegramDelivery = currentDeliveries.find((item) => item.channel === NoticeChannel.TELEGRAM);

  if (notice.publish_at && notice.publish_at > now && !options.forceTelegram) {
    await prisma.noticeDelivery.upsert({
      where: { notice_id_channel: { notice_id: notice.id, channel: NoticeChannel.IN_APP } },
      create: {
        notice_id: notice.id,
        organization_id: organizationId,
        channel: NoticeChannel.IN_APP,
        status: NoticeDeliveryStatus.PENDING,
        error_message: "Aviso agendado para publicação futura.",
      },
      update: {
        status: NoticeDeliveryStatus.PENDING,
        error_message: "Aviso agendado para publicação futura.",
      },
    });

    if (notice.telegram_enabled) {
      await prisma.noticeDelivery.upsert({
        where: { notice_id_channel: { notice_id: notice.id, channel: NoticeChannel.TELEGRAM } },
        create: {
          notice_id: notice.id,
          organization_id: organizationId,
          channel: NoticeChannel.TELEGRAM,
          status: NoticeDeliveryStatus.PENDING,
          error_message: "Envio Telegram pendente até o horário agendado.",
        },
        update: {
          status: NoticeDeliveryStatus.PENDING,
          error_message: "Envio Telegram pendente até o horário agendado.",
        },
      });
    }

    return;
  }

  await prisma.noticeDelivery.upsert({
    where: { notice_id_channel: { notice_id: notice.id, channel: NoticeChannel.IN_APP } },
    create: {
      notice_id: notice.id,
      organization_id: organizationId,
      channel: NoticeChannel.IN_APP,
      status: NoticeDeliveryStatus.SENT,
      sent_at: now,
      attempt_count: 1,
      last_attempt_at: now,
    },
    update: {
      status: NoticeDeliveryStatus.SENT,
      sent_at: inAppDelivery?.status === NoticeDeliveryStatus.SENT ? undefined : now,
      attempt_count: inAppDelivery?.status === NoticeDeliveryStatus.SENT ? undefined : { increment: 1 },
      last_attempt_at: now,
      error_message: null,
    },
  });

  await notifyNoticePublished(prisma, notice);

  if (!notice.telegram_enabled) return;
  if (telegramDelivery?.status === NoticeDeliveryStatus.SENT && !options.forceTelegram) return;

  const telegramConfig = resolveTelegramSettings(notice.organization?.settings);
  const telegramResult = await sendNoticeToTelegram(
    {
      title: notice.title,
      body: notice.body,
      audience: audienceLabel(notice.audience),
      organizationName: notice.organization?.name ?? null,
    },
    {
      enabled: telegramConfig.telegram_enabled,
      chatId: telegramConfig.telegram_chat_id,
      botToken: telegramConfig.telegram_bot_token,
    },
  );

  await prisma.noticeDelivery.upsert({
    where: { notice_id_channel: { notice_id: notice.id, channel: NoticeChannel.TELEGRAM } },
    create: {
      notice_id: notice.id,
      organization_id: organizationId,
      channel: NoticeChannel.TELEGRAM,
      status: telegramResult.success ? NoticeDeliveryStatus.SENT : NoticeDeliveryStatus.FAILED,
      sent_at: telegramResult.success ? now : null,
      external_id: telegramResult.externalId ?? null,
      error_message: telegramResult.success ? null : telegramResult.errorMessage ?? "Falha no envio Telegram.",
      attempt_count: 1,
      last_attempt_at: now,
    },
    update: {
      status: telegramResult.success ? NoticeDeliveryStatus.SENT : NoticeDeliveryStatus.FAILED,
      sent_at: telegramResult.success ? now : null,
      external_id: telegramResult.externalId ?? null,
      error_message: telegramResult.success ? null : telegramResult.errorMessage ?? "Falha no envio Telegram.",
      attempt_count: { increment: 1 },
      last_attempt_at: now,
    },
  });
}

export async function processScheduledNotices(prisma: PrismaClient, organizationId: string | null): Promise<void> {
  const now = new Date();

  const dueNotices = await prisma.notice.findMany({
    where: {
      organization_id: organizationId,
      status: NoticeStatus.PUBLISHED,
      OR: [{ publish_at: null }, { publish_at: { lte: now } }],
    },
    select: { id: true },
    orderBy: { publish_at: "asc" },
    take: 30,
  });

  for (const notice of dueNotices) {
    await deliverNoticeChannels(prisma, notice.id, organizationId);
  }
}
