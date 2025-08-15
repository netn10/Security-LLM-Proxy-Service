import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
  });
  
  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  // Enable global exception filter for graceful error handling
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Enable CORS for client applications and WebSocket connections
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  const preferredPort = Number(process.env.PORT) || 3000;
  const maxAttempts = 10;

  let boundPort = preferredPort;
  let started = false;
  let attemptIndex = 0;

  while (!started && attemptIndex < maxAttempts) {
    try {
      boundPort = preferredPort + attemptIndex;
      await app.listen(boundPort);
      if (attemptIndex > 0) {
        // eslint-disable-next-line no-console
        console.warn(`Port ${preferredPort} in use; started on ${boundPort} instead`);
      }
      started = true;
    } catch (error: any) {
      if (error && (error.code === 'EADDRINUSE' || String(error?.message || '').includes('EADDRINUSE'))) {
        attemptIndex += 1;
        continue;
      }
      throw error;
    }
  }

  if (!started) {
    throw new Error(`Unable to bind to any port in range ${preferredPort}-${preferredPort + maxAttempts - 1}`);
  }

  console.log(`🚀 Lasso Security LLM Proxy Service running on port ${boundPort}`);
  console.log(`📋 OpenAI endpoint: http://localhost:${boundPort}/openai/*path`);
  console.log(`📋 Anthropic endpoint: http://localhost:${boundPort}/anthropic/*path`);
  console.log(`📊 Real-time Dashboard: http://localhost:${boundPort}/dashboard`);
  console.log(`📈 Health check: http://localhost:${boundPort}/health`);
  console.log(`📊 Statistics: http://localhost:${boundPort}/stats`);
  console.log(`📝 Logs: http://localhost:${boundPort}/logs`);
}

bootstrap();
