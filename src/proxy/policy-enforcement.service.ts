import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PolicyEnforcementService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Phase 5: Check if request contains financial content using LLM classification
   */
  async checkFinancialContent(content: string): Promise<boolean> {
    try {
      // Use OpenAI for classification (lightweight model for speed)
      const classificationPrompt = `
You are a content classifier. Determine if the following text is specifically about financial services, transactions, or financial advice.

ONLY classify as FINANCIAL if the text is explicitly about:
- Personal banking transactions (deposits, withdrawals, transfers)
- Loan applications, mortgage applications, credit applications
- Investment advice, stock trading, portfolio management
- Insurance claims or policy applications
- Cryptocurrency trading or investment
- Tax preparation or filing
- Payment processing or financial transactions
- Financial planning or budgeting services

DO NOT classify as FINANCIAL if the text:
- Mentions money in general conversation
- Discusses business topics without financial transactions
- Contains general economic discussions
- Mentions prices or costs without financial services
- Is about general business operations

Respond with ONLY "FINANCIAL" or "NON_FINANCIAL".

Text to classify:
${content.substring(0, 1000)} // Limit to first 1000 chars for efficiency
`;

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.configService.get('OPENAI_API_URL')}/v1/chat/completions`,
          {
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'user',
                content: classificationPrompt,
              },
            ],
            max_tokens: 10,
            temperature: 0,
          },
          {
            headers: {
              'Authorization': `Bearer ${this.configService.get('OPENAI_API_KEY')}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const result = response.data.choices[0]?.message?.content?.trim();
      
      // Only block if we get a clear "FINANCIAL" response
      // This reduces false positives by being more conservative
      const isFinancial = result === 'FINANCIAL';
      
      // In strict mode, require additional confirmation for borderline cases
      const strictMode = this.configService.get<boolean>('FINANCIAL_DETECTION_STRICT', true);
      
      if (isFinancial) {
        console.log(`🔒 Financial content detected: "${content.substring(0, 100)}..."`);
        
        // In strict mode, double-check with a more specific prompt for borderline cases
        if (strictMode && this.isBorderlineCase(content)) {
          console.log('🔍 Borderline case detected, performing additional verification...');
          const confirmed = await this.verifyFinancialContent(content);
          if (!confirmed) {
            console.log('✅ Borderline case verified as non-financial, allowing');
            return false;
          }
        }
      }
      
      return isFinancial;
    } catch (error) {
      console.error('❌ Financial content check error:', error.message);
      // If classification fails, allow the request to proceed (fail-safe)
      return false;
    }
  }

  /**
   * Extract content from request body for classification
   */
  extractContentForClassification(body: any): string {
    if (!body) return '';

    // Extract content from common LLM request formats
    if (body.messages && Array.isArray(body.messages)) {
      // OpenAI/Anthropic format
      return body.messages
        .map((msg: any) => msg.content || '')
        .join(' ');
    }

    if (body.prompt) {
      // OpenAI completion format
      return body.prompt;
    }

    if (body.input) {
      // Generic input format
      return body.input;
    }

    // Fallback: stringify the entire body
    return JSON.stringify(body);
  }

  /**
   * Check if request should be blocked based on financial content
   */
  async shouldBlockFinancialContent(body: any): Promise<boolean> {
    const content = this.extractContentForClassification(body);
    const trimmedContent = content.trim();
    
    // Don't block if content is too short (likely not meaningful)
    if (!trimmedContent || trimmedContent.length < 10) {
      return false; // Too short, allow
    }

    // Check if financial content detection is enabled
    const policyEnabled = this.configService.get<boolean>('ENABLE_POLICY_ENFORCEMENT', true);
    if (!policyEnabled) {
      return false; // Policy enforcement disabled, allow
    }

    // Additional conservative check: don't block if content is very long (likely complex)
    if (trimmedContent.length > 2000) {
      console.log('📝 Content too long for financial classification, allowing');
      return false; // Too long, allow to avoid false positives
    }

    return await this.checkFinancialContent(trimmedContent);
  }

  /**
   * Check if content might be a borderline case that needs additional verification
   */
  private isBorderlineCase(content: string): boolean {
    const lowerContent = content.toLowerCase();
    
    // Keywords that might indicate borderline cases
    const borderlineKeywords = [
      'money', 'cost', 'price', 'expensive', 'cheap', 'budget',
      'business', 'company', 'startup', 'entrepreneur',
      'economy', 'economic', 'market', 'industry'
    ];
    
    // Check if content contains borderline keywords but not clear financial service keywords
    const hasBorderlineKeywords = borderlineKeywords.some(keyword => 
      lowerContent.includes(keyword)
    );
    
    const clearFinancialKeywords = [
      'loan', 'mortgage', 'credit', 'investment', 'stock', 'bond',
      'insurance', 'banking', 'cryptocurrency', 'tax', 'payment',
      'transaction', 'portfolio', 'trading'
    ];
    
    const hasClearFinancialKeywords = clearFinancialKeywords.some(keyword => 
      lowerContent.includes(keyword)
    );
    
    return hasBorderlineKeywords && !hasClearFinancialKeywords;
  }

  /**
   * Additional verification for borderline cases using a more specific prompt
   */
  private async verifyFinancialContent(content: string): Promise<boolean> {
    try {
      const verificationPrompt = `
You are a financial content classifier. This content was flagged as potentially financial but may be a false positive.

ONLY classify as FINANCIAL if the content explicitly requests or discusses:
- Personal financial transactions (banking, payments, transfers)
- Financial services (loans, mortgages, credit applications)
- Investment advice or trading
- Insurance applications or claims
- Tax preparation or filing
- Cryptocurrency trading

If the content just mentions money, costs, business, or economics in general terms, classify as NON_FINANCIAL.

Respond with ONLY "FINANCIAL" or "NON_FINANCIAL".

Content to verify:
${content.substring(0, 500)}
`;

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.configService.get('OPENAI_API_URL')}/v1/chat/completions`,
          {
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'user',
                content: verificationPrompt,
              },
            ],
            max_tokens: 10,
            temperature: 0,
          },
          {
            headers: {
              'Authorization': `Bearer ${this.configService.get('OPENAI_API_KEY')}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const result = response.data.choices[0]?.message?.content?.trim();
      return result === 'FINANCIAL';
    } catch (error) {
      console.error('❌ Financial content verification error:', error.message);
      // If verification fails, allow the request (fail-safe)
      return false;
    }
  }
}
