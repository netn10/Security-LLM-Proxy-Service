import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum RequestAction {
  PROXIED = 'proxied',
  BLOCKED_TIME = 'blocked_time',
  BLOCKED_FINANCIAL = 'blocked_financial',
  BLOCKED_RATE_LIMIT = 'blocked_rate_limit',
  BLOCKED_SENSITIVE_DATA = 'blocked_sensitive_data',
  SERVED_FROM_CACHE = 'served_from_cache',
}

@Entity('request_logs')
export class RequestLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp: Date;

  @Column()
  provider: string;

  @Column('text')
  anonymizedPayload: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  action: RequestAction;

  @Column({ nullable: true })
  endpoint: string;

  @Column({ nullable: true })
  responseTime?: number;

  @Column({ nullable: true })
  errorMessage?: string;
}
