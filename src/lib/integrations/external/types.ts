import type { ExternalPlatformAuthType } from "@prisma/client";

export type NormalizedEvent = {
  externalId: string;
  name: string;
  date?: string;
  location?: string;
  status?: string;
  rawPayload: unknown;
};

export type NormalizedRegistration = {
  externalId: string;
  eventExternalId: string;
  participantName?: string;
  participantEmail?: string;
  participantDocument?: string;
  category?: string;
  status?: string;
  rawPayload: unknown;
};

export type NormalizedOrder = {
  externalId: string;
  eventExternalId?: string;
  buyerName?: string;
  buyerEmail?: string;
  amount?: number;
  paymentStatus?: string;
  orderStatus?: string;
  rawPayload: unknown;
};

export interface PlatformIntegration {
  getEvents(): Promise<NormalizedEvent[]>;
  getRegistrations(eventId: string): Promise<NormalizedRegistration[]>;
  getOrders(eventId?: string): Promise<NormalizedOrder[]>;
  getOrderById(orderId: string): Promise<NormalizedOrder>;
}

export type PlatformRegistrationInput = {
  name: string;
  slug: string;
  baseUrl: string;
  authType: ExternalPlatformAuthType;
  isActive?: boolean;
};

export class ExternalIntegrationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ExternalIntegrationError";
  }
}
