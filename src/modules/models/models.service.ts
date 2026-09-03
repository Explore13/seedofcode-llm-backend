import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { ModelInfo, ModelProvider } from './entities/model-info.entity';
import { OllamaService } from '../../common/ollama/ollama.service';

@Injectable()
export class ModelsService {
  private readonly logger = new Logger(ModelsService.name);

  constructor(
    @InjectRepository(ModelInfo)
    private readonly modelInfoRepo: Repository<ModelInfo>,
    private readonly ollamaService: OllamaService,
  ) {}

  async findAllEnabled(): Promise<ModelInfo[]> {
    return this.modelInfoRepo.find({ where: { enabled: true } });
  }

  async findByName(name: string): Promise<ModelInfo | null> {
    return this.modelInfoRepo.findOne({ where: { name } });
  }

  async findByFamily(family: string): Promise<ModelInfo[]> {
    return this.modelInfoRepo.find({ where: { family, enabled: true } });
  }

  async findAll(includeDeleted = false): Promise<ModelInfo[]> {
    return this.modelInfoRepo.find({
      withDeleted: includeDeleted,
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, includeDeleted = false): Promise<ModelInfo> {
    const model = await this.modelInfoRepo.findOne({
      where: { id },
      withDeleted: includeDeleted,
    });
    if (!model) {
      throw new NotFoundException(`Model with ID '${id}' not found`);
    }
    return model;
  }

  async findByNameOrThrow(
    name: string,
    includeDeleted = false,
  ): Promise<ModelInfo> {
    const model = await this.modelInfoRepo.findOne({
      where: { name },
      withDeleted: includeDeleted,
    });
    if (!model) {
      throw new NotFoundException(`Model with name '${name}' not found`);
    }
    return model;
  }

  async findByIdOrName(
    identifier: string,
    includeDeleted = false,
  ): Promise<ModelInfo> {
    if (isUUID(identifier)) {
      return this.findById(identifier, includeDeleted);
    }
    return this.findByNameOrThrow(identifier, includeDeleted);
  }

  async softDeleteById(
    id: string,
  ): Promise<{ success: boolean; message: string; data: ModelInfo }> {
    const model = await this.modelInfoRepo.findOne({ where: { id } });
    if (!model) {
      throw new NotFoundException(`Model with ID '${id}' not found`);
    }

    model.enabled = false;
    await this.modelInfoRepo.save(model);
    const softDeleted = await this.modelInfoRepo.softRemove(model);

    return {
      success: true,
      message: `Model '${model.name}' (ID: ${id}) soft-deleted successfully`,
      data: softDeleted,
    };
  }

  async softDeleteByName(
    name: string,
  ): Promise<{ success: boolean; message: string; data: ModelInfo }> {
    const model = await this.modelInfoRepo.findOne({ where: { name } });
    if (!model) {
      throw new NotFoundException(`Model with name '${name}' not found`);
    }

    model.enabled = false;
    await this.modelInfoRepo.save(model);
    const softDeleted = await this.modelInfoRepo.softRemove(model);

    return {
      success: true,
      message: `Model '${model.name}' soft-deleted successfully`,
      data: softDeleted,
    };
  }

  async softDeleteByIdOrName(
    identifier: string,
  ): Promise<{ success: boolean; message: string; data: ModelInfo }> {
    if (isUUID(identifier)) {
      return this.softDeleteById(identifier);
    }
    return this.softDeleteByName(identifier);
  }

  async updateModel(
    id: string,
    updateData: {
      enabled?: boolean;
      creditsPerInputToken?: number;
      creditsPerOutputToken?: number;
    },
  ): Promise<ModelInfo> {
    const model = await this.modelInfoRepo.findOne({ where: { id } });
    if (!model) {
      throw new NotFoundException(`Model with ID ${id} not found`);
    }

    if (updateData.enabled !== undefined) {
      model.enabled = updateData.enabled;
    }
    if (updateData.creditsPerInputToken !== undefined) {
      model.creditsPerInputToken = updateData.creditsPerInputToken;
    }
    if (updateData.creditsPerOutputToken !== undefined) {
      model.creditsPerOutputToken = updateData.creditsPerOutputToken;
    }

    return this.modelInfoRepo.save(model);
  }

  async syncFromOllama(): Promise<ModelInfo[]> {
    try {
      const tagsData = await this.ollamaService.listModels();
      const models = tagsData.models || [];

      const syncedModels: ModelInfo[] = [];

      for (const model of models) {
        let maxContext: number | undefined;
        let capabilities: string[] = [];
        let family: string | undefined = model.details?.family;
        let parameterSize: string | undefined = model.details?.parameter_size;
        let quantizationLevel: string | undefined =
          model.details?.quantization_level;
        let parameterCount: string | undefined;

        try {
          const showData: any = await this.ollamaService.showModel(model.name);

          if (showData.capabilities && Array.isArray(showData.capabilities)) {
            capabilities = showData.capabilities;
          } else if (
            showData.details?.capabilities &&
            Array.isArray(showData.details.capabilities)
          ) {
            capabilities = showData.details.capabilities;
          } else if (
            showData.model_info?.capabilities &&
            Array.isArray(showData.model_info.capabilities)
          ) {
            capabilities = showData.model_info.capabilities;
          }

          if (showData.details) {
            family = showData.details.family || family;
            parameterSize = showData.details.parameter_size || parameterSize;
            quantizationLevel =
              showData.details.quantization_level || quantizationLevel;
          }

          if (showData.model_info) {
            const contextKeys = Object.keys(showData.model_info).filter((k) =>
              k.endsWith('.context_length'),
            );
            if (contextKeys.length > 0) {
              maxContext = showData.model_info[contextKeys[0]];
            }
            const paramCountRaw =
              showData.model_info['general.parameter_count'];
            if (paramCountRaw !== undefined && paramCountRaw !== null) {
              parameterCount = paramCountRaw.toString();
            }
          }
        } catch (showError) {
          this.logger.warn(
            `Failed to fetch details for model ${model.name}: ${(showError as Error).message}`,
          );
        }

        const existingModel = await this.modelInfoRepo.findOne({
          where: { name: model.name },
          withDeleted: true,
        });

        if (existingModel) {
          existingModel.maxContext = maxContext as any;
          existingModel.capabilities = capabilities;
          existingModel.family = family as any;
          existingModel.parameterSize = parameterSize as any;
          existingModel.parameterCount = parameterCount as any;
          existingModel.quantizationLevel = quantizationLevel as any;
          existingModel.sizeBytes = model.size?.toString() as any;
          existingModel.digest = model.digest as any;
          existingModel.enabled = true; // re-enable a model that reappeared in Ollama
          existingModel.deletedAt = null as any;
          existingModel.lastSyncedAt = new Date();
          await this.modelInfoRepo.save(existingModel);
          syncedModels.push(existingModel);
        } else {
          const newModel = this.modelInfoRepo.create({
            name: model.name,
            provider: ModelProvider.OLLAMA,
            enabled: true,
            maxContext: maxContext as any,
            capabilities,
            family: family as any,
            parameterSize: parameterSize as any,
            parameterCount: parameterCount as any,
            quantizationLevel: quantizationLevel as any,
            sizeBytes: model.size?.toString() as any,
            digest: model.digest as any,
            creditsPerInputToken: 10,
            creditsPerOutputToken: 30,
            lastSyncedAt: new Date(),
          });
          await this.modelInfoRepo.save(newModel);
          syncedModels.push(newModel);
        }
      }

      // Disable any DB model that Ollama no longer reports, so inference
      // validation can't pass for a model that has been removed from the host.
      const currentNames = models.map((m) => m.name);
      if (currentNames.length > 0) {
        await this.modelInfoRepo
          .createQueryBuilder()
          .update(ModelInfo)
          .set({ enabled: false })
          .where('name NOT IN (:...currentNames)', { currentNames })
          .andWhere('enabled = :enabled', { enabled: true })
          .execute();
      }

      return syncedModels;
    } catch (error) {
      this.logger.error(
        `Error syncing models from Ollama: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        'Failed to sync models from Ollama',
      );
    }
  }
}
