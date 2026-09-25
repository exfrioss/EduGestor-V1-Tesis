import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../errors/app-error.js';
import type { ResourceScope } from './scope.js';

export const RESOURCE_TYPES = [
  'institution',
  'teacherInstitution',
  'course',
  'subject',
  'teachingAssignment',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

type ResourceStore = Pick<
  PrismaClient,
  'institution' | 'teacherInstitution' | 'course' | 'subject' | 'teachingAssignment'
>;

const notFound = () => new AppError(404, 'RESOURCE_NOT_FOUND', 'Recurso no encontrado');

export class ResourceScopeResolver {
  constructor(private readonly store: ResourceStore) {}

  async resolve(resourceType: ResourceType, resourceId: string): Promise<ResourceScope> {
    switch (resourceType) {
      case 'institution': {
        const resource = await this.store.institution.findUnique({
          where: { id: resourceId },
          select: { id: true },
        });
        if (resource === null) throw notFound();
        return { institutionId: resource.id };
      }
      case 'teacherInstitution': {
        const resource = await this.store.teacherInstitution.findUnique({
          where: { id: resourceId },
          select: { institutionId: true },
        });
        if (resource === null) throw notFound();
        return { institutionId: resource.institutionId };
      }
      case 'course': {
        const resource = await this.store.course.findUnique({
          where: { id: resourceId },
          select: { id: true, institutionId: true },
        });
        if (resource === null) throw notFound();
        return { institutionId: resource.institutionId, courseId: resource.id };
      }
      case 'subject': {
        const resource = await this.store.subject.findUnique({
          where: { id: resourceId },
          select: { institutionId: true },
        });
        if (resource === null) throw notFound();
        return { institutionId: resource.institutionId };
      }
      case 'teachingAssignment': {
        const resource = await this.store.teachingAssignment.findUnique({
          where: { id: resourceId },
          select: { institutionId: true, courseId: true },
        });
        if (resource === null) throw notFound();
        return { institutionId: resource.institutionId, courseId: resource.courseId };
      }
    }
  }
}
