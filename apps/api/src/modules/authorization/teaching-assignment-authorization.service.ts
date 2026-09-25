import type { PrismaClient } from '@prisma/client';

type TeachingAssignmentStore = Pick<PrismaClient, 'teachingAssignment'>;

export class TeachingAssignmentAuthorizationService {
  constructor(private readonly store: TeachingAssignmentStore) {}

  async canAccessOwnAssignment(userId: string, assignmentId: string): Promise<boolean> {
    return (
      (await this.store.teachingAssignment.count({
        where: {
          id: assignmentId,
          endedAt: null,
          teacher: { userId, isActive: true, user: { isActive: true } },
        },
      })) === 1
    );
  }
}
