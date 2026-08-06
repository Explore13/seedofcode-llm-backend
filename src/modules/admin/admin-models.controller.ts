import { Controller, Post, Patch, Param, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { ModelsService } from '../models/models.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ModelInfo } from '../models/entities/model-info.entity';
import { Repository } from 'typeorm';

@Controller('admin/models')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminModelsController {
  constructor(
    private readonly modelsService: ModelsService,
    @InjectRepository(ModelInfo)
    private readonly modelInfoRepo: Repository<ModelInfo>,
  ) {}

  @Post('sync')
  async syncModels() {
    return this.modelsService.syncFromOllama();
  }

  @Patch(':id')
  async updateModel(
    @Param('id') id: string,
    @Body() updateData: { enabled?: boolean; creditsPerInputToken?: number; creditsPerOutputToken?: number },
  ) {
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

    await this.modelInfoRepo.save(model);
    return model;
  }
}
