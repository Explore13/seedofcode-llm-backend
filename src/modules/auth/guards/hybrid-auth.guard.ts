import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiKeyGuard } from '../../apikeys/guards/api-key.guard';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { lastValueFrom, Observable } from 'rxjs';

@Injectable()
export class HybridAuthGuard implements CanActivate {
  constructor(
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly apiKeyGuard: ApiKeyGuard,
    private readonly reflector: Reflector,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const xApiKey = request.headers?.['x-api-key'];
    const authHeader = request.headers?.authorization;

    // 1. If 'x-api-key' header is present, delegate directly to ApiKeyGuard
    if (xApiKey) {
      return this.apiKeyGuard.canActivate(context);
    }

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException(
        'Missing or invalid authorization credentials',
      );
    }

    const trimmed = authHeader.trim();
    const parts = trimmed.split(/\s+/);
    const scheme = parts[0]?.toLowerCase();
    const token = parts[1];

    // 2. If 'Authorization: api_key <token>' or 'Authorization: apikey <token>', delegate to ApiKeyGuard
    if (
      ['api_key', 'apikey'].includes(scheme) &&
      token &&
      (token.startsWith('soc_live_') || token.startsWith('soc_test_'))
    ) {
      return this.apiKeyGuard.canActivate(context);
    }

    // 3. If 'Authorization: Bearer <token>'
    // if (scheme === 'bearer' && parts[1]) {
    //   const token = parts[1];
    //   if (token.startsWith('soc_live_') || token.startsWith('soc_test_')) {
    //     return this.apiKeyGuard.canActivate(context);
    //   }
    // }

    // 4. Default: delegate to JwtAuthGuard
    const result = this.jwtAuthGuard.canActivate(context);
    if (result instanceof Observable) {
      return await lastValueFrom(result);
    }
    return await Promise.resolve(result);
  }
}
