import { Injectable, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_ALLOW_UNVERIFIED_KEY } from '../decorators/allow-unverified.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication token is missing or invalid');
    }

    const isAllowUnverified = this.reflector.getAllAndOverride<boolean>(IS_ALLOW_UNVERIFIED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (user.verified || isAllowUnverified) {
      return user;
    }

    // You can customize this error response fully if you use an HttpException or create a custom one.
    throw new ForbiddenException({
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email to access this resource',
    });
  }
}
