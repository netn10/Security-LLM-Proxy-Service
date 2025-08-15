import { HttpException, HttpStatus } from '@nestjs/common';

export class TimeBlockedException extends HttpException {
  constructor(message?: string) {
    const defaultMessage = 'This request was blocked due to a time-based security policy. Please try again in a few seconds.';
    
    super(
      {
        error: {
          message: message || defaultMessage,
          code: 'TIME_BLOCKED',
          details: {
            reason: 'Time-based security policy',
            suggestion: 'Wait a few seconds and try again',
            blocked_seconds: [1, 2, 7, 8],
            current_time: new Date().toISOString()
          }
        }
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
