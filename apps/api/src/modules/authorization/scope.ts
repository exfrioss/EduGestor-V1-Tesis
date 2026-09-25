import { ScopeKind } from '@prisma/client';

export interface ScopeSnapshot {
  id?: string;
  kind: ScopeKind;
  institutionId: string;
  courseIds: ReadonlySet<string>;
}

export interface ResourceScope {
  institutionId: string;
  courseId?: string;
}

export const scopeContainsResource = (scope: ScopeSnapshot, resource: ResourceScope): boolean => {
  if (scope.kind === ScopeKind.RESOURCE_SET || scope.institutionId !== resource.institutionId) {
    return false;
  }
  if (scope.kind === ScopeKind.INSTITUTION) return true;
  return resource.courseId !== undefined && scope.courseIds.has(resource.courseId);
};

export const scopeContainsScope = (parent: ScopeSnapshot, child: ScopeSnapshot): boolean => {
  if (
    parent.kind === ScopeKind.RESOURCE_SET ||
    child.kind === ScopeKind.RESOURCE_SET ||
    parent.institutionId !== child.institutionId
  ) {
    return false;
  }
  if (parent.kind === ScopeKind.INSTITUTION) return true;
  if (child.kind !== ScopeKind.COURSE_SET || child.courseIds.size === 0) return false;
  return [...child.courseIds].every((courseId) => parent.courseIds.has(courseId));
};

export const scopeFromRecord = (scope: {
  id?: string;
  kind: ScopeKind;
  institutionId: string;
  courses: { courseId: string }[];
}): ScopeSnapshot => ({
  id: scope.id,
  kind: scope.kind,
  institutionId: scope.institutionId,
  courseIds: new Set(scope.courses.map(({ courseId }) => courseId)),
});
