export interface Repository<TEntity, TCreate, TUpdate> {
  findById(id: string): Promise<TEntity | null>;
  create(data: TCreate): Promise<TEntity>;
  updateById(id: string, data: TUpdate): Promise<TEntity>;
}
