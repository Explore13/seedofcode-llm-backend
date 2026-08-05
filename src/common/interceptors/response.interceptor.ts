import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    return next.handle().pipe(
      map((res: unknown) => {
        const statusCode = response.statusCode || HttpStatus.OK;

        // Prevent double wrapping if the response is already formatted
        if (
          res &&
          typeof res === 'object' &&
          'success' in res &&
          'statusCode' in res
        ) {
          return res;
        }

        // Support pagination or custom meta data if returned as { data: [...], meta: {...} }
        const data =
          res && typeof res === 'object' && 'data' in res
            ? (res as any).data
            : res ?? null;
            
        const meta =
          res && typeof res === 'object' && 'meta' in res
            ? (res as any).meta
            : undefined;

        const message =
          res && typeof res === 'object' && 'message' in res
            ? (res as any).message
            : 'Request successful';

        return {
          success: true,
          data,
          ...(meta && { meta }),
          statusCode,
          message,
          path: request.originalUrl || request.url,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
