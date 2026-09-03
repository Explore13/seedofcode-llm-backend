import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from '../apikeys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawKey = this.extractApiKey(request);

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

  /**
   * Extracts API key from:
   * 1. 'x-api-key' header (must start with soc_live_ or soc_test_)
   * 2. 'Authorization: api_key <token>' / 'Authorization: apikey <token>' (must start with soc_live_ or soc_test_)
   */
  private extractApiKey(request: any): string | null {
    // 1. Check 'x-api-key' header (only the raw key directly)
    const xApiKey = request.headers?.['x-api-key'];
    if (xApiKey && typeof xApiKey === 'string') {
      const trimmed = xApiKey.trim();
      if (trimmed.startsWith('soc_live_') || trimmed.startsWith('soc_test_')) {
        return trimmed;
      }
      return null;
    }

    // 2. Check 'Authorization' header
    const authHeader = request.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const trimmed = authHeader.trim();
      const parts = trimmed.split(/\s+/);
      const scheme = parts[0]?.toLowerCase();
      const token = parts[1];

      // If it is api_key or apikey, token must start with soc_live_ or soc_test_
      if (
        ['api_key', 'apikey'].includes(scheme) &&
        token &&
        (token.startsWith('soc_live_') || token.startsWith('soc_test_'))
      ) {
        return token;
      }
    }

    return null;
  }
}
