import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  INestApplication,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { STATUS_CODES } from 'node:http';

// Client errors from outside Nest (for example an oversized body) carry a 4xx status. Everything else is a 500.
function resolveStatus(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  const e = exception as { status?: unknown; statusCode?: unknown } | null;
  const s = typeof e?.status === 'number' ? e.status : typeof e?.statusCode === 'number' ? e.statusCode : 0;
  return s >= 400 && s < 500 ? s : 500;
}

// 4xx messages from HttpException pass through (validation feedback), except 404, whose default
// message echoes the requested route. Non-HttpException client errors get the generic text.
function clientMessage(exception: unknown, status: number, fallback: string): string | string[] {
  if (status === 404 || !(exception instanceof HttpException)) return fallback;
  const body = exception.getResponse();
  if (typeof body === 'string') return body;
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.every((m) => typeof m === 'string')) return message as string[];
  return fallback;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const status = resolveStatus(exception);
    const label = `${req.method} ${req.path} -> ${status}`;

    // Full detail goes to server logs only.
    if (status >= 500) {
      this.logger.error(
        `${label}: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(label);
    }
    if (res.headersSent) return;

    const error = STATUS_CODES[status] ?? 'Error';
    const message = status >= 500 ? error : clientMessage(exception, status, error);
    res.status(status).json({ statusCode: status, error, message });
  }
}

const accessLogger = new Logger('HTTP');

// Logs method, path (no query string), status and duration. Never headers or bodies.
function accessLog(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    accessLogger.log(`${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
}

// The single place where global hardening is configured. main.ts and the e2e tests both call it.
export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.use(accessLog);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
}
