import { NextRequest, NextResponse } from "next/server";
import {
  enqueueStravaWebhookEvent,
  parseWebhookEvent,
  processStravaWebhookLogAsync,
  validateStravaChallenge,
} from "@/lib/integrations/strava";

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const verifyToken = req.nextUrl.searchParams.get("hub.verify_token");

  const validation = validateStravaChallenge({ mode, challenge, verifyToken });
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: validation.reason ?? "Webhook verification failed.",
        },
      },
      { status: 403 },
    );
  }

  return NextResponse.json({ "hub.challenge": challenge });
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid webhook payload.",
        },
      },
      { status: 400 },
    );
  }

  let event;
  try {
    event = parseWebhookEvent(payload);
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Webhook payload does not match expected Strava format.",
        },
      },
      { status: 400 },
    );
  }

  const queued = await enqueueStravaWebhookEvent(event);

  if (!queued.duplicate) {
    processStravaWebhookLogAsync(queued.logId);
  }

  return NextResponse.json(
    {
      data: {
        accepted: true,
        queued: !queued.duplicate,
        duplicate: queued.duplicate,
        logId: queued.logId,
      },
    },
    { status: 202 },
  );
}
