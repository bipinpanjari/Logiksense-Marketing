import { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient | null = null;

type QueryResult = { rows: any[]; rowCount: number };
type LegacyDbClient = { query: (query: string, params?: any[]) => Promise<QueryResult> };

class PrismaQueryAdapter implements LegacyDbClient {
  constructor(private readonly prisma: PrismaClient) {}

  async query(query: string, params?: any[]): Promise<QueryResult> {
    const rawParams = (params || []) as any[];
    const afterUuid = this.withUuidCasts(query, rawParams);
    const afterJsonb = this.withJsonbCasts(afterUuid.query, rawParams);
    const rows = (await this.prisma.$queryRawUnsafe(afterJsonb.query, ...rawParams)) as any[];
    return {
      rows: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : 0,
    };
  }

  private withUuidCasts(query: string, params: any[]) {
    let nextQuery = query;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const uuidParamIndexes = params
      .map((param, idx) =>
        typeof param === 'string' && uuidRegex.test(param) ? idx + 1 : null,
      )
      .filter((i): i is number => i !== null)
      .sort((a, b) => b - a);

    for (const argIndex of uuidParamIndexes) {
      const placeholder = new RegExp(`\\$${argIndex}(?!\\d)(?!\\s*::)`, 'g');
      nextQuery = nextQuery.replace(placeholder, () => `$${argIndex}::uuid`);
    }

    params.forEach((param, index) => {
      const argIndex = index + 1;
      const isUuidArray =
        Array.isArray(param) &&
        param.length > 0 &&
        param.every((v) => typeof v === 'string' && uuidRegex.test(v));

      if (isUuidArray) {
        const anyPattern = new RegExp(`ANY\\(\\s*\\$${argIndex}\\s*\\)`, 'gi');
        nextQuery = nextQuery.replace(anyPattern, `ANY($${argIndex}::uuid[])`);
      }
    });

    return { query: nextQuery, params };
  }

  private withJsonbCasts(query: string, params: any[]) {
    let nextQuery = query;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const jsonParamIndexes = params
      .map((param, idx) => (this.isJsonbStringParam(param, uuidRegex) ? idx + 1 : null))
      .filter((i): i is number => i !== null)
      .sort((a, b) => b - a);

    for (const argIndex of jsonParamIndexes) {
      const placeholder = new RegExp(`\\$${argIndex}(?!\\d)(?!\\s*::)`, 'g');
      nextQuery = nextQuery.replace(placeholder, () => `$${argIndex}::jsonb`);
    }

    return { query: nextQuery, params };
  }

  private isJsonbStringParam(param: unknown, uuidRegex: RegExp): boolean {
    if (typeof param !== 'string') return false;
    if (uuidRegex.test(param)) return false;
    const t = param.trim();
    if (!t || (t[0] !== '{' && t[0] !== '[')) return false;
    try {
      JSON.parse(param);
      return true;
    } catch {
      return false;
    }
  }
}

export function initializeDatabase() {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

export function getDatabase(): LegacyDbClient {
  if (!prismaClient) {
    throw new Error('Database not initialized');
  }
  return new PrismaQueryAdapter(prismaClient);
}

export async function executeQuery(query: string, params?: any[]) {
  if (!prismaClient) {
    throw new Error('Database not initialized');
  }
  return prismaClient.$queryRawUnsafe(query, ...((params || []) as any[]));
}

export async function closeDatabase() {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}
