import { Resolver, SchemaComposer, schemaComposer } from 'graphql-compose'

export type GuardType = 'ingress' | 'egress'

export interface GuardInput<TContext, TArgs, TReturn> {
  context: TContext
  args: TArgs
  data?: TReturn
}

export interface GuardOutput<TArgs, TReturn> {
  args?: TArgs
  data?: TReturn | false // set to false to remove all data
}

export abstract class Guard<TContext, TArgs = any, TReturn = any> {
  constructor(public type: GuardType) {}

  abstract check(input: GuardInput<TContext, TArgs, TReturn>): Promise<GuardOutput<TArgs, TReturn> | void>
}

export function guardResolver<TSource, TContext, TArgs, TReturn>(
  resolver: Resolver<TSource, TContext, TArgs, TReturn>,
  ...guards: Guard<TContext, TArgs, TReturn>[]
): Resolver<TSource, TContext, TArgs, TReturn> {
  const guardedResolver = (<SchemaComposer<TContext>>schemaComposer).createResolver<TSource, TArgs>({
    name: resolver.name,
    type: resolver.getType(),
    args: resolver.getArgs(),
    resolve: async params => {
      for (const guard of guards.filter(guard => guard.type == 'ingress')) {
        const result = await guard.check({
          args: params.args,
          context: params.context,
        })
        if (!result) continue
        if (result.args) params.args = result.args
      }
      let data: TReturn | undefined = await resolver.resolve(params)
      for (const guard of guards.filter(guard => guard.type == 'egress')) {
        const result = await guard.check({
          args: params.args,
          context: params.context,
          data,
        })
        if (!result) continue
        if (result.args) params.args = result.args
        if (result.data !== null) {
          // data is being mutated
          if (result.data === false) data = undefined
          else data = result.data
        }
      }
      return data
    },
  })
  return guardedResolver
}
