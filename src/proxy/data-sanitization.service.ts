import { Injectable } from '@nestjs/common';

@Injectable()
export class DataSanitizationService {
  // Regular expressions for different data types
  private readonly patterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    iban: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b/g,
  };

  // Placeholder mappings
  private readonly placeholders = {
    email: 'EMAIL_PH',
    ipv4: 'IP_ADDRESS_PH',
    iban: 'IBAN_PH',
  };

  /**
   * Phase 2: Sanitize sensitive data in request payload
   */
  sanitizeData(data: any): any {
    if (!data) {
      return data;
    }

    // Deep clone the data to avoid mutating the original
    const sanitizedData = JSON.parse(JSON.stringify(data));

    // Recursively sanitize the data
    return this.sanitizeRecursive(sanitizedData);
  }

  /**
   * Recursively sanitize data structures
   */
  private sanitizeRecursive(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeRecursive(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeRecursive(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Sanitize a string by replacing sensitive data with placeholders
   */
  private sanitizeString(text: string): string {
    let sanitized = text;

    // Apply all sanitization patterns
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const placeholder = this.placeholders[type as keyof typeof this.placeholders];
      sanitized = sanitized.replace(pattern, placeholder);
    }

    return sanitized;
  }

  /**
   * Bonus: Add a new pattern for sanitization
   * This method allows for easy extension of sanitization patterns
   */
  addPattern(name: string, pattern: RegExp, placeholder: string): void {
    this.patterns[name] = pattern;
    this.placeholders[name] = placeholder;
  }

  /**
   * Get statistics about sanitization performed
   */
  getSanitizationStats(originalData: any, sanitizedData: any): {
    emailsFound: number;
    ipAddressesFound: number;
    ibansFound: number;
    totalSanitized: number;
  } {
    const originalText = JSON.stringify(originalData);
    const sanitizedText = JSON.stringify(sanitizedData);

    const emailsFound = (originalText.match(this.patterns.email) || []).length;
    const ipAddressesFound = (originalText.match(this.patterns.ipv4) || []).length;
    const ibansFound = (originalText.match(this.patterns.iban) || []).length;

    return {
      emailsFound,
      ipAddressesFound,
      ibansFound,
      totalSanitized: emailsFound + ipAddressesFound + ibansFound,
    };
  }
}
