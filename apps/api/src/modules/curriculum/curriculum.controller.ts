import type { Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../../errors/app-error.js';
import { authenticatedPrincipal } from '../auth/auth.middleware.js';
import {
  catalogContextQuery,
  createAcademicArea,
  createDiscipline,
  createMapping,
  createPlanType,
  disciplineQuery,
  mappingQuery,
  replaceMapping,
  retireMapping,
  updateAcademicArea,
  updateDiscipline,
  updatePlanType,
  uuid,
} from './curriculum.schemas.js';
import { CurriculumService } from './curriculum.service.js';
import type { CurriculumContext } from './curriculum.types.js';

const parse = <T>(schema: ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Datos inválidos', result.error.flatten());
  }
  return result.data;
};
const param = (request: Request, name: string) => parse(uuid, request.params[name]);
const context = (response: Response): CurriculumContext => {
  const principal = authenticatedPrincipal(response.locals);
  return { actorUserId: principal.userId, accountKind: principal.accountKind, requestId: String(response.locals.requestId) };
};

export class CurriculumController {
  constructor(private readonly service: CurriculumService) {}

  listPlanTypes = async (request: Request, response: Response) => {
    response.json(await this.service.listPlanTypes(parse(catalogContextQuery, request.query), context(response)));
  };
  listAcademicAreas = async (request: Request, response: Response) => {
    response.json(await this.service.listAcademicAreas(param(request, 'planTypeId'), parse(catalogContextQuery, request.query), context(response)));
  };
  listDisciplines = async (request: Request, response: Response) => {
    response.json(await this.service.listDisciplines(parse(disciplineQuery, request.query), context(response)));
  };
  createPlanType = async (request: Request, response: Response) => {
    response.status(201).json({ data: await this.service.createPlanType(parse(createPlanType, request.body), context(response)) });
  };
  updatePlanType = async (request: Request, response: Response) => {
    response.json({ data: await this.service.updatePlanType(param(request, 'id'), parse(updatePlanType, request.body), context(response)) });
  };
  createAcademicArea = async (request: Request, response: Response) => {
    response.status(201).json({ data: await this.service.createAcademicArea(parse(createAcademicArea, request.body), context(response)) });
  };
  updateAcademicArea = async (request: Request, response: Response) => {
    response.json({ data: await this.service.updateAcademicArea(param(request, 'id'), parse(updateAcademicArea, request.body), context(response)) });
  };
  createDiscipline = async (request: Request, response: Response) => {
    response.status(201).json({ data: await this.service.createDiscipline(parse(createDiscipline, request.body), context(response)) });
  };
  updateDiscipline = async (request: Request, response: Response) => {
    response.json({ data: await this.service.updateDiscipline(param(request, 'id'), parse(updateDiscipline, request.body), context(response)) });
  };
  listMappings = async (request: Request, response: Response) => {
    response.json(await this.service.listMappings(param(request, 'institutionId'), param(request, 'subjectId'), parse(mappingQuery, request.query), context(response)));
  };
  createMapping = async (request: Request, response: Response) => {
    const parsed = createMapping.safeParse(request.body);
    if (!parsed.success) {
      const year = request.body?.btiYear as unknown;
      if (typeof year !== 'number' || !Number.isInteger(year) || year < 1 || year > 3) {
        throw new AppError(422, 'INVALID_BTI_YEAR', 'El año BTI debe estar entre 1 y 3');
      }
      throw new AppError(400, 'VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten());
    }
    response.status(201).json({ data: await this.service.createMapping(param(request, 'institutionId'), param(request, 'subjectId'), parsed.data, context(response)) });
  };
  retireMapping = async (request: Request, response: Response) => {
    response.json({ data: await this.service.retireMapping(param(request, 'institutionId'), param(request, 'subjectId'), param(request, 'mappingId'), parse(retireMapping, request.body), context(response)) });
  };
  replaceMapping = async (request: Request, response: Response) => {
    response.status(201).json({ data: await this.service.replaceMapping(param(request, 'institutionId'), param(request, 'subjectId'), param(request, 'mappingId'), parse(replaceMapping, request.body), context(response)) });
  };
}
