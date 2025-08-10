#!/usr/bin/env node

/**
 * Script to generate required secrets for the secret rotation system
 * Run this script to generate the SECRETS_ENC_KEY and other required values
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
config({ path: '.env.local' });

import crypto from 'crypto';

console.log('🔐 Generating secrets for Arklier Finance Secret Rotation System\n');

// Generate SECRETS_ENC_KEY (64-character hex string)
const secretsEncKey: string = crypto.randomBytes(32).toString('hex');
console.log('✅ SECRETS_ENC_KEY generated:');
console.log(secretsEncKey);
console.log();

// Generate a sample JWT secret
const jwtSecret: string = crypto.randomBytes(32).toString('base64');
console.log('✅ Sample JWT_SECRET generated:');
console.log(jwtSecret);
console.log();

// Generate a sample API key
const apiKey: string = crypto.randomBytes(24).toString('base64');
console.log('✅ Sample API_KEY generated:');
console.log(apiKey);
console.log();

// Generate a sample API secret
const apiSecret: string = crypto.randomBytes(32).toString('base64');
console.log('✅ Sample API_SECRET generated:');
console.log(apiSecret);
console.log();

console.log('📝 Next steps:');
console.log('1. Copy the SECRETS_ENC_KEY to your .env.local file');
console.log('2. Add your actual Supabase credentials to .env.local');
console.log('3. Run: pnpm run rotation:env-check to verify setup');
console.log('4. Run: pnpm run rotation:test to run basic tests');
console.log('5. Run: pnpm run rotation:init to initialize the system');
console.log();

console.log('📋 .env.local template:');
console.log('NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here');
console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here');
console.log(`SECRETS_ENC_KEY=${secretsEncKey}`);
console.log('JWT_SECRET=your_jwt_secret_here');
console.log('API_KEY=your_api_key_here');
console.log('API_SECRET=your_api_secret_here');
