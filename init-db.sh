#!/bin/bash
# Database initialization script

echo "Initializing Telosa P4P Database..."

# First, let's find the actual database file
DB_DIR="/home/user/webapp/.wrangler/state/v3/d1/miniflare-D1DatabaseObject"

# Wait for the wrangler server to create the database
sleep 2

# Find the SQLite database file
DB_FILE=$(find $DB_DIR -name "*.sqlite" | head -1)

if [ -z "$DB_FILE" ]; then
  echo "Database file not found. Creating..."
  # The database will be created when first accessed through the API
  echo "Database will be auto-created on first API call."
else
  echo "Found database: $DB_FILE"
  
  # Apply schema
  echo "Applying schema..."
  sqlite3 "$DB_FILE" < /home/user/webapp/migrations/0001_initial_schema.sql
  
  # Seed data
  echo "Seeding data..."
  sqlite3 "$DB_FILE" < /home/user/webapp/seed.sql
  
  echo "Database initialized successfully!"
fi
