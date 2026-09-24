import type { AuditLog, Prisma, PrismaClient } from '@prisma/client';

export interface AppendOnlyAuditRepository {
  append(data: Prisma.AuditLogCreateInput): Promise<AuditLog>;
}

export class PrismaAuditLogRepository implements AppendOnlyAuditRepository {
  constructor(private readonly client: PrismaClient) {}

  append(data: Prisma.AuditLogCreateInput) {
    return this.client.auditLog.create({ data });
  }
}
