/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import 'dotenv/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  BadRequestException,
  ClassSerializerInterceptor,
  ValidationPipe,
} from '@nestjs/common';
import { useContainer } from 'class-validator';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/exceptions/http.exception';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Enable CORS for frontend
  app.enableCors({
    origin: '*',
  });

  // Serve static assets from the "assets" directory
  app.useStaticAssets(join(__dirname, '..', 'assets'), {
    prefix: '/assets/',
  });

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  // Enable class-validator to use Nest's dependency injection
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Global validation pipe with custom error formatting
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const extractMessage = (errs: any[]): string => {
          for (const err of errs) {
            if (err.constraints) {
              return Object.values(err.constraints)[0] as string;
            }
            if (err.children?.length) {
              return extractMessage(err.children);
            }
          }
          return 'Validation failed';
        };

        return new BadRequestException(extractMessage(errors));
      },
    }),
  );

  // Global interceptor to standardize responses
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new ResponseInterceptor(),
  );

  // Global filter to handle exceptions and format error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('SeedOfCode LLM API')
    .setDescription('API documentation for the SeedOfCode LLM Platform')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token obtained from login',
      },
      'bearerAuth', // This name must match @ApiBearerAuth('bearerAuth')
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3000, () => {
    console.log(`Server is running on port ${process.env.PORT ?? 3000}`);
  });
}
bootstrap().catch((err) => {
  console.error('Error during bootstrap:', err);
});
