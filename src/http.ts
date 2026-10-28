import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

/** Error with an HTTP status and a stable machine-readable code. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Validate untrusted input; throws a 400 with per-field details. */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Invalid input',
      r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return r.data;
}

export const notFound: RequestHandler = (_req, _res, next) =>
  next(new ApiError(404, 'NOT_FOUND', 'Route not found'));

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
    return;
  }
  console.error('[unhandled]', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side' } });
}
