import type { AccountKind } from '@prisma/client';

export interface CurriculumContext {
  actorUserId: string;
  accountKind: AccountKind;
  requestId: string;
}

export interface PageInput {
  limit: number;
  cursor?: string;
}
