import { Test, TestingModule } from '@nestjs/testing';
import { AdminModelsController } from './admin-models.controller';
import { ModelsService } from '../models/models.service';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '../user/entities/user.entity';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('AdminModelsController', () => {
  let controller: AdminModelsController;
  let modelsService: Partial<Record<keyof ModelsService, jest.Mock>>;

  const mockModel = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'llama3.1:8b',
    enabled: true,
  };

  beforeEach(async () => {
    modelsService = {
      syncFromOllama: jest.fn(),
      findAll: jest.fn().mockResolvedValue([mockModel]),
      findById: jest.fn().mockResolvedValue(mockModel),
      findByNameOrThrow: jest.fn().mockResolvedValue(mockModel),
      findByIdOrName: jest.fn().mockResolvedValue(mockModel),
      updateModel: jest.fn().mockResolvedValue(mockModel),
      softDeleteById: jest.fn().mockResolvedValue({
        success: true,
        message: `Model '${mockModel.name}' (ID: ${mockModel.id}) soft-deleted successfully`,
        data: { ...mockModel, enabled: false },
      }),
      softDeleteByName: jest.fn().mockResolvedValue({
        success: true,
        message: `Model '${mockModel.name}' soft-deleted successfully`,
        data: { ...mockModel, enabled: false },
      }),
      softDeleteByIdOrName: jest.fn().mockResolvedValue({
        success: true,
        message: `Model '${mockModel.name}' soft-deleted successfully`,
        data: { ...mockModel, enabled: false },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminModelsController],
      providers: [
        {
          provide: ModelsService,
          useValue: modelsService,
        },
      ],
    }).compile();

    controller = module.get<AdminModelsController>(AdminModelsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should enforce ADMIN role on controller', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminModelsController);
    expect(roles).toEqual([UserRole.ADMIN]);
  });

  describe('GET models', () => {
    it('should get all models if no filter is provided', async () => {
      const res = await controller.getModels();
      expect(modelsService.findAll).toHaveBeenCalledWith(false);
      expect(res).toEqual([mockModel]);
    });

    it('should get model by id query parameter', async () => {
      const res = await controller.getModels('123e4567-e89b-12d3-a456-426614174000');
      expect(modelsService.findById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', false);
      expect(res).toEqual(mockModel);
    });

    it('should get model by name query parameter', async () => {
      const res = await controller.getModels(undefined, 'llama3.1:8b');
      expect(modelsService.findByNameOrThrow).toHaveBeenCalledWith('llama3.1:8b', false);
      expect(res).toEqual(mockModel);
    });

    it('should get model by id route param /admin/models/id/:id', async () => {
      const res = await controller.getModelById('123e4567-e89b-12d3-a456-426614174000');
      expect(modelsService.findById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', false);
      expect(res).toEqual(mockModel);
    });

    it('should get model by name route param /admin/models/name/:name', async () => {
      const res = await controller.getModelByName('llama3.1:8b');
      expect(modelsService.findByNameOrThrow).toHaveBeenCalledWith('llama3.1:8b', false);
      expect(res).toEqual(mockModel);
    });

    it('should get model by identifier param /admin/models/:identifier', async () => {
      const res = await controller.getModelByIdOrName('llama3.1:8b');
      expect(modelsService.findByIdOrName).toHaveBeenCalledWith('llama3.1:8b', false);
      expect(res).toEqual(mockModel);
    });
  });

  describe('DELETE models (soft delete)', () => {
    it('should soft delete by id route param /admin/models/id/:id', async () => {
      const res = await controller.deleteModelById('123e4567-e89b-12d3-a456-426614174000');
      expect(modelsService.softDeleteById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      expect(res.success).toBe(true);
    });

    it('should soft delete by name route param /admin/models/name/:name', async () => {
      const res = await controller.deleteModelByName('llama3.1:8b');
      expect(modelsService.softDeleteByName).toHaveBeenCalledWith('llama3.1:8b');
      expect(res.success).toBe(true);
    });

    it('should soft delete by identifier param /admin/models/:identifier', async () => {
      const res = await controller.deleteModelByIdOrName('123e4567-e89b-12d3-a456-426614174000');
      expect(modelsService.softDeleteByIdOrName).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      expect(res.success).toBe(true);
    });

    it('should soft delete by query id /admin/models?id=...', async () => {
      const res = await controller.deleteModelByQuery('123e4567-e89b-12d3-a456-426614174000');
      expect(modelsService.softDeleteById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      expect(res.success).toBe(true);
    });

    it('should soft delete by query name /admin/models?name=...', async () => {
      const res = await controller.deleteModelByQuery(undefined, 'llama3.1:8b');
      expect(modelsService.softDeleteByName).toHaveBeenCalledWith('llama3.1:8b');
      expect(res.success).toBe(true);
    });

    it('should throw BadRequestException if query delete has neither id nor name', async () => {
      await expect(controller.deleteModelByQuery()).rejects.toThrow(BadRequestException);
    });
  });
});
