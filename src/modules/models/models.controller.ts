import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { ModelsService } from './models.service';
import { HybridAuthGuard } from '../auth/guards/hybrid-auth.guard';

@Controller('models')
@UseGuards(HybridAuthGuard)
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  async findAll() {
    return this.modelsService.findAllEnabled();
  }

  @Get(':name')
  async findOne(@Param('name') name: string) {
    const model = await this.modelsService.findByName(name);
    if (!model || !model.enabled) {
      throw new NotFoundException(`Model ${name} not found or disabled`);
    }
    return model;
  }
  @Get('family/:family')
  async findByFamily(@Param('family') family: string) {
    const models = await this.modelsService.findByFamily(family);
    if (!models || models.length === 0) {
      throw new NotFoundException(`No enabled models found for family ${family}`);
    }
    return models;
  }
}
