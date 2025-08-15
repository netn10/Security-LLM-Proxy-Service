import { HttpException, HttpStatus } from '@nestjs/common';

export class RateLimitedException extends HttpException {
  constructor(message: string = 'Rate limit exceeded') {
    super(
      {
        error: 'Rate Limited',
        message,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
