import type { Prisma, PrismaClient, User } from '@prisma/client';
import type { Repository } from '../../repositories/repository.js';

export class PrismaUserRepository
  implements Repository<User, Prisma.UserCreateInput, Prisma.UserUpdateInput>
{
  constructor(private readonly client: PrismaClient) {}

  findById(id: string) {
    return this.client.user.findUnique({ where: { id } });
  }

  findByNormalizedLogin(loginNormalized: string) {
    return this.client.user.findUnique({ where: { loginNormalized } });
  }

  create(data: Prisma.UserCreateInput) {
    return this.client.user.create({ data });
  }

  updateById(id: string, data: Prisma.UserUpdateInput) {
    return this.client.user.update({ where: { id }, data });
  }
}
