import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { DataSanitizationService } from './data-sanitization.service';
import { CacheService } from './cache.service';
import { LoggingService } from './logging.service';
import { PolicyEnforcementService } from './policy-enforcement.service';
import { RequestLog } from './entities/request-log.entity';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Lasso-Security-Proxy/1.0',
      },
    }),
    TypeOrmModule.forFeature([RequestLog]),
  ],
  controllers: [ProxyController],
  providers: [
    ProxyService,
    DataSanitizationService,
    CacheService,
    LoggingService,
    PolicyEnforcementService,
  ],
})
export class ProxyModule {}
