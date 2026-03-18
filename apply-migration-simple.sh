#!/bin/bash

# Simple migration runner using psql
# Load environment variables
source .env.local

# Supabase connection details
HOST="aws-0-us-west-1.pooler.supabase.com"
PORT="5432"
DB="postgres"
USER="postgres.zoiewcelmnaasbsfcjaj"

echo "🔧 Running Migration 009: Fix Auth Triggers"
echo "============================================================"

# Run the migration
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$HOST" \
  -p "$PORT" \
  -U "$USER" \
  -d "$DB" \
  -f "./supabase/migrations/009_fix_auth_triggers.sql" \
  -v ON_ERROR_STOP=1

if [ $? -eq 0 ]; then
  echo "============================================================"
  echo "✅ Migration 009 completed successfully!"
  echo ""
  echo "New users will now receive:"
  echo "  • Profile entry"
  echo "  • Users entry"
  echo "  • 50 free tokens"
  echo "  • 100 daily token limit"
  echo "============================================================"
else
  echo "❌ Migration failed. Check errors above."
  exit 1
fi
