import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestLog, RequestAction } from './entities/request-log.entity';

@Injectable()
export class LoggingService {
  constructor(
    @InjectRepository(RequestLog)
    private requestLogRepository: Repository<RequestLog>,
  ) {}

  /**
   * Log request asynchronously to avoid blocking the response
   */
  async logRequest(
    provider: string,
    anonymizedPayload: any,
    action: RequestAction,
    endpoint?: string,
    responseTime?: number,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const log = this.requestLogRepository.create({
        provider,
        anonymizedPayload: JSON.stringify(anonymizedPayload),
        action,
        endpoint,
        responseTime,
        errorMessage,
      });

      // Log asynchronously to avoid blocking the response
      setImmediate(async () => {
        try {
          await this.requestLogRepository.save(log);
          console.log(`📝 Logged request: ${action} for ${provider}`);
        } catch (error) {
          console.error('❌ Logging error:', error.message);
        }
      });
    } catch (error) {
      console.error('❌ Log creation error:', error.message);
    }
  }

  /**
   * Get recent logs for monitoring
   */
  async getRecentLogs(limit: number = 50): Promise<RequestLog[]> {
    return this.requestLogRepository.find({
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get logs by action type
   */
  async getLogsByAction(action: RequestAction, limit: number = 50): Promise<RequestLog[]> {
    return this.requestLogRepository.find({
      where: { action },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get statistics for monitoring
   */
  async getStatistics(): Promise<{
    total: number;
    byAction: Record<RequestAction, number>;
    byProvider: Record<string, number>;
  }> {
    const total = await this.requestLogRepository.count();
    
    const byAction = {} as Record<RequestAction, number>;
    const byProvider = {} as Record<string, number>;

    // Get counts by action
    for (const action of Object.values(RequestAction)) {
      byAction[action] = await this.requestLogRepository.count({ where: { action } });
    }

    // Get counts by provider
    const providerStats = await this.requestLogRepository
      .createQueryBuilder('log')
      .select('log.provider')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.provider')
      .getRawMany();

    providerStats.forEach(stat => {
      byProvider[stat.log_provider] = parseInt(stat.count);
    });

    return { total, byAction, byProvider };
  }
}
