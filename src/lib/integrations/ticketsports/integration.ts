import type {
  NormalizedEvent,
  NormalizedOrder,
  NormalizedRegistration,
  PlatformIntegration,
} from "@/lib/integrations/external/types";
import { TicketSportsClient } from "@/lib/integrations/ticketsports/client";
import {
  mapTicketSportsEvent,
  mapTicketSportsOrder,
  mapTicketSportsRegistration,
  unwrapTicketSportsList,
} from "@/lib/integrations/ticketsports/mapper";

export class TicketSportsIntegration implements PlatformIntegration {
  constructor(private readonly client: TicketSportsClient) {}

  async getEvents(): Promise<NormalizedEvent[]> {
    return unwrapTicketSportsList(await this.client.getEvents()).map(mapTicketSportsEvent);
  }

  async getRegistrations(eventId: string): Promise<NormalizedRegistration[]> {
    return unwrapTicketSportsList(await this.client.getRegistrations(eventId)).map((item) =>
      mapTicketSportsRegistration(item, eventId),
    );
  }

  async getOrders(eventId?: string): Promise<NormalizedOrder[]> {
    return unwrapTicketSportsList(await this.client.getOrders(eventId)).map(mapTicketSportsOrder);
  }

  async getOrderById(orderId: string): Promise<NormalizedOrder> {
    return mapTicketSportsOrder(await this.client.getOrderById(orderId));
  }
}
