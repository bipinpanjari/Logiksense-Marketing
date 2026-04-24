import { SetMetadata } from '@nestjs/common';

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export const ROLES_METADATA_KEY = 'workspace-roles';

/**
 * Guard controller routes by workspace role. Usage:
 *   @Roles('owner', 'admin')
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Delete(':id')
 *   delete() { ... }
 *
 * Role precedence (highest -> lowest): owner > admin > member.
 * Callers are authorized if their effective role is in the declared list.
 */
export const Roles = (...roles: WorkspaceRole[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
