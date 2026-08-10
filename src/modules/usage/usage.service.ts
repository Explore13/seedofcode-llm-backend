import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  FindOptionsWhere,
  EntityManager,
  DeepPartial,
} from 'typeorm';
import { UsageLog } from './entities/usage-log.entity';
import {
  GetUsageQueryDto,
  AdminGetUsageQueryDto,
  CreateUsageLogDto,
  UpdateUsageLogDto,
} from './dto/usage.dto';

@Injectable()
export class UsageService {
  constructor(
    @InjectRepository(UsageLog)
    private readonly usageLogRepository: Repository<UsageLog>,
  ) {}

  async getUserUsage(userId: string, query: GetUsageQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.usageLogRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
      relations: { creditTransactions: true },
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTodayUsageSummary(userId?: string) {
    // Normalize to UTC midnight so the "today" window is timezone-independent
    // (not tied to the server's local timezone).
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const qb = this.usageLogRepository
      .createQueryBuilder('log')
      .select('SUM(log.promptTokens)', 'totalPromptTokens')
      .addSelect('SUM(log.completionTokens)', 'totalCompletionTokens')
      .addSelect('SUM(log.creditsCost)', 'totalCost')
      .addSelect('COUNT(log.id)', 'totalRequests')
      .where('log.createdAt >= :today', { today });

    if (userId) {
      qb.andWhere('log.userId = :userId', { userId });
    }

    const result = await qb.getRawOne();

    return {
      totalPromptTokens: parseInt(result.totalPromptTokens || '0', 10),
      totalCompletionTokens: parseInt(result.totalCompletionTokens || '0', 10),
      totalTokens:
        parseInt(result.totalPromptTokens || '0', 10) +
        parseInt(result.totalCompletionTokens || '0', 10),
      totalCost: parseInt(result.totalCost || '0', 10),
      totalRequests: parseInt(result.totalRequests || '0', 10),
    };
  }

  async getAdminUsage(query: AdminGetUsageQueryDto) {
    const { page = 1, limit = 10, userId } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<UsageLog> = {};
    if (userId) {
      where.userId = userId;
    }

    const [data, total] = await this.usageLogRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
      relations: { creditTransactions: true },
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(
    createUsageLogDto: CreateUsageLogDto | Partial<UsageLog>,
    manager?: EntityManager,
  ): Promise<UsageLog> {
    const repo = manager
      ? manager.getRepository(UsageLog)
      : this.usageLogRepository;
    const log = repo.create(createUsageLogDto as DeepPartial<UsageLog>);
    return await repo.save(log);
  }

  async findOne(id: string, manager?: EntityManager) {
    const repo = manager
      ? manager.getRepository(UsageLog)
      : this.usageLogRepository;
    const log = await repo.findOne({
      where: { id },
      relations: { creditTransactions: true },
    });
    if (!log) {
      throw new NotFoundException(`Usage log with ID ${id} not found`);
    }
    return log;
  }

  async update(
    id: string,
    updateUsageLogDto: UpdateUsageLogDto,
    manager?: EntityManager,
  ) {
    const repo = manager
      ? manager.getRepository(UsageLog)
      : this.usageLogRepository;
    const log = await this.findOne(id, manager);
    repo.merge(log, updateUsageLogDto);
    return await repo.save(log);
  }

  async remove(id: string, manager?: EntityManager) {
    const repo = manager
      ? manager.getRepository(UsageLog)
      : this.usageLogRepository;
    const log = await this.findOne(id, manager);
    return await repo.softRemove(log);
  }
}
