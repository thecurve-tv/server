import { schemaComposer } from 'graphql-compose'
import { Guard, GuardInput, GuardOutput, guardResolver } from './guard'

interface TArgs {
  text: String
}

const testResolver = schemaComposer.createResolver({
  name: 'Test Resolver',
  type: 'String!',
  args: {
    text: 'String!'
  },
  resolve: ({ args }) => {
    return args.text
  }
})

describe('ingress guard', () => {
  const initialInput = '12345'

  test('transforms input', async () => {
    let transformedInput = initialInput
    class IngressGuard extends Guard<any, TArgs, String> {
      constructor() {
        super('ingress')
      }
      async check(input: GuardInput<any, TArgs, String>): Promise<void | GuardOutput<TArgs, String>> {
        transformedInput = `${input.args.text} - transformed`
        return { args: { text: transformedInput } }
      }
    }
    const guarded = guardResolver(testResolver, new IngressGuard())
    const output = await guarded.resolve({ args: { text: initialInput } })
    expect(transformedInput).not.toEqual(initialInput)
    expect(output).toEqual(transformedInput)
  })

  test('blocks entry to resolver', async () => {
    class IngressGuard extends Guard<any, TArgs, String> {
      constructor() {
        super('ingress')
      }
      async check(_input: GuardInput<any, TArgs, String>): Promise<void | GuardOutput<TArgs, String>> {
        throw new Error('blocked')
      }
    }
    const guarded = guardResolver(testResolver, new IngressGuard())
    let error
    try {
      await guarded.resolve({ args: { text: initialInput } })
    } catch (err) {
      error = err.message
    }
    expect(error).toEqual('blocked')
  })
})
