/**
 * Secure logging utility that prevents secrets from being logged
 * and provides audit trails for security-sensitive operations
 */

export interface AuditLogEntry {
  timestamp: string
  userId?: string
  action: string
  resource?: string
  success: boolean
  error?: string
  metadata?: Record<string, any>
}

export interface SecureLogOptions {
  includeTimestamp?: boolean
  includeUserId?: boolean
  logLevel?: 'info' | 'warn' | 'error' | 'audit'
}

class SecureLogger {
  private static instance: SecureLogger
  private auditLog: AuditLogEntry[] = []
  private readonly MAX_AUDIT_LOG_SIZE = 1000

  private constructor() {}

  static getInstance(): SecureLogger {
    if (!SecureLogger.instance) {
      SecureLogger.instance = new SecureLogger()
    }
    return SecureLogger.instance
  }

  /**
   * Enhanced secret detection patterns
   * @param input - String that might contain secrets
   * @returns Sanitized string safe for logging
   */
  private sanitizeInput(input: string): string {
    if (!input) return input
    
    // Enhanced secret patterns - more comprehensive coverage
    const patterns = [
      // API keys and secrets
      /(api[_-]?key|secret|password|token|auth|credential)[\s]*[=:]\s*['"]?[^'"\s]+['"]?/gi,
      
      // Long hex strings (potential hashes/keys)
      /[a-f0-9]{32,}/gi,
      
      // Stripe-like keys
      /(sk_|pk_|rk_)[a-zA-Z0-9]{20,}/gi,
      
      // Supabase keys
      /(eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)/g,
      
      // JWT tokens
      /(eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)/g,
      
      // Private keys (PEM format)
      /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
      
      // SSH private keys
      /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----[\s\S]*?-----END\s+OPENSSH\s+PRIVATE\s+KEY-----/gi,
      
      // Database connection strings
      /(postgresql?|mysql|mongodb):\/\/[^:\s]+:[^@\s]+@[^\s]+/gi,
      
      // AWS keys
      /(AKIA|ASIA)[A-Z0-9]{16}/gi,
      
      // Generic secret patterns
      /(key|secret|password|token|auth)[\s]*[=:]\s*['"]?[^'"\s]{8,}['"]?/gi,
    ]
    
    let sanitized = input
    patterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '$1=***REDACTED***')
    })
    
    return sanitized
  }

  /**
   * Deep sanitize objects and arrays
   * @param obj - Object or array to sanitize
   * @returns Sanitized object/array
   */
  private deepSanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj
    
    if (typeof obj === 'string') {
      return this.sanitizeInput(obj)
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSanitize(item))
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(obj)) {
        // Skip sensitive keys entirely
        if (this.isSensitiveKey(key)) {
          sanitized[key] = '***REDACTED***'
        } else {
          sanitized[key] = this.deepSanitize(value)
        }
      }
      return sanitized
    }
    
    return obj
  }

  /**
   * Check if a key name suggests sensitive data
   * @param key - Object key name
   * @returns true if key suggests sensitive data
   */
  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /(api[_-]?)?key/i,
      /(api[_-]?)?secret/i,
      /password/i,
      /token/i,
      /auth/i,
      /credential/i,
      /private/i,
      /signature/i,
      /hmac/i,
      /encrypted/i,
      /cipher/i,
    ]
    
    return sensitivePatterns.some(pattern => pattern.test(key))
  }

  /**
   * Log information without exposing secrets
   * @param message - Message to log
   * @param data - Optional data (will be sanitized)
   * @param options - Logging options
   */
  info(message: string, data?: any, options: SecureLogOptions = {}): void {
    const sanitizedData = data ? this.deepSanitize(data) : undefined
    console.log(`[INFO] ${message}`, sanitizedData || '')
  }

  /**
   * Log warnings without exposing secrets
   * @param message - Warning message
   * @param data - Optional data (will be sanitized)
   * @param options - Logging options
   */
  warn(message: string, data?: any, options: SecureLogOptions = {}): void {
    const sanitizedData = data ? this.deepSanitize(data) : undefined
    console.warn(`[WARN] ${message}`, sanitizedData || '')
  }

  /**
   * Log errors without exposing secrets
   * @param message - Error message
   * @param error - Error object (will be sanitized)
   * @param options - Logging options
   */
  error(message: string, error?: any, options: SecureLogOptions = {}): void {
    let sanitizedError = 'Unknown error'
    
    if (error) {
      if (error instanceof Error) {
        sanitizedError = this.sanitizeInput(error.message)
      } else if (typeof error === 'string') {
        sanitizedError = this.sanitizeInput(error)
      } else {
        sanitizedError = this.deepSanitize(error)
      }
    }
    
    console.error(`[ERROR] ${message}:`, sanitizedError)
  }

  /**
   * Log security audit events
   * @param entry - Audit log entry
   */
  audit(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    }
    
    // Add to audit log
    this.auditLog.push(auditEntry)
    
    // Maintain log size
    if (this.auditLog.length > this.MAX_AUDIT_LOG_SIZE) {
      this.auditLog = this.auditLog.slice(-this.MAX_AUDIT_LOG_SIZE)
    }
    
    // Log to console (sanitized)
    const sanitizedEntry = this.deepSanitize(auditEntry)
    
    console.log(`[AUDIT] ${entry.action} - ${entry.success ? 'SUCCESS' : 'FAILURE'}`, sanitizedEntry)
  }

  /**
   * Get audit log entries (for monitoring/analysis)
   * @returns Copy of audit log
   */
  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog]
  }

  /**
   * Clear audit log (use with caution)
   */
  clearAuditLog(): void {
    this.auditLog = []
  }

  /**
   * Log database operations securely
   * @param operation - Database operation type
   * @param table - Table name
   * @param userId - User ID if applicable
   * @param success - Whether operation succeeded
   * @param error - Error details if failed
   */
  logDatabaseOperation(
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
    table: string,
    userId?: string,
    success: boolean = true,
    error?: string
  ): void {
    this.audit({
      action: `DB_${operation}`,
      resource: table,
      userId,
      success,
      error: error ? this.sanitizeInput(error) : undefined,
      metadata: { operation, table }
    })
  }

  /**
   * Log API operations securely
   * @param endpoint - API endpoint
   * @param method - HTTP method
   * @param userId - User ID if applicable
   * @param success - Whether operation succeeded
   * @param error - Error details if failed
   */
  logApiOperation(
    endpoint: string,
    method: string,
    userId?: string,
    success: boolean = true,
    error?: string
  ): void {
    this.audit({
      action: `API_${method}`,
      resource: endpoint,
      userId,
      success,
      error: error ? this.sanitizeInput(error) : undefined,
      metadata: { endpoint, method }
    })
  }

  /**
   * Log security events
   * @param event - Security event type
   * @param details - Event details (will be sanitized)
   * @param userId - User ID if applicable
   */
  logSecurityEvent(
    event: string,
    details?: any,
    userId?: string
  ): void {
    this.audit({
      action: `SECURITY_${event}`,
      userId,
      success: true,
      metadata: this.deepSanitize(details)
    })
  }

  /**
   * Log authentication events
   * @param event - Authentication event type
   * @param userId - User ID if applicable
   * @param success - Whether authentication succeeded
   * @param metadata - Additional metadata
   */
  logAuthEvent(
    event: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'PASSWORD_CHANGE' | 'MFA_ENABLED' | 'MFA_DISABLED',
    userId?: string,
    success: boolean = true,
    metadata?: Record<string, any>
  ): void {
    this.audit({
      action: `AUTH_${event}`,
      userId,
      success,
      metadata: this.deepSanitize(metadata)
    })
  }
}

// Export singleton instance
export const secureLogger = SecureLogger.getInstance()

// Export types for external use
export type { AuditLogEntry, SecureLogOptions }
