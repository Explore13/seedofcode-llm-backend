import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
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

  /**
   * GET /admin/models
   * Fetch all models or filter by query: ?id=... or ?name=...
   * Optional query param: ?includeDeleted=true
   */
  @Get()
  async getModels(
    @Query('id') id?: string,
    @Query('name') name?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    const withDeleted = includeDeleted === 'true';
    if (id) {
      return this.modelsService.findById(id, withDeleted);
    }
    if (name) {
      return this.modelsService.findByNameOrThrow(name, withDeleted);
    }
    return this.modelsService.findAll(withDeleted);
  }

  /**
   * GET /admin/models/id/:id
   * Fetch a model by its ID.
   * Optional query param: ?includeDeleted=true
   */
  @Get('id/:id')
  async getModelById(
    @Param('id') id: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.modelsService.findById(id, includeDeleted === 'true');
  }

  /**
   * GET /admin/models/name/:name
   * Fetch a model by its model name (e.g. 'llama3.1:8b').
   * Optional query param: ?includeDeleted=true
   */
  @Get('name/:name')
  async getModelByName(
    @Param('name') name: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.modelsService.findByNameOrThrow(
      name,
      includeDeleted === 'true',
    );
  }

  /**
   * GET /admin/models/:identifier
   * Flexible lookup by either model ID (UUID) or model name.
   * Optional query param: ?includeDeleted=true
   */
  @Get(':identifier')
  async getModelByIdOrName(
    @Param('identifier') identifier: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.modelsService.findByIdOrName(
      identifier,
      includeDeleted === 'true',
    );
  }

  @Patch(':id')
  async updateModel(
    @Param('id') id: string,
    @Body() updateData: UpdateModelDto,
  ) {
    return this.modelsService.updateModel(id, updateData);
  }

  /**
   * DELETE /admin/models
   * Soft-delete a model via query parameters: ?id=... or ?name=...
   */
  @Delete()
  async deleteModelByQuery(
    @Query('id') id?: string,
    @Query('name') name?: string,
  ) {
    if (id) {
      return this.modelsService.softDeleteById(id);
    }
    if (name) {
      return this.modelsService.softDeleteByName(name);
    }
    throw new BadRequestException(
      'Either id or name query parameter must be provided',
    );
  }

  /**
   * DELETE /admin/models/id/:id
   * Soft-delete a model by its ID.
   */
  @Delete('id/:id')
  async deleteModelById(@Param('id') id: string) {
    return this.modelsService.softDeleteById(id);
  }

  /**
   * DELETE /admin/models/name/:name
   * Soft-delete a model by its model name.
   */
  @Delete('name/:name')
  async deleteModelByName(@Param('name') name: string) {
    return this.modelsService.softDeleteByName(name);
  }

  /**
   * DELETE /admin/models/:identifier
   * Flexible soft-delete by either model ID (UUID) or model name.
   */
  @Delete(':identifier')
  async deleteModelByIdOrName(@Param('identifier') identifier: string) {
    return this.modelsService.softDeleteByIdOrName(identifier);
  }
}

