#!/usr/bin/env node
/**
 * Check the actual structure of the users table in Supabase
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Client } = pg;

const client = new Client({
  host: 'aws-0-us-west-1.pooler.supabase.com',
  port: 6543, // Supabase uses port 6543 for connection pooling
  database: 'postgres',
  user: 'postgres.zoiewcelmnaasbsfcjaj',
  password: process.env.DB_PASSWORD,
});

console.log('\n🔍 Checking users table structure...\n');

try {
  await client.connect();

  // Get column information
  const result = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position;
  `);

  console.log('📋 Users table columns:');
  console.log('─'.repeat(80));
  result.rows.forEach(row => {
    console.log(`  ${row.column_name.padEnd(30)} ${row.data_type.padEnd(20)} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  });
  console.log('─'.repeat(80));
  console.log(`\nTotal columns: ${result.rows.length}\n`);

  await client.end();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
