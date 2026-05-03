import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { getAuthContext } from "@/lib/request-auth";
import {
  getTicketSportsOrder,
  integrationErrorResponse,
} from "@/lib/integrations/ticketsports/service";

function canRead(roles: readonly UserRole[]): boolean {
  return roles.some(
    (role) =>
      role === UserRole.ADMIN ||
      role === UserRole.MANAGER ||
      role === UserRole.ORGANIZER ||
      role === UserRole.FINANCE,
  );
}

export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canRead(auth.roles)) return apiError("FORBIDDEN", "Sem permissao para consultar pedidos.", 403);

  try {
    const data = await getTicketSportsOrder(auth.organizationId, params.orderId);
    return NextResponse.json({ data });
  } catch (error) {
    const response = integrationErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
