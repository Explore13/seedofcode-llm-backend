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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    if (token.startsWith('soc_live_') || token.startsWith('soc_test_')) {
      return this.apiKeyGuard.canActivate(context);
    }

    const result = this.jwtAuthGuard.canActivate(context);
    if (result instanceof Observable) {
      return await lastValueFrom(result);
    }
    return await Promise.resolve(result);
  }
}
