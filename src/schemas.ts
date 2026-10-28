import { z } from 'zod';
import { CATEGORIES, PRIORITIES, STATUSES } from './domain.js';

export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const createTicketSchema = z.object({
  bookId: z.string().min(1).nullable().optional(), // null/absent = General / Account Level
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  attachmentName: z.string().max(255).optional(),
});

export const messageSchema = z.object({ body: z.string().trim().min(1).max(5000) });
export const replySchema = messageSchema.extend({ status: z.enum(STATUSES).optional() });

export const patchTicketSchema = z
  .object({
    status: z.enum(STATUSES),
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
    assignedTo: z.union([z.literal('me'), z.null()]),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const adminListQuery = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigned: z.enum(['me', 'unassigned']).optional(),
  from: date.optional(),
  to: date.optional(),
});
