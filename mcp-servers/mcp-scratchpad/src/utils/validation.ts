// Maximum size for scratch pad content (10MB)
const MAX_CONTENT_SIZE = 10 * 1024 * 1024;

export class ContentValidator {
  /**
   * Validate the content size
   * @throws Error if content exceeds size limit
   */
  static validateSize(content: string): void {
    const size = Buffer.byteLength(content, 'utf-8');
    if (size > MAX_CONTENT_SIZE) {
      throw new Error(`Content size (${size} bytes) exceeds maximum limit (${MAX_CONTENT_SIZE} bytes)`);
    }
  }

  /**
   * Validate content is valid string
   * @throws Error if content is invalid
   */
  static validateContent(content: string): void {
    if (typeof content !== 'string') {
      throw new Error('Content must be a string');
    }

    // Check for invalid characters or encoding issues
    try {
      Buffer.from(content, 'utf-8').toString('utf-8');
    } catch {
      throw new Error('Content contains invalid UTF-8 characters');
    }
  }

  /**
   * Run all validations on content
   * @throws Error if any validation fails
   */
  static validate(content: string): void {
    this.validateContent(content);
    this.validateSize(content);
  }
}
