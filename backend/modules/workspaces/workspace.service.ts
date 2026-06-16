import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { getDatabase } from '../../shared/database';

@Injectable()
export class WorkspaceService {
  async createWorkspace(customerId: string, name: string) {
    const db = getDatabase();

    const result = await db.query(
      `INSERT INTO workspaces (customer_id, name, settings)
       VALUES ($1, $2, $3)
       RETURNING id, name, settings, created_at`,
      [customerId, name, JSON.stringify({})]
    );

<<<<<<< Updated upstream
    return result.rows[0];
=======
    const workspace = result.rows[0];

    // Add owner as member
    await db.query(
      `INSERT INTO workspace_members (workspace_id, customer_id, role)
       VALUES ($1, $2, $3)`,
      [workspace.id, customerId, 'owner']
    );

    return workspace;
>>>>>>> Stashed changes
  }

  async getWorkspaces(customerId: string) {
    const db = getDatabase();

    const result = await db.query(
<<<<<<< Updated upstream
      `SELECT id, name, settings, is_active, created_at
       FROM workspaces
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
=======
      `SELECT w.id, w.name, w.settings, w.is_active, w.created_at, m.role
       FROM workspaces w
       JOIN workspace_members m ON w.id = m.workspace_id
       WHERE m.customer_id = $1
       ORDER BY w.created_at DESC`,
>>>>>>> Stashed changes
      [customerId]
    );

    return result.rows;
  }

  async getWorkspace(workspaceId: string, customerId: string) {
    const db = getDatabase();

    const result = await db.query(
<<<<<<< Updated upstream
      `SELECT id, name, settings, is_active, created_at
       FROM workspaces
       WHERE id = $1 AND customer_id = $2`,
=======
      `SELECT w.id, w.name, w.settings, w.is_active, w.created_at, m.role
       FROM workspaces w
       JOIN workspace_members m ON w.id = m.workspace_id
       WHERE w.id = $1 AND m.customer_id = $2`,
>>>>>>> Stashed changes
      [workspaceId, customerId]
    );

    if (result.rows.length === 0) {
      throw new ForbiddenException('Workspace not found or you do not have access');
    }

    return result.rows[0];
  }

  async updateWorkspace(workspaceId: string, customerId: string, updates: any) {
    const db = getDatabase();

<<<<<<< Updated upstream
    // Verify ownership
    const workspace = await this.getWorkspace(workspaceId, customerId);
=======
    // Verify ownership/admin rights
    const workspace = await this.getWorkspace(workspaceId, customerId);
    if (workspace.role !== 'owner' && workspace.role !== 'admin') {
      throw new ForbiddenException('You do not have permission to update this workspace');
    }
>>>>>>> Stashed changes

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (updates.name) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(updates.name);
      paramIndex++;
    }

    if (updates.settings) {
      updateFields.push(`settings = $${paramIndex}`);
      updateValues.push(JSON.stringify(updates.settings));
      paramIndex++;
    }

    updateValues.push(workspaceId);

    const result = await db.query(
      `UPDATE workspaces
       SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING id, name, settings, created_at`,
      updateValues
    );

    return result.rows[0];
  }

  async switchWorkspace(customerId: string, workspaceId: string) {
    const workspace = await this.getWorkspace(workspaceId, customerId);
    return workspace;
  }

  async getWorkspaceStats(workspaceId: string) {
    const db = getDatabase();

    const leadCount = await db.query(
      'SELECT COUNT(*) FROM leads WHERE workspace_id = $1',
      [workspaceId]
    );

    const usageCount = await db.query(
      `SELECT SUM(count) as total_usage FROM usage_logs 
       WHERE workspace_id = $1 AND logged_at >= NOW() - INTERVAL '30 days'`,
      [workspaceId]
    );

    return {
      totalLeads: parseInt(leadCount.rows[0].count),
      monthlyUsage: parseInt(usageCount.rows[0].total_usage || 0),
    };
  }
}
