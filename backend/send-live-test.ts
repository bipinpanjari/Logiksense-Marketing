
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EmailDispatcherService } from './modules/email-engine/email-dispatcher.service';
import { getDatabase, initializeDatabase } from './shared/database';

async function bootstrap() {
  initializeDatabase();
  const app = await NestFactory.createApplicationContext(AppModule);
  const dispatcher = app.get(EmailDispatcherService);
  const db = getDatabase();

  const recipient = 'bipinpanjaari@outlook.com';
  
  console.log(`🚀 Starting live test for: ${recipient}`);

  try {
    // 1. Find or create a test lead
    let leadId: string;
    const existing = await db.query('SELECT id FROM leads WHERE email = $1 LIMIT 1', [recipient]);
    
    if (existing.rows.length > 0) {
      leadId = existing.rows[0].id;
    } else {
      // Find a workspace to attach to
      let wsId: string;
      const wsRes = await db.query('SELECT id FROM workspaces LIMIT 1');
      
      if (wsRes.rows.length === 0) {
        console.log('🌱 No workspaces found. Creating a default test workspace...');
        // Create a customer first
        const custIns = await db.query(
          "INSERT INTO customers (email, first_name, last_name, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id",
          ['test@example.com', 'Test', 'User', 'x', 'owner']
        );
        const customerId = custIns.rows[0].id;
        
        const wsIns = await db.query(
          "INSERT INTO workspaces (name, customer_id) VALUES ($1, $2) RETURNING id",
          ['Test Workspace', customerId]
        );
        wsId = wsIns.rows[0].id;
      } else {
        wsId = wsRes.rows[0].id;
      }

      const ins = await db.query(
        'INSERT INTO leads (workspace_id, email, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id',
        [wsId, recipient, 'Bipin', 'Test']
      );
      leadId = ins.rows[0].id;
    }

    // 2. Dispatch
    const workspaceId = (await db.query('SELECT workspace_id FROM leads WHERE id = $1', [leadId])).rows[0].workspace_id;
    const customerId = (await db.query('SELECT customer_id FROM workspaces WHERE id = $1', [workspaceId])).rows[0].customer_id;

    const result = await dispatcher.dispatch({
      workspaceId,
      customerId,
      leadId,
      override: {
        subject: '🚀 Live Deliverability Test from Logik Sense',
        html: `
          <p>Hello Bipin,</p>
          <p>This is a live test from your new <b>Logik Sense</b> outbound engine.</p>
          <p>If you see this in your inbox, it means:</p>
          <ul>
            <li>✅ Microsoft 365 OAuth is working.</li>
            <li>✅ DNS Records (SPF/MX/DKIM) are correctly configured.</li>
            <li>✅ Tracking pixels are active.</li>
          </ul>
          <p>Please click this link to verify click-tracking: <a href="https://logiksense.ai">Verify Click</a></p>
          <p>Best regards,<br/>The Logik Sense Team</p>
        `
      }
    });

    console.log('✅ Test Dispatch Result:', result);
  } catch (err) {
    console.error('❌ Test Failed:', err);
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap();
