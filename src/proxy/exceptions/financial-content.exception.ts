import { HttpException, HttpStatus } from '@nestjs/common';

export class FinancialContentException extends HttpException {
  constructor(message?: string) {
    const defaultMessage = 'Your request contains content that appears to be related to financial services, transactions, or financial advice. For security reasons, this type of content is not allowed. Please modify your request to avoid financial topics such as banking, loans, investments, insurance, cryptocurrency, or tax-related content.';
    
    super(
      {
        error: {
          message: message || defaultMessage,
          code: 'FINANCIAL_BLOCKED',
          details: {
            suggestion: 'Try rephrasing your request to avoid financial terminology or specific financial services.',
            allowed_topics: [
              'General business discussions',
              'Technology and software',
              'Creative writing and content',
              'Educational topics',
              'General analysis and research'
            ],
            blocked_topics: [
              'Personal banking transactions',
              'Loan or credit applications',
              'Investment advice or trading',
              'Insurance applications',
              'Cryptocurrency trading',
              'Tax preparation',
              'Payment processing'
            ]
          }
        }
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
