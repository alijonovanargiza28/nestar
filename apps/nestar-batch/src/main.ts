import { NestFactory } from '@nestjs/core';
import { NestarBatchModule } from './nestar-batch.module';
import { ValidationPipe } from '@nestjs/common';
import { LoggingInterceptor } from 'apps/nestar-api/src/libs/enums/intersepter/loggingIntercepter';

async function bootstrap() {
  const app = await NestFactory.create(NestarBatchModule);
  app.useGlobalPipes(new ValidationPipe())
  app.useGlobalInterceptors(new LoggingInterceptor())
  await app.listen(process.env.PORT_BATCH ?? 3009);
    console.log("PORT_BATCH:", process.env.PORT_BATCH);
}
bootstrap();
