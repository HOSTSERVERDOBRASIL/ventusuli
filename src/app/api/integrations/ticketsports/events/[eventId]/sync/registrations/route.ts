import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { getAuthContext } from "@/lib/request-auth";
import {
  integrationErrorResponse,
  syncTicketSportsRegistrations,
} from "@/lib/integrations/ticketsports/service";

function canSync(roles: readonly UserRole[]): boolean {
  return roles.some(
    (role) => role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.ORGANIZER,
  );
}

export async function POST(req: NextRequest, { params }: { params: { eventId: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canSync(auth.roles)) {
    return apiError("FORBIDDEN", "Sem permissao para sincronizar inscricoes.", 403);
  }

  try {
    return NextResponse.json(
      await syncTicketSportsRegistrations(auth.organizationId, params.eventId),
    );
  } catch (error) {
    const response = integrationErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
