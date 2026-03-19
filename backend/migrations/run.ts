import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const DUPLICATE_OBJECT_CODES = new Set(['42P07', '42710']);

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buf = '';

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let dollarTag: string | null = null; // e.g. "$$", "$tag$"

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    // Handle line comments: -- ...\n (only when not in quotes/dollar)
    if (!inSingleQuote && !inDoubleQuote && !dollarTag && ch === '-' && next === '-') {
      buf += ch;
      i++;
      buf += next;
      while (i + 1 < sql.length && sql[i + 1] !== '\n') {
        i++;
        buf += sql[i];
      }
      continue;
    }

    // Handle block comments: /* ... */ (only when not in quotes/dollar)
    if (!inSingleQuote && !inDoubleQuote && !dollarTag && ch === '/' && next === '*') {
      buf += ch;
      i++;
      buf += next;
      while (i + 1 < sql.length) {
        i++;
        buf += sql[i];
        if (sql[i - 1] === '*' && sql[i] === '/') break;
      }
      continue;
    }

    // Dollar-quoted blocks start/end: $tag$ ... $tag$
    if (!inSingleQuote && !inDoubleQuote) {
      if (!dollarTag && ch === '$') {
        let j = i + 1;
        while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) j++;
        if (sql[j] === '$') {
          const tag = sql.slice(i, j + 1); // includes both '$'
          dollarTag = tag;
          buf += tag;
          i = j;
          continue;
        }
      } else if (dollarTag && ch === '$') {
        if (sql.startsWith(dollarTag, i)) {
          buf += dollarTag;
          i += dollarTag.length - 1;
          dollarTag = null;
          continue;
        }
      }
    }

    // Toggle string / identifier quotes (ignore when inside dollar-quote)
    if (!dollarTag) {
      if (!inDoubleQuote && ch === "'" ) {
        buf += ch;
        // Handle escaped single quote '' within strings
        if (inSingleQuote && next === "'") {
          i++;
          buf += next;
          continue;
        }
        inSingleQuote = !inSingleQuote;
        continue;
      }
      if (!inSingleQuote && ch === '"') {
        buf += ch;
        inDoubleQuote = !inDoubleQuote;
        continue;
      }
    }

    // Statement delimiter: semicolon outside quotes/dollar
    if (!inSingleQuote && !inDoubleQuote && !dollarTag && ch === ';') {
      const trimmed = buf.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      buf = '';
      continue;
    }

    buf += ch;
  }

  const trailing = buf.trim();
  if (trailing.length > 0) {
    statements.push(trailing);
  }
  return statements;
}

async function runMigrations() {
  console.log('Starting database migrations...');
  
  try {
    const migrationsDir = path.join(__dirname);
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      
      const statements = splitSqlStatements(sql);
      
      for (const statement of statements) {
        try {
          await pool.query(statement);
        } catch (error: any) {
          if (DUPLICATE_OBJECT_CODES.has(error?.code)) {
            console.warn(`Skipping duplicate object in ${file}: ${error.message}`);
            continue;
          }
          throw error;
        }
      }
      
      console.log(`✓ ${file} completed`);
    }
    
    console.log('✓ All migrations completed successfully');
    await pool.end();
  } catch (error) {
    console.error('Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigrations();
