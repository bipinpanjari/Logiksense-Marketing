import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_METADATA_KEY, WorkspaceRole } from './roles.decorator';

const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

function normaliseRole(raw: unknown): WorkspaceRole {
  const value = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (value === 'owner' || value === 'admin' || value === 'member') return value;
  if (value === 'user') return 'member';
  return 'member';
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<WorkspaceRole[] | undefined>(
      ROLES_METADATA_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const role: WorkspaceRole = normaliseRole(req?.user?.role);

    const minRank = Math.min(...required.map((r) => ROLE_RANK[r] ?? 0));
    if ((ROLE_RANK[role] ?? 0) < minRank) {
      throw new ForbiddenException(`requires role ${required.join(' or ')}`);
    }
    return true;
  }
}
