import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysService } from '../apikeys.service';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let apiKeysService: Partial<Record<keyof ApiKeysService, jest.Mock>>;

  const mockValidKeyData = {
    userId: 'user-uuid-123',
    role: 'USER',
    apiKeyId: 'key-uuid-456',
  };

  beforeEach(() => {
    apiKeysService = {
      validateKey: jest.fn().mockImplementation(async (key: string) => {
        if (key === 'soc_live_valid123') {
          return mockValidKeyData;
        }
        return null;
      }),
    };

    guard = new ApiKeyGuard(apiKeysService as unknown as ApiKeysService);
  });

  const createMockContext = (headers: Record<string, string>): ExecutionContext => {
    const request = {
      headers,
      user: null,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should reject Authorization: Bearer <token> (Bearer is reserved for JWT, not ApiKey)', async () => {
    const ctx = createMockContext({
      authorization: 'Bearer soc_live_valid123',
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should authenticate with Authorization: api_key <token>', async () => {
    const ctx = createMockContext({
      authorization: 'api_key soc_live_valid123',
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect((ctx.switchToHttp().getRequest() as any).user).toEqual({
      id: mockValidKeyData.userId,
      role: mockValidKeyData.role,
      apiKeyId: mockValidKeyData.apiKeyId,
      authMethod: 'api_key',
    });
  });

  it('should authenticate with Authorization: ApiKey <token> (case-insensitive)', async () => {
    const ctx = createMockContext({
      authorization: 'ApiKey soc_live_valid123',
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should authenticate with x-api-key header containing only the key', async () => {
    const ctx = createMockContext({
      'x-api-key': 'soc_live_valid123',
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should reject x-api-key if it includes extra scheme prefix like "api_key "', async () => {
    const ctx = createMockContext({
      'x-api-key': 'api_key soc_live_valid123',
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if key is invalid in database', async () => {
    const ctx = createMockContext({
      authorization: 'api_key soc_live_invalid',
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject Authorization: api_key <token> if token does not start with soc_live_ or soc_test_', async () => {
    const ctx = createMockContext({
      authorization: 'api_key other_token_123',
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject x-api-key if token does not start with soc_live_ or soc_test_', async () => {
    const ctx = createMockContext({
      'x-api-key': 'other_token_123',
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if no auth headers provided', async () => {
    const ctx = createMockContext({});

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
