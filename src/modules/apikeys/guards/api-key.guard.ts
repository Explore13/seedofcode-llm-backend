import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from '../apikeys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid API Key');
    }

    const rawKey = authHeader.split(' ')[1];

    if (!rawKey) {
      throw new UnauthorizedException('Missing or invalid API Key');
    }

    const keyData = await this.apiKeysService.validateKey(rawKey);

    if (!keyData) {
      throw new UnauthorizedException('Missing or invalid API Key');
    }

    request.user = {
      id: keyData.userId,
      role: keyData.role,
      apiKeyId: keyData.apiKeyId,
      authMethod: 'api_key',
    };

    return true;
  }
}
