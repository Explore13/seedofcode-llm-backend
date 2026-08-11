import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      title: 'Seedofcode AI',
      description: 'High-performance API infrastructure for LLM inference.',
      visit_url: 'https://ai.seedofcode.dev',
      author: 'Surya Ghosh',
    };
  }
}
