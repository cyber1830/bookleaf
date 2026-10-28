import type { Response } from 'express';
import type { Role } from './domain.js';

/** Minimal Server-Sent Events hub. Admins hear about every ticket; authors only their own. */
interface Client { res: Response; userId: string; role: Role }
const clients = new Set<Client>();

export function addClient(c: Client) {
  clients.add(c);
  return () => clients.delete(c);
}

export function emitTicket(ticketId: number, authorId: string) {
  const payload = `event: ticket\ndata: ${JSON.stringify({ ticketId })}\n\n`;
  for (const c of clients) if (c.role === 'admin' || c.userId === authorId) c.res.write(payload);
}

// Heartbeat keeps proxies from closing idle connections.
setInterval(() => { for (const c of clients) c.res.write(': ping\n\n'); }, 25_000).unref();
