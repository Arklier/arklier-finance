import { createClient } from '@supabase/supabase-js';
import { encryptSecret, generateRandomSecret } from './secrets';
import { secureLogger } from '@/lib/utils/secure-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface RotationPolicy {
  secret_type: 'api_key' | 'api_secret' | 'encryption_key' | 'jwt_secret';
  rotation_interval_days: number;
  max_age_days: number;
  auto_rotation_enabled: boolean;
  require_manual_approval: boolean;
}

export interface SecretVersion {
  id: string;
  secret_type: string;
  version_number: number;
  secret_hash: string;
  encrypted_secret: Uint8Array;
  is_active: boolean;
  created_at: string;
  expires_at?: string;
  rotated_at?: string;
  rotated_by?: string;
  metadata?: Record<string, any>;
}

export interface RotationSchedule {
  id: string;
  secret_type: string;
  next_rotation_date: string;
  last_rotation_attempt?: string;
  rotation_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  attempts_count: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize the secret rotation system with default policies and schedules
 */
export async function initializeSecretRotation(): Promise<void> {
  try {
    secureLogger.info('Initializing secret rotation system...');

    // 1. Ensure default rotation policies are in place
    await ensureDefaultPolicies();

    // 2. Initialize rotation schedules for all secret types
    await initializeRotationSchedules();

    // 3. Set up initial secrets if they don't exist
    await setupInitialSecrets();

    // 4. Verify the system is properly configured
    await verifySystemConfiguration();

    secureLogger.info('Secret rotation system initialized successfully');
  } catch (error) {
    secureLogger.error('Failed to initialize secret rotation system', { error });
    throw error;
  }
}

/**
 * Ensure default rotation policies are in place
 */
async function ensureDefaultPolicies(): Promise<void> {
  const defaultPolicies: RotationPolicy[] = [
    {
      secret_type: 'api_key',
      rotation_interval_days: 90,
      max_age_days: 365,
      auto_rotation_enabled: true,
      require_manual_approval: false,
    },
    {
      secret_type: 'api_secret',
      rotation_interval_days: 90,
      max_age_days: 365,
      auto_rotation_enabled: true,
      require_manual_approval: false,
    },
    {
      secret_type: 'encryption_key',
      rotation_interval_days: 365,
      max_age_days: 1095,
      auto_rotation_enabled: true,
      require_manual_approval: true, // Encryption keys require manual approval
    },
    {
      secret_type: 'jwt_secret',
      rotation_interval_days: 180,
      max_age_days: 730,
      auto_rotation_enabled: true,
      require_manual_approval: false,
    },
  ];

  for (const policy of defaultPolicies) {
    const { error } = await supabase
      .from('secret_rotation_policies')
      .upsert(policy, { onConflict: 'secret_type' });

    if (error) {
      secureLogger.error(`Failed to upsert policy for ${policy.secret_type}`, { error });
      throw error;
    }
  }

  secureLogger.info('Default rotation policies ensured');
}

/**
 * Initialize rotation schedules for all secret types
 */
async function initializeRotationSchedules(): Promise<void> {
  const { data: policies, error: policiesError } = await supabase
    .from('secret_rotation_policies')
    .select('secret_type, rotation_interval_days');

  if (policiesError) {
    secureLogger.error('Failed to fetch rotation policies', { error: policiesError });
    throw policiesError;
  }

  for (const policy of policies) {
    const nextRotationDate = new Date();
    nextRotationDate.setDate(nextRotationDate.getDate() + policy.rotation_interval_days);

    const schedule = {
      secret_type: policy.secret_type,
      next_rotation_date: nextRotationDate.toISOString(),
      rotation_status: 'pending' as const,
      attempts_count: 0,
      max_attempts: 3,
    };

    const { error } = await supabase
      .from('secret_rotation_schedules')
      .upsert(schedule, { onConflict: 'secret_type' });

    if (error) {
      secureLogger.error(`Failed to upsert schedule for ${policy.secret_type}`, { error });
      throw error;
    }
  }

  secureLogger.info('Rotation schedules initialized');
}

/**
 * Set up initial secrets if they don't exist
 */
async function setupInitialSecrets(): Promise<void> {
  const secretTypes = ['api_key', 'api_secret', 'encryption_key', 'jwt_secret'];

  for (const secretType of secretTypes) {
    const { data: existingSecrets, error: fetchError } = await supabase
      .from('secret_versions')
      .select('id')
      .eq('secret_type', secretType)
      .eq('is_active', true)
      .limit(1);

    if (fetchError) {
      secureLogger.error(`Failed to check existing secrets for ${secretType}`, { error: fetchError });
      throw fetchError;
    }

    // If no active secret exists, create one
    if (!existingSecrets || existingSecrets.length === 0) {
      await createInitialSecret(secretType);
    }
  }

  secureLogger.info('Initial secrets setup completed');
}

/**
 * Create an initial secret for a given type
 */
async function createInitialSecret(secretType: string): Promise<void> {
  try {
    // Generate a random secret
    const rawSecret = generateRandomSecret(32);
    
    // Encrypt the secret
    const encryptedSecret = encryptSecret(rawSecret);
    
    // Create the secret version
    const { error: insertError } = await supabase
      .from('secret_versions')
      .insert({
        secret_type: secretType,
        version_number: 1,
        secret_hash: Buffer.from(rawSecret).toString('hex'), // Simple hash for demo
        encrypted_secret: encryptedSecret,
        is_active: true,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      });

    if (insertError) {
      secureLogger.error(`Failed to create initial secret for ${secretType}`, { error: insertError });
      throw insertError;
    }

    secureLogger.info(`Created initial secret for ${secretType}`);
  } catch (error) {
    secureLogger.error(`Failed to create initial secret for ${secretType}`, { error });
    throw error;
  }
}

/**
 * Verify the system configuration is correct
 */
async function verifySystemConfiguration(): Promise<void> {
  try {
    // Check that all required tables exist and have data
    const checks = [
      checkTableData('secret_rotation_policies', 4), // Should have 4 default policies
      checkTableData('secret_rotation_schedules', 4), // Should have 4 schedules
      checkTableData('secret_versions', 4), // Should have at least 4 initial secrets
    ];

    await Promise.all(checks);
    secureLogger.info('System configuration verification completed');
  } catch (error) {
    secureLogger.error('System configuration verification failed', { error });
    throw error;
  }
}

/**
 * Check that a table has the expected number of rows
 */
async function checkTableData(tableName: string, expectedMinRows: number): Promise<void> {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to check ${tableName}: ${error.message}`);
  }

  if (count === null || count < expectedMinRows) {
    throw new Error(`Table ${tableName} has insufficient data: expected ${expectedMinRows}, got ${count}`);
  }
}

/**
 * Get the current active secret for a given type
 */
export async function getCurrentActiveSecret(secretType: string): Promise<SecretVersion | null> {
  const { data, error } = await supabase
    .from('secret_versions')
    .select('*')
    .eq('secret_type', secretType)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // No active secret found
    }
    secureLogger.error(`Failed to get active secret for ${secretType}`, { error });
    throw error;
  }

  return data;
}

/**
 * Check if rotation is needed for a secret type
 */
export async function isRotationNeeded(secretType: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('check_rotation_needed', { p_secret_type: secretType });

  if (error) {
    secureLogger.error(`Failed to check if rotation is needed for ${secretType}`, { error });
    throw error;
  }

  return data;
}

/**
 * Get all rotation schedules
 */
export async function getRotationSchedules(): Promise<RotationSchedule[]> {
  const { data, error } = await supabase
    .from('secret_rotation_schedules')
    .select('*')
    .order('next_rotation_date');

  if (error) {
    secureLogger.error('Failed to get rotation schedules', { error });
    throw error;
  }

  return data || [];
}

/**
 * Get rotation policies
 */
export async function getRotationPolicies(): Promise<RotationPolicy[]> {
  const { data, error } = await supabase
    .from('secret_rotation_policies')
    .select('*')
    .order('secret_type');

  if (error) {
    secureLogger.error('Failed to get rotation policies', { error });
    throw error;
  }

  return data || [];
}

/**
 * Manual trigger for secret rotation
 */
export async function triggerManualRotation(
  secretType: string,
  newSecret: string,
  reason?: string
): Promise<string> {
  try {
    const encryptedSecret = encryptSecret(newSecret);
    
    const { data, error } = await supabase
      .rpc('rotate_secret', {
        p_secret_type: secretType,
        p_new_encrypted_secret: encryptedSecret,
        p_rotation_method: 'manual',
        p_rotation_reason: reason || 'Manual rotation triggered',
      });

    if (error) {
      secureLogger.error(`Failed to trigger manual rotation for ${secretType}`, { error });
      throw error;
    }

    secureLogger.info(`Manual rotation completed for ${secretType}`, { newVersionId: data });
    return data;
  } catch (error) {
    secureLogger.error(`Failed to trigger manual rotation for ${secretType}`, { error });
    throw error;
  }
}
