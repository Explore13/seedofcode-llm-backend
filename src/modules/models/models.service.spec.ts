import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ModelsService } from './models.service';
import { ModelInfo } from './entities/model-info.entity';
import { OllamaService } from '../../common/ollama/ollama.service';

describe('ModelsService', () => {
  let service: ModelsService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    softRemove: jest.Mock;
  };

  const mockModel: Partial<ModelInfo> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'llama3.1:8b',
    enabled: true,
  };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((m) => Promise.resolve(m)),
      softRemove: jest.fn().mockImplementation((m) => Promise.resolve({ ...m, deletedAt: new Date() })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelsService,
        {
          provide: getRepositoryToken(ModelInfo),
          useValue: repo,
        },
        {
          provide: OllamaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ModelsService>(ModelsService);
  });

  describe('findById', () => {
    it('should return model if found', async () => {
      repo.findOne.mockResolvedValue(mockModel);
      const res = await service.findById(mockModel.id!);
      expect(res).toEqual(mockModel);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: mockModel.id },
        withDeleted: false,
      });
    });

    it('should throw NotFoundException if not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByNameOrThrow', () => {
    it('should return model if found', async () => {
      repo.findOne.mockResolvedValue(mockModel);
      const res = await service.findByNameOrThrow(mockModel.name!);
      expect(res).toEqual(mockModel);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { name: mockModel.name },
        withDeleted: false,
      });
    });

    it('should throw NotFoundException if not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findByNameOrThrow('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDeleteById', () => {
    it('should disable and soft-remove model by ID', async () => {
      const modelCopy = { ...mockModel };
      repo.findOne.mockResolvedValue(modelCopy);

      const res = await service.softDeleteById(mockModel.id!);
      expect(res.success).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
      expect(repo.softRemove).toHaveBeenCalled();
    });

    it('should throw NotFoundException if model not found by ID', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.softDeleteById('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDeleteByName', () => {
    it('should disable and soft-remove model by name', async () => {
      const modelCopy = { ...mockModel };
      repo.findOne.mockResolvedValue(modelCopy);

      const res = await service.softDeleteByName(mockModel.name!);
      expect(res.success).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
      expect(repo.softRemove).toHaveBeenCalled();
    });

    it('should throw NotFoundException if model not found by name', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.softDeleteByName('unknown')).rejects.toThrow(NotFoundException);
    });
  });
});
