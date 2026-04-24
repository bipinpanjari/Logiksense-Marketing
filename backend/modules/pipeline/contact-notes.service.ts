import { BadRequestException, Injectable } from '@nestjs/common';
import { getDatabase } from '../../shared/database';
import { PipelineService } from './pipeline.service';

@Injectable()
export class ContactNotesService {
  constructor(private readonly pipeline: PipelineService) {}

  async list(workspaceId: string, leadId: string) {
    const db = getDatabase();
    const res = await db.query(
      `SELECT cn.id, cn.body, cn.created_at, cn.updated_at, cn.author_id,
              c.first_name AS author_first_name, c.last_name AS author_last_name
       FROM contact_notes cn
       LEFT JOIN customers c ON c.id = cn.author_id
       WHERE cn.workspace_id = $1 AND cn.lead_id = $2
       ORDER BY cn.created_at DESC`,
      [workspaceId, leadId],
    );
    return res.rows;
  }

  async create(workspaceId: string, leadId: string, authorId: string, body: string) {
    if (!body?.trim()) throw new BadRequestException('note body required');
    const db = getDatabase();
    const res = await db.query(
      `INSERT INTO contact_notes (workspace_id, lead_id, author_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, body, created_at, updated_at`,
      [workspaceId, leadId, authorId, body.trim()],
    );
    await this.pipeline.appendTimeline(workspaceId, leadId, {
      at: new Date().toISOString(),
      type: 'note',
      data: { noteId: res.rows[0].id, authorId, preview: body.trim().slice(0, 120) },
    });
    return res.rows[0];
  }

  async update(workspaceId: string, noteId: string, body: string) {
    if (!body?.trim()) throw new BadRequestException('note body required');
    const db = getDatabase();
    const res = await db.query(
      `UPDATE contact_notes SET body = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND workspace_id = $3
       RETURNING id, body, created_at, updated_at`,
      [body.trim(), noteId, workspaceId],
    );
    if (res.rows.length === 0) throw new BadRequestException('note not found');
    return res.rows[0];
  }

  async remove(workspaceId: string, noteId: string) {
    const db = getDatabase();
    const res = await db.query(
      `DELETE FROM contact_notes WHERE id = $1 AND workspace_id = $2 RETURNING id`,
      [noteId, workspaceId],
    );
    if (res.rows.length === 0) throw new BadRequestException('note not found');
    return { ok: true };
  }
}
