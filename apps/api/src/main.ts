import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { readEnv } from './env';

async function bootstrap(): Promise<void> {
  const env = readEnv();
  const prod = env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      json: prod,
      logLevels: prod ? ['log', 'warn', 'error'] : ['log', 'warn', 'error', 'debug'],
    }),
  });
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(env.PORT);
  new Logger('Bootstrap').log(`API listening on port ${env.PORT}`);
}

bootstrap().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : 'Startup failed');
  process.exit(1);
});
