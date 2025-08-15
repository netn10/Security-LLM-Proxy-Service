import { HttpException, HttpStatus } from '@nestjs/common';

export class SensitiveDataException extends HttpException {
  constructor(detectedTypes: string[], message?: string) {
    const defaultMessage = `Your request contains sensitive data that is not allowed: ${detectedTypes.join(', ')}. For security reasons, this type of content is blocked. Please remove any sensitive information such as email addresses, IBAN numbers, IP addresses, or other personal identifiers from your request.`;
    
    super(
      {
        error: {
          message: message || defaultMessage,
          code: 'SENSITIVE_DATA_BLOCKED',
          details: {
            detected_types: detectedTypes,
            suggestion: 'Remove all sensitive data from your request before resubmitting.',
            blocked_data_types: [
              'Email addresses',
              'IBAN numbers',
              'IP addresses',
              'Credit card numbers',
              'Social security numbers',
              'Phone numbers',
              'Personal identifiers'
            ],
            allowed_content: [
              'General text and content',
              'Non-personal information',
              'Public data',
              'Anonymized content'
            ]
          }
        }
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
