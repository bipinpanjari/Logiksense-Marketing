import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { AuthPayload } from './types';

/**
 * Controllers that attach optional DB-backed workspace/customer; JWT always has userId + workspaceId.
 * @see AuthService.generateTokens
 */
export type AuthedWithWorkspace = Request & {
  user?: AuthPayload & { customerId?: string; id?: string };
  workspace?: { id: string };
  customer?: { id: string };
};

export function getWorkspaceId(req: AuthedWithWorkspace): { workspaceId: string } {
  const u = req.user;
  const workspaceId = req.workspace?.id || u?.workspaceId;
  if (!workspaceId) {
    throw new BadRequestException('workspace context missing');
  }
  return { workspaceId };
}

export function getWorkspaceContext(req: AuthedWithWorkspace): { workspaceId: string; customerId: string } {
  const u = req.user;
  const workspaceId = req.workspace?.id || u?.workspaceId;
  const customerId = req.customer?.id || u?.customerId || u?.userId;
  if (!workspaceId || !customerId) {
    throw new BadRequestException('workspace context missing');
  }
  return { workspaceId, customerId };
}
