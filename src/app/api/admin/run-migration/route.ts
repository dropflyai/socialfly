import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Admin endpoint to run database migrations
 * POST /api/admin/run-migration
 */
export async function POST(request: NextRequest) {
  try {
    // Security: Check for admin secret
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.ADMIN_SECRET || 'dev-admin-secret-12345';

    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get migration number from body
    const body = await request.json();
    const { migrationNumber } = body;

    if (!migrationNumber) {
      return NextResponse.json(
        { error: 'Missing migrationNumber' },
        { status: 400 }
      );
    }

    // Read migration file
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', `${migrationNumber}_fix_auth_triggers.sql`);
    let sql: string;

    try {
      sql = readFileSync(migrationPath, 'utf8');
    } catch (err) {
      return NextResponse.json(
        { error: `Migration file not found: ${migrationNumber}` },
        { status: 404 }
      );
    }

    // Create Supabase admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log(`Running migration ${migrationNumber}...`);
    console.log(`SQL length: ${sql.length} characters`);

    // Execute SQL using pg_query
    // Note: We need to execute this as raw SQL, not via RPC
    const { data, error } = await supabase.rpc('query', { sql_query: sql });

    if (error) {
      console.error('Migration error:', error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error,
          note: 'This may require manual execution in Supabase SQL Editor'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Migration ${migrationNumber} executed successfully`,
      data
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
