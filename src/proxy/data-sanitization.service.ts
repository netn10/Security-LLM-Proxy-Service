import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { SensitiveDataException } from './exceptions/sensitive-data.exception';

@Injectable()
export class DataSanitizationService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  // Placeholder mappings
  private readonly placeholders = {
    email: 'EMAIL_PH',
    ipv4: 'IP_ADDRESS_PH',
    iban: 'IBAN_PH',
  };

  /**
   * Phase 2: Sanitize sensitive data in request payload using LLM-based detection
   */
  async sanitizeData(data: any): Promise<any> {
    if (!data) {
      return data;
    }

    // Deep clone the data to avoid mutating the original
    const sanitizedData = JSON.parse(JSON.stringify(data));

    // Recursively sanitize the data
    return await this.sanitizeRecursive(sanitizedData);
  }

  /**
   * Recursively sanitize data structures
   */
  private async sanitizeRecursive(obj: any): Promise<any> {
    if (typeof obj === 'string') {
      return await this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      const sanitizedArray = [];
      for (const item of obj) {
        sanitizedArray.push(await this.sanitizeRecursive(item));
      }
      return sanitizedArray;
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = await this.sanitizeRecursive(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Sanitize a string by using LLM to detect and replace sensitive data with placeholders
   */
  private async sanitizeString(text: string): Promise<string> {
    if (!text || text.length === 0) {
      return text;
    }

    try {
      // Use LLM to detect sensitive data
      const detectedData = await this.detectSensitiveData(text);
      
      // Check if any sensitive data was detected
      const detectedTypes: string[] = [];
      for (const [type, matches] of Object.entries(detectedData)) {
        if (matches.length > 0) {
          detectedTypes.push(type);
        }
      }

      // If sensitive data is detected, throw an exception
      if (detectedTypes.length > 0) {
        throw new SensitiveDataException(detectedTypes);
      }

      // If no sensitive data detected, return the original text
      return text;
    } catch (error) {
      if (error instanceof SensitiveDataException) {
        throw error; // Re-throw our custom exception
      }
      
      console.error('❌ LLM-based sanitization failed:', error.message);
      // Fallback: return original text if LLM detection fails
      return text;
    }
  }

  /**
   * Use LLM to detect sensitive data in text
   */
  private async detectSensitiveData(text: string): Promise<{
    email: string[];
    ipv4: string[];
    iban: string[];
  }> {
    const prompt = `
You are a sensitive data detector. Analyze the following text and extract any sensitive information.

Detect and return ONLY the following types of data:
1. Email addresses (e.g., user@domain.com)
2. IPv4 addresses (e.g., 192.168.1.1)
3. IBAN numbers (e.g., DE89370400440532013000)

Return your response as a JSON object with these exact keys:
{
  "email": ["email1@domain.com", "email2@domain.com"],
  "ipv4": ["192.168.1.1", "10.0.0.1"],
  "iban": ["DE89370400440532013000", "GB82WEST12345698765432"]
}

If no sensitive data is found, return empty arrays:
{
  "email": [],
  "ipv4": [],
  "iban": []
}

Text to analyze:
${text.substring(0, 2000)} // Limit to first 2000 chars for efficiency
`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.configService.get('OPENAI_API_URL')}/v1/chat/completions`,
          {
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: 500,
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
      
      if (!result) {
        return { email: [], ipv4: [], iban: [] };
      }

      // Parse the JSON response
      try {
        const detected = JSON.parse(result);
        return {
          email: Array.isArray(detected.email) ? detected.email : [],
          ipv4: Array.isArray(detected.ipv4) ? detected.ipv4 : [],
          iban: Array.isArray(detected.iban) ? detected.iban : [],
        };
      } catch (parseError) {
        console.error('❌ Failed to parse LLM response:', parseError);
        return { email: [], ipv4: [], iban: [] };
      }
    } catch (error) {
      console.error('❌ LLM detection failed:', error.message);
      return { email: [], ipv4: [], iban: [] };
    }
  }

  /**
   * Add a new sensitive data type for LLM-based detection
   * This method allows for easy extension of detection types
   */
  addDetectionType(name: string, placeholder: string): void {
    this.placeholders[name] = placeholder;
  }

  /**
   * Get statistics about sanitization performed
   * Note: This is now approximate since we don't have exact counts from LLM
   */
  getSanitizationStats(originalData: any, sanitizedData: any): {
    emailsFound: number;
    ipAddressesFound: number;
    ibansFound: number;
    totalSanitized: number;
  } {
    const originalText = JSON.stringify(originalData);
    const sanitizedText = JSON.stringify(sanitizedData);

    // Count placeholders in sanitized text
    const emailsFound = (sanitizedText.match(/EMAIL_PH/g) || []).length;
    const ipAddressesFound = (sanitizedText.match(/IP_ADDRESS_PH/g) || []).length;
    const ibansFound = (sanitizedText.match(/IBAN_PH/g) || []).length;

    return {
      emailsFound,
      ipAddressesFound,
      ibansFound,
      totalSanitized: emailsFound + ipAddressesFound + ibansFound,
    };
  }
}

