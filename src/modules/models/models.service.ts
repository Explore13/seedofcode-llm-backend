import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelInfo, ModelProvider } from './entities/model-info.entity';
import { OllamaService } from '../../common/ollama/ollama.service';

@Injectable()
export class ModelsService {
  private readonly logger = new Logger(ModelsService.name);

  constructor(
    @InjectRepository(ModelInfo)
    private readonly modelInfoRepo: Repository<ModelInfo>,
    private readonly ollamaService: OllamaService,
  ) { }

  async findAllEnabled(): Promise<ModelInfo[]> {
    return this.modelInfoRepo.find({ where: { enabled: true } });
  }

  async findByName(name: string): Promise<ModelInfo | null> {
    return this.modelInfoRepo.findOne({ where: { name } });
  }

  async findByFamily(family: string): Promise<ModelInfo[]> {
    return this.modelInfoRepo.find({ where: { family, enabled: true } });
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
        let quantizationLevel: string | undefined = model.details?.quantization_level;

        try {
          const showData: any = await this.ollamaService.showModel(model.name);
          console.log(showData);

          if (showData.capabilities && Array.isArray(showData.capabilities)) {
            capabilities = showData.capabilities;
          } else if (showData.details?.capabilities && Array.isArray(showData.details.capabilities)) {
            capabilities = showData.details.capabilities;
          } else if (showData.model_info?.capabilities && Array.isArray(showData.model_info.capabilities)) {
            capabilities = showData.model_info.capabilities;
          }

          if (showData.details) {
            family = showData.details.family || family;
            parameterSize = showData.details.parameter_size || parameterSize;
            quantizationLevel = showData.details.quantization_level || quantizationLevel;
          }

          if (showData.model_info) {
            const contextKeys = Object.keys(showData.model_info).filter(k => k.endsWith('.context_length'));
            if (contextKeys.length > 0) {
              maxContext = showData.model_info[contextKeys[0]];
            }
          }
        } catch (showError) {
          this.logger.warn(`Failed to fetch details for model ${model.name}: ${(showError as Error).message}`);
        }

        const existingModel = await this.modelInfoRepo.findOne({ where: { name: model.name } });

        if (existingModel) {
          existingModel.maxContext = maxContext as any;
          existingModel.capabilities = capabilities;
          existingModel.family = family as any;
          existingModel.parameterSize = parameterSize as any;
          existingModel.quantizationLevel = quantizationLevel as any;
          existingModel.sizeBytes = model.size?.toString() as any;
          existingModel.digest = model.digest as any;
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

      return syncedModels;
    } catch (error) {
      this.logger.error(`Error syncing models from Ollama: ${(error as Error).message}`, (error as Error).stack);
      throw new InternalServerErrorException('Failed to sync models from Ollama');
    }
  }
}
