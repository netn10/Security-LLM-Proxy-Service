import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get('DATABASE_URL');
        
        if (databaseUrl) {
          // Heroku Postgres configuration
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: false, // Don't auto-create tables in production
            logging: false,
            ssl: { rejectUnauthorized: false },
            extra: {
              connectionLimit: 10,
            },
          };
        } else {
          // Local development configuration
          return {
            type: 'postgres',
            host: configService.get('DB_HOST', 'localhost'),
            port: configService.get('DB_PORT', 5432),
            username: configService.get('DB_USERNAME', 'lasso_user'),
            password: configService.get('DB_PASSWORD', 'lasso_password'),
            database: configService.get('DB_DATABASE', 'lasso_proxy'),
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: configService.get('NODE_ENV') !== 'production',
            logging: configService.get('NODE_ENV') === 'development',
            ssl: false,
            extra: {
              connectionLimit: configService.get('DB_CONNECTION_LIMIT', 10),
              acquireTimeout: configService.get('DB_ACQUIRE_TIMEOUT', 60000),
              timeout: configService.get('DB_TIMEOUT', 60000),
            },
            retryAttempts: configService.get('DB_RETRY_ATTEMPTS', 3),
            retryDelay: configService.get('DB_RETRY_DELAY', 3000),
          };
        }
      },
      inject: [ConfigService],
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes default
    }),
    ProxyModule,
  ],
})
export class AppModule {}
