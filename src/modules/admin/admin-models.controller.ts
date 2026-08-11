import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ModelsService } from '../models/models.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { UpdateModelDto } from './dto/update-model.dto';

@Controller('admin/models')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Post('sync')
  async syncModels() {
    return this.modelsService.syncFromOllama();
  }

  @Patch(':id')
  async updateModel(
    @Param('id') id: string,
    @Body() updateData: UpdateModelDto,
  ) {
    return this.modelsService.updateModel(id, updateData);
  }
}
