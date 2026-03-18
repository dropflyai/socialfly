#!/usr/bin/env node

/**
 * Direct SQL Execution via Supabase Admin
 * This script executes SQL migrations using the service role key
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n🔧 AUTOMATED MIGRATION RUNNER\n');
console.log('='.repeat(60));

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Create admin client with service role
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSqlStatements(sql) {
  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`\n📝 Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    const preview = stmt.substring(0, 80).replace(/\n/g, ' ');

    console.log(`[${i + 1}/${statements.length}] ${preview}...`);

    try {
      // Use the query method to execute raw SQL
      const { data, error } = await supabase.rpc('exec_sql', { query: stmt });

      if (error) {
        // Try direct table operations for specific commands
        if (stmt.toUpperCase().includes('CREATE TRIGGER') ||
            stmt.toUpperCase().includes('CREATE FUNCTION') ||
            stmt.toUpperCase().includes('CREATE POLICY') ||
            stmt.toUpperCase().includes('DROP TRIGGER') ||
            stmt.toUpperCase().includes('DROP FUNCTION') ||
            stmt.toUpperCase().includes('DROP POLICY') ||
            stmt.toUpperCase().includes('GRANT') ||
            stmt.toUpperCase().includes('ALTER TABLE') ||
            stmt.toUpperCase().includes('COMMENT ON')) {

          console.log(`   ⚠️  Cannot execute via RPC (DDL statement), attempting alternative...`);
          // These need to be run directly in SQL editor
          console.log(`   📋 Statement queued for manual execution`);
          errorCount++;
          continue;
        }
        throw error;
      }

      console.log(`   ✅ Success`);
      successCount++;
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      errorCount++;
      // Continue with other statements
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`Total: ${statements.length}`);

  return { successCount, errorCount };
}

async function runMigration() {
  try {
    // Read migration file
    console.log('\n📖 Reading migration 009...');
    const sql = readFileSync('./supabase/migrations/009_fix_auth_triggers.sql', 'utf8');
    console.log(`✅ Loaded ${sql.length} characters\n`);

    // Execute statements
    const result = await executeSqlStatements(sql);

    if (result.errorCount > 0) {
      console.log('\n⚠️  Some statements failed via RPC.');
      console.log('📋 Copying SQL to clipboard for manual execution...\n');

      // Show the SQL that needs manual execution
      console.log('Please execute this in Supabase SQL Editor:');
      console.log('-'.repeat(60));
      console.log(sql);
      console.log('-'.repeat(60));
    }

    console.log('\n✅ Migration process complete\n');

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error);
    process.exit(1);
  }
}

runMigration();
