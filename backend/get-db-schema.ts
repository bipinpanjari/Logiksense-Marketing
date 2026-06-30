import { Client } from 'pg';
import { Prisma } from '@prisma/client';

const pgliteUrl = "postgresql://postgres:postgres@127.0.0.1:54321/logiksense_marketing?schema=public&sslmode=disable";

async function main() {
  const pgClient = new Client({
    connectionString: pgliteUrl,
  });
  
  await pgClient.connect();
  console.log("Connected successfully to PGlite.");

  // Get Prisma models from DMMF
  const models = (Prisma as any).dmmf.datamodel.models;
  
  for (const model of models) {
    const tableName = model.dbName || model.name.toLowerCase();
    
    // Simple check of mapped or plural name
    let tableExists = false;
    let actualTableName = tableName;
    
    const possibleNames = [tableName, model.name.toLowerCase(), model.name.toLowerCase() + 's'];
    for (const name of possibleNames) {
      const res = await pgClient.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1 AND table_schema = 'public')",
        [name]
      );
      if (res.rows[0].exists) {
        tableExists = true;
        actualTableName = name;
        break;
      }
    }

    if (!tableExists) {
      console.log(`\n[MISSING TABLE] ${model.name} -> Table name: "${tableName}"`);
      // Print CREATE TABLE statement
      // We can generate standard columns
      const colStatements: string[] = [];
      for (const field of model.fields) {
        if (field.kind !== 'scalar') continue;
        const colName = field.dbName || field.name.replace(/([A-Z])/g, "_$1").toLowerCase();
        let sqlType = '';
        if (field.isId) {
          sqlType = 'UUID PRIMARY KEY DEFAULT gen_random_uuid()';
        } else {
          if (field.type === 'String') sqlType = 'VARCHAR(255)';
          else if (field.type === 'Int') sqlType = 'INTEGER';
          else if (field.type === 'Boolean') sqlType = 'BOOLEAN NOT NULL DEFAULT false';
          else if (field.type === 'DateTime') sqlType = 'TIMESTAMP(6)';
          else if (field.type === 'Json') sqlType = 'JSONB';
          else sqlType = 'TEXT';
          
          if (field.isRequired && field.type !== 'Boolean') {
            sqlType += ' NOT NULL';
          }
        }
        colStatements.push(`  "${colName}" ${sqlType}`);
      }
      console.log(`CREATE TABLE "${tableName}" (\n${colStatements.join(',\n')}\n);`);
      continue;
    }

    // Get current columns in PGlite
    const dbColsRes = await pgClient.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'",
      [actualTableName]
    );
    const dbCols = new Set(dbColsRes.rows.map(r => r.column_name));

    const missingSqls: string[] = [];

    // Find missing fields
    for (const field of model.fields) {
      if (field.kind !== 'scalar') continue;
      
      const finalColName = field.dbName || field.name.replace(/([A-Z])/g, "_$1").toLowerCase();
      
      if (!dbCols.has(finalColName)) {
        let sqlType = '';
        if (field.type === 'String') sqlType = 'VARCHAR(255)';
        else if (field.type === 'Int') sqlType = 'INTEGER';
        else if (field.type === 'Boolean') sqlType = 'BOOLEAN NOT NULL DEFAULT false';
        else if (field.type === 'DateTime') sqlType = 'TIMESTAMP(6)';
        else if (field.type === 'Json') sqlType = 'JSONB';
        else sqlType = 'TEXT';
        
        missingSqls.push(`ALTER TABLE "${actualTableName}" ADD COLUMN "${finalColName}" ${sqlType};`);
      }
    }

    if (missingSqls.length > 0) {
      console.log(`\n-- Missing columns in table: ${actualTableName}`);
      for (const sql of missingSqls) {
        console.log(sql);
      }
    }
  }

  await pgClient.end();
}

main().catch(console.error);
