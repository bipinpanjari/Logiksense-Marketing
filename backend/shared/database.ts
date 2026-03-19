import { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient | null = null;

type QueryResult = { rows: any[]; rowCount: number };
type LegacyDbClient = { query: (query: string, params?: any[]) => Promise<QueryResult> };

class PrismaQueryAdapter implements LegacyDbClient {
  constructor(private readonly prisma: PrismaClient) {}

  async query(query: string, params?: any[]): Promise<QueryResult> {
    const rawParams = (params || []) as any[];
    const normalized = this.withUuidCasts(query, rawParams);
    const rows = (await this.prisma.$queryRawUnsafe(normalized.query, ...normalized.params)) as any[];
    return {
      rows: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : 0,
    };
  }

  private withUuidCasts(query: string, params: any[]) {
    let nextQuery = query;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    params.forEach((param, index) => {
      const argIndex = index + 1;
      const isUuidString = typeof param === 'string' && uuidRegex.test(param);
      const isUuidArray =
        Array.isArray(param) &&
        param.length > 0 &&
        param.every((v) => typeof v === 'string' && uuidRegex.test(v));

      if (isUuidString) {
        const idComparePattern = new RegExp(
          `\\b([a-zA-Z_][a-zA-Z0-9_.]*id)\\b\\s*=\\s*\\$${argIndex}(?!\\s*::)`,
          'gi'
        );
        nextQuery = nextQuery.replace(idComparePattern, (_m, col) => `${col} = $${argIndex}::uuid`);

        const wherePlaceholderPattern = new RegExp(`\\bWHERE\\s+[^;]*\\$${argIndex}(?!\\s*::)`, 'gi');
        nextQuery = nextQuery.replace(wherePlaceholderPattern, (segment) => {
          return segment.replace(new RegExp(`\\$${argIndex}(?!\\s*::)`, 'g'), `$${argIndex}::uuid`);
        });
      }

      if (isUuidArray) {
        const anyPattern = new RegExp(`ANY\\(\\s*\\$${argIndex}\\s*\\)`, 'gi');
        nextQuery = nextQuery.replace(anyPattern, `ANY($${argIndex}::uuid[])`);
      }
    });

    return { query: nextQuery, params };
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
