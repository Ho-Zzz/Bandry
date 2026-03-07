#!/usr/bin/env node
/**
 * Database Migration Script
 * Adds token tracking fields to existing databases
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Find database location
const possiblePaths = [
  path.join(os.homedir(), '.bandry', 'data.db'),
  path.join(os.homedir(), 'Library', 'Application Support', 'bandry', 'data.db'),
  path.join(os.homedir(), '.config', 'bandry', 'data.db'),
];

let dbPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (!dbPath) {
  console.error('❌ Database file not found. Checked:');
  possiblePaths.forEach(p => console.error(`   - ${p}`));
  process.exit(1);
}

console.log(`📁 Found database: ${dbPath}`);

// Open database
const db = new Database(dbPath);

// Check if migration is needed
const tableInfo = db.pragma('table_info(messages)');
const hasTokenFields = tableInfo.some(col => col.name === 'total_tokens');

if (hasTokenFields) {
  console.log('✅ Database already has token fields. No migration needed.');
  db.close();
  process.exit(0);
}

console.log('🔄 Applying migration: Adding token fields...');

try {
  // Add columns
  db.exec('ALTER TABLE messages ADD COLUMN prompt_tokens INTEGER');
  db.exec('ALTER TABLE messages ADD COLUMN completion_tokens INTEGER');
  db.exec('ALTER TABLE messages ADD COLUMN total_tokens INTEGER');

  // Create index
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_tokens ON messages(total_tokens) WHERE total_tokens IS NOT NULL');

  console.log('✅ Migration completed successfully!');
  console.log('');
  console.log('Token fields added:');
  console.log('  - prompt_tokens');
  console.log('  - completion_tokens');
  console.log('  - total_tokens');

} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
