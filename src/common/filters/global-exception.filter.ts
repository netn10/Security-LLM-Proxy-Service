import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      
      if (exceptionResponse?.error) {
        message = exceptionResponse.error.message || exception.message;
        code = exceptionResponse.error.code || 'HTTP_ERROR';
        details = exceptionResponse.error.details || null;
      } else {
        message = exception.message;
        code = 'HTTP_ERROR';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      code = 'ERROR';
    }

    // Create a graceful error response
    const errorResponse = {
      error: {
        message: this.makeMessageGraceful(message),
        code: code,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        ...(details && { details }),
      },
    };

    // Add helpful suggestions for common errors
    if (code === 'FINANCIAL_BLOCKED') {
      errorResponse.error['help'] = {
        suggestion: 'Try rephrasing your request to avoid financial terminology.',
        example: 'Instead of "help me with my bank account", try "help me organize my personal information".'
      };
    } else if (status === HttpStatus.UNAUTHORIZED) {
      errorResponse.error['help'] = {
        suggestion: 'Please check that your API keys are configured correctly in the .env file.',
        example: 'Make sure OPENAI_API_KEY and ANTHROPIC_API_KEY are set.'
      };
    } else if (status === HttpStatus.SERVICE_UNAVAILABLE) {
      errorResponse.error['help'] = {
        suggestion: 'The Lasso proxy service may be temporarily unavailable. Please try again later.',
        example: 'Check if the proxy service is running and accessible.'
      };
    }

    console.error(`❌ Error ${status} on ${request.method} ${request.url}:`, message);
    
    response.status(status).json(errorResponse);
  }

  private makeMessageGraceful(message: string): string {
    // Make error messages more user-friendly
    const gracefulMessages: Record<string, string> = {
      'Request blocked due to financial content policy': 
        'Your request contains content that appears to be related to financial services, transactions, or financial advice. For security reasons, this type of content is not allowed. Please modify your request to avoid financial topics such as banking, loans, investments, insurance, cryptocurrency, or tax-related content.',
      
      'Request blocked due to time-based policy': 
        'This request was blocked due to a time-based security policy. Please try again in a few seconds.',
      
      'Proxy request failed': 
        'The proxy service encountered an error while processing your request. Please check that your API keys are configured correctly and try again.',
      
      'Internal server error': 
        'The Lasso proxy service encountered an unexpected error. Please try again later or contact support if the problem persists.'
    };

    return gracefulMessages[message] || message;
  }
}
