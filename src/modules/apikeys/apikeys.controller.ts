import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiKeysService } from './apikeys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('apikeys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) { }

  @Post()
  async create(@Request() req, @Body() createApiKeyDto: CreateApiKeyDto) {
    const userId = req.user.id;
    const mode = createApiKeyDto.mode || 'live';
    const result = await this.apiKeysService.createKey(userId, createApiKeyDto.name, mode);

    const { keyHash, ...safeKey } = result.apiKey;
    return {
      success: true,
      data: {
        rawKey: result.rawKey,
        apiKey: safeKey,
      },
    };
  }

  @Get()
  async findAll(@Request() req) {
    const userId = req.user.id;
    const keys = await this.apiKeysService.listKeys(userId);
    return {
      success: true,
      data: keys,
    };
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    await this.apiKeysService.deleteKey(userId, id);
    return {
      success: true,
      data: {
        message: 'API Key deleted successfully',
      },
    };
  }

  @Patch(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateApiKeyDto: UpdateApiKeyDto,
  ) {
    const userId = req.user.id;
    const updatedKey = await this.apiKeysService.updateKey(userId, id, updateApiKeyDto);
    return {
      success: true,
      data: updatedKey,
    };
  }

  @Post(':id/regenerate')
  async regenerate(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    const result = await this.apiKeysService.regenerateKey(userId, id);
    return {
      success: true,
      data: {
        rawKey: result.rawKey,
      },
    };
  }
}
