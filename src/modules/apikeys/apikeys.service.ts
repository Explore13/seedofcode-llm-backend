import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ApiKey } from './entities/api-key.entity';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';
import { User } from '../user/entities/user.entity';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) { }

  private hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  private generateKey(mode: 'live' | 'test' = 'live'): { rawKey: string; keyHash: string; keyPrefix: string } {
    const randomBytes = crypto.randomBytes(32).toString('hex');
    const rawKey = `soc_${mode}_${randomBytes}`;
    const keyHash = this.hashKey(rawKey);
    // e.g. "soc_live_ab12cdef3456"
    const prefixLength = `soc_${mode}_`.length + 12;
    const keyPrefix = rawKey.substring(0, prefixLength);

    return { rawKey, keyHash, keyPrefix };
  }

  async createKey(userId: string, name: string, mode: 'live' | 'test' = 'live'): Promise<{ rawKey: string; apiKey: ApiKey }> {
    const activeCount = await this.apiKeyRepo.count({
      where: { userId, isActive: true },
    });

    if (activeCount >= 10) {
      throw new BadRequestException('You have reached the maximum limit of 10 active API keys.');
    }

    const { rawKey, keyHash, keyPrefix } = this.generateKey(mode);

    const apiKey = this.apiKeyRepo.create({
      userId,
      name,
      keyHash,
      keyPrefix,
      isActive: true,
    });

    await this.apiKeyRepo.save(apiKey);

    // Only returning the rawKey this once
    return { rawKey, apiKey };
  }

  async listKeys(userId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
    const keys = await this.apiKeyRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    // Strip keyHash from the returned entities
    return keys.map(key => {
      const { keyHash, ...safeKey } = key;
      return safeKey as ApiKey;
    });
  }

  async deleteKey(userId: string, keyId: string): Promise<void> {
    const key = await this.apiKeyRepo.findOne({
      where: { id: keyId, userId },
    });

    if (!key) {
      throw new NotFoundException('API Key not found');
    }

    key.isActive = false;
    // We save the isActive = false change, then immediately softRemove so deletedAt is populated
    await this.apiKeyRepo.save(key);
    await this.apiKeyRepo.softRemove(key);
  }

  async updateKey(userId: string, keyId: string, updateData: UpdateApiKeyDto): Promise<Omit<ApiKey, 'keyHash'>> {
    // Note: TypeORM automatically excludes soft-deleted rows, so this will only find keys that aren't deleted
    const key = await this.apiKeyRepo.findOne({
      where: { id: keyId, userId },
    });

    if (!key) {
      throw new NotFoundException('API Key not found');
    }

    if (updateData.name !== undefined) {
      key.name = updateData.name;
    }

    if (updateData.isActive !== undefined) {
      // If turning back on, ensure we don't breach the limit
      if (updateData.isActive === true && key.isActive === false) {
        const activeCount = await this.apiKeyRepo.count({
          where: { userId, isActive: true },
        });

        if (activeCount >= 10) {
          throw new BadRequestException('You have reached the maximum limit of 10 active API keys.');
        }
      }
      key.isActive = updateData.isActive;
    }

    await this.apiKeyRepo.save(key);
    const { keyHash, ...safeKey } = key;
    return safeKey as ApiKey;
  }

  async regenerateKey(userId: string, keyId: string): Promise<{ rawKey: string }> {
    const key = await this.apiKeyRepo.findOne({
      where: { id: keyId, userId },
    });

    if (!key) {
      throw new NotFoundException('API Key not found');
    }

    // Determine mode from the existing prefix (e.g. soc_test_...)
    const mode = key.keyPrefix.startsWith('soc_test_') ? 'test' : 'live';

    const { rawKey, keyHash, keyPrefix } = this.generateKey(mode);

    key.keyHash = keyHash;
    key.keyPrefix = keyPrefix;

    await this.apiKeyRepo.save(key);

    return { rawKey };
  }

  async validateKey(rawKey: string): Promise<{ userId: string; role: string; apiKeyId: string } | null> {
    const keyHash = this.hashKey(rawKey);

    // We must join the User table to retrieve the actual role.
    const key = await this.apiKeyRepo.findOne({
      where: { keyHash, isActive: true },
      relations: { user: true },
    });

    if (!key || !key.user) {
      return null;
    }

    // Async update lastUsedAt to avoid blocking the auth phase latency
    this.apiKeyRepo.update(key.id, { lastUsedAt: new Date() }).catch(err => {
      // Typically log this error in a real production system using a logger service
      console.error('Failed to update lastUsedAt for API Key', err);
    });

    return {
      userId: key.user.id,
      role: key.user.role,
      apiKeyId: key.id,
    };
  }
}
