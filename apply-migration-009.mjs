#!/usr/bin/env node

/**
 * Apply Migration 009 - Fix Auth Triggers
 */

import { readFileSync } from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Client } = pg;

// Construct database URL
const DB_URL = `postgresql://postgres.zoiewcelmnaasbsfcjaj:${process.env.DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;

console.log('\n🔄 Applying Migration 009: Fix Auth Triggers\n');
console.log('='.repeat(60));

async function applyMigration() {
  const client = new Client({ connectionString: DB_URL });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read migration file
    const migration = readFileSync('./supabase/migrations/009_fix_auth_triggers.sql', 'utf8');

    console.log('\n📄 Migration SQL:');
    console.log('-'.repeat(60));
    console.log(migration.substring(0, 500) + '...');
    console.log('-'.repeat(60));

    // Execute migration
    console.log('\n⏳ Executing migration...');
    await client.query(migration);

    console.log('✅ Migration 009 applied successfully!');

    // Verify the trigger exists
    console.log('\n🔍 Verifying trigger...');
    const triggerCheck = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name = 'on_auth_user_created';
    `);

    if (triggerCheck.rows.length > 0) {
      console.log('✅ Trigger verified:');
      console.log(JSON.stringify(triggerCheck.rows, null, 2));
    } else {
      console.log('⚠️ Trigger not found in information_schema');
    }

    // Verify the function exists
    const functionCheck = await client.query(`
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname = 'handle_new_user';
    `);

    if (functionCheck.rows.length > 0) {
      console.log('\n✅ Function verified: handle_new_user()');
    } else {
      console.log('\n⚠️ Function not found');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration complete! New users will now get:');
    console.log('   - Profile entry');
    console.log('   - Users entry');
    console.log('   - 50 free tokens');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error);
    throw error;
  } finally {
    await client.end();
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
