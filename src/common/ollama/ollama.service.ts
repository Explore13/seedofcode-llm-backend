import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ollama } from 'ollama';
import { ChatParams, NormalizedChatResult } from './ollama.types';

@Injectable()
export class OllamaService {
  private readonly client: Ollama;
  private readonly defaultOptions = { temperature: 0.7, top_p: 0.9 };

  constructor(private readonly configService: ConfigService) {
    this.client = new Ollama({
      host: this.configService.get<string>('OLLAMA_URL', 'https://llm.seedofcode.dev'),
    });
  }

  async listModels() {
    return this.client.list();
  }

  async showModel(name: string) {
    return this.client.show({ model: name });
  }

  async chat(params: ChatParams): Promise<NormalizedChatResult> {
    const start = Date.now();
    const response = await this.client.chat({
      model: params.model,
      messages: params.messages,
      stream: false,
      think: params.think as any,
      options: { ...this.defaultOptions, ...params.options },
    });
    return {
      content: response.message.content,
      thinking: response.message.thinking,
      promptTokens: response.prompt_eval_count,
      completionTokens: response.eval_count,
      durationMs: Date.now() - start,
      modelUsed: response.model,
    };
  }

  chatStream(params: ChatParams) {
    return this.client.chat({
      model: params.model,
      messages: params.messages,
      stream: true,
      think: params.think as any,
      options: { ...this.defaultOptions, ...params.options },
    });
  }
}


