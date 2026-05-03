import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { apiError, handleApiException } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

function canViewCockpit(roles: readonly UserRole[]): boolean {
  return roles.some(
    (role) =>
      role === UserRole.ADMIN ||
      role === UserRole.MANAGER ||
      role === UserRole.ORGANIZER ||
      role === UserRole.FINANCE ||
      role === UserRole.COACH,
  );
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function statusTone(status: string): "done" | "warning" | "danger" | "neutral" {
  if (["PUBLISHED", "PAID", "CONFIRMED", "PRESENT", "OPEN", "ACTIVE"].includes(status)) {
    return "done";
  }
  if (["DRAFT", "PENDING", "PENDING_PAYMENT", "INTERESTED"].includes(status)) return "warning";
  if (["CANCELLED", "EXPIRED", "ABSENT", "FAILED"].includes(status)) return "danger";
  return "neutral";
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canViewCockpit(auth.roles)) {
    return apiError("FORBIDDEN", "Sem permissao para acessar o cockpit da prova.", 403);
  }

  try {
    const event = await prisma.event.findFirst({
      where: {
        id: params.id,
        organization_id: auth.organizationId,
      },
      include: {
        distances: {
          orderBy: { distance_km: "asc" },
        },
        registrations: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            distance: true,
            payment: true,
          },
          orderBy: { registered_at: "asc" },
        },
        race_plans: {
          include: {
            participations: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
                distance: true,
                registration: {
                  include: {
                    payment: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        collective_signups: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
                distance: true,
                payment: true,
              },
            },
          },
          orderBy: { created_at: "desc" },
        },
        photo_galleries: {
          include: {
            _count: {
              select: { photos: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        sponsor_campaign_events: {
          include: {
            campaign: {
              include: {
                sponsor: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!event) return apiError("USER_NOT_FOUND", "Prova nao encontrada.", 404);

    const registrations = event.registrations;
    const totalRegistrations = registrations.length;
    const confirmedRegistrations = registrations.filter(
      (registration) => registration.status === "CONFIRMED",
    ).length;
    const pendingPaymentRegistrations = registrations.filter(
      (registration) =>
        registration.status === "PENDING_PAYMENT" || registration.payment?.status === "PENDING",
    ).length;
    const paidPayments = registrations.filter((registration) => registration.payment?.status === "PAID");
    const grossRevenueCents = registrations.reduce(
      (sum, registration) => sum + (registration.payment?.amount_cents ?? 0),
      0,
    );
    const paidRevenueCents = paidPayments.reduce(
      (sum, registration) => sum + (registration.payment?.amount_cents ?? 0),
      0,
    );
    const presentCount = registrations.filter(
      (registration) => registration.attendance_status === "PRESENT",
    ).length;
    const absentCount = registrations.filter(
      (registration) => registration.attendance_status === "ABSENT",
    ).length;
    const pendingAttendanceCount = registrations.filter(
      (registration) => registration.attendance_status === "PENDING",
    ).length;
    const checkedInCount = registrations.filter((registration) => registration.check_in_at).length;

    const racePlan = event.race_plans[0] ?? null;
    const racePlanParticipations = racePlan?.participations ?? [];
    const interestedCount = racePlanParticipations.filter(
      (participation) => participation.status === "INTERESTED",
    ).length;

    const collectiveMembersCount = event.collective_signups.reduce(
      (sum, signup) => sum + signup.members.length,
      0,
    );
    const photosCount = event.photo_galleries.reduce(
      (sum, gallery) => sum + gallery._count.photos,
      0,
    );

    const checklist = [
      {
        key: "event_published",
        title: "Publicar prova",
        status: event.status === "PUBLISHED" || event.status === "FINISHED" ? "done" : "pending",
      },
      {
        key: "race_plan_open",
        title: "Abrir na lista da assessoria",
        status: racePlan ? "done" : "pending",
      },
      {
        key: "participants",
        title: "Ter atletas inscritos ou interessados",
        status: totalRegistrations + racePlanParticipations.length > 0 ? "done" : "pending",
      },
      {
        key: "payment_review",
        title: "Revisar pagamentos pendentes",
        status: pendingPaymentRegistrations === 0 ? "done" : "attention",
      },
      {
        key: "checkin_ready",
        title: "Conferir ponto de check-in",
        status: event.latitude && event.longitude ? "done" : "attention",
      },
      {
        key: "post_event",
        title: "Fechar pos-prova",
        status: event.status === "FINISHED" ? "done" : "pending",
      },
    ];

    return NextResponse.json({
      data: {
        event: {
          id: event.id,
          name: event.name,
          city: event.city,
          state: event.state,
          address: event.address,
          eventDate: event.event_date.toISOString(),
          registrationDeadline: event.registration_deadline?.toISOString() ?? null,
          status: event.status,
          externalUrl: event.external_url,
          latitude: event.latitude ? Number(event.latitude) : null,
          longitude: event.longitude ? Number(event.longitude) : null,
          checkInRadiusM: event.check_in_radius_m,
          proximityRadiusM: event.proximity_radius_m,
          distances: event.distances.map((distance) => ({
            id: distance.id,
            label: distance.label,
            distanceKm: Number(distance.distance_km),
            priceCents: distance.price_cents,
            maxSlots: distance.max_slots,
            registeredCount: distance.registered_count,
          })),
        },
        metrics: {
          registrations: {
            total: totalRegistrations,
            confirmed: confirmedRegistrations,
            pendingPayment: pendingPaymentRegistrations,
            conversionRate: percent(confirmedRegistrations, totalRegistrations),
          },
          financial: {
            grossRevenueCents,
            paidRevenueCents,
            pendingRevenueCents: grossRevenueCents - paidRevenueCents,
          },
          attendance: {
            present: presentCount,
            absent: absentCount,
            pending: pendingAttendanceCount,
            checkedIn: checkedInCount,
            presenceRate: percent(presentCount, confirmedRegistrations),
          },
          racePlan: {
            hasPlan: Boolean(racePlan),
            total: racePlanParticipations.length,
            interested: interestedCount,
          },
          collective: {
            campaigns: event.collective_signups.length,
            members: collectiveMembersCount,
          },
          media: {
            galleries: event.photo_galleries.length,
            photos: photosCount,
          },
          sponsors: {
            campaigns: event.sponsor_campaign_events.length,
          },
        },
        registrations: registrations.slice(0, 12).map((registration) => ({
          id: registration.id,
          athleteName: registration.user.name,
          athleteEmail: registration.user.email,
          distanceLabel: registration.distance.label,
          status: registration.status,
          paymentStatus: registration.payment?.status ?? null,
          attendanceStatus: registration.attendance_status,
          amountCents: registration.payment?.amount_cents ?? 0,
          registeredAt: registration.registered_at.toISOString(),
          tone: statusTone(registration.status),
        })),
        racePlan: racePlan
          ? {
              id: racePlan.id,
              status: racePlan.status,
              athleteAction: racePlan.athleteAction,
              instructions: racePlan.instructions,
              opensAt: racePlan.opensAt?.toISOString() ?? null,
              closesAt: racePlan.closesAt?.toISOString() ?? null,
              participations: racePlanParticipations.slice(0, 12).map((participation) => ({
                id: participation.id,
                athleteName: participation.user.name,
                athleteEmail: participation.user.email,
                status: participation.status,
                distanceLabel: participation.distance?.label ?? null,
                registrationStatus: participation.registration?.status ?? null,
                paymentStatus: participation.registration?.payment?.status ?? null,
                createdAt: participation.createdAt.toISOString(),
                tone: statusTone(participation.status),
              })),
            }
          : null,
        collectiveSignups: event.collective_signups.map((signup) => ({
          id: signup.id,
          name: signup.name,
          status: signup.status,
          deadline: signup.deadline?.toISOString() ?? null,
          maxMembers: signup.max_members,
          membersCount: signup.members.length,
          paidMembersCount: signup.members.filter((member) => member.payment?.status === "PAID").length,
        })),
        sponsors: event.sponsor_campaign_events.map((item) => ({
          id: item.id,
          campaignId: item.campaignId,
          campaignTitle: item.campaign.title,
          campaignStatus: item.campaign.status,
          sponsorName: item.campaign.sponsor.name,
          budgetCents: item.campaign.budgetCents,
        })),
        photoGalleries: event.photo_galleries.map((gallery) => ({
          id: gallery.id,
          title: gallery.title,
          status: gallery.status,
          photosCount: gallery._count.photos,
          publishedAt: gallery.publishedAt?.toISOString() ?? null,
        })),
        checklist,
      },
    });
  } catch (error) {
    return handleApiException(error, "Nao foi possivel carregar o cockpit da prova.");
  }
}
