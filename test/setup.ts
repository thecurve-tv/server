import { ApolloServer, ExpressContext } from 'apollo-server-express'
import { ObjectId } from 'bson'
import mongoose from 'mongoose'
import Schema from '../src/graphql/schema'
import { Account, IAccount } from '../src/models/account'
import { IDraftDocument } from '../src/models/_defaults'
import { connectMongoDB } from '../src/mongodb'
import mongo from './data/mongo-test-data.json'
import { environment } from './environment'

export async function ensureMongoDBConnected() {
  if (mongoose.connection.readyState != 1) {
    await connectMongoDB(environment.MONGODB_CONNECT_URI)
  }
}

export async function prepareMongoDB(): Promise<IAccount> {
  await ensureMongoDBConnected()
  const account = await Account.findOne({ auth0Id: environment.AUTH0_USER.id })
  if (!account) {
    const docs = await Account.create([{
      auth0Id: environment.AUTH0_USER.id,
      email: environment.AUTH0_USER.email,
    }])
    return docs[0]
  }
  return account
}

export function prepareApolloServer(account?: IAccount): ApolloServer {
  return new ApolloServer({
    schema: Schema,
    debug: true,
    tracing: true,
    context: (context: ExpressContext & { account?: IDraftDocument<IAccount> }) => {
      const fixtureAccount = mongo.accounts[0]
      context.account = context.account || account || { ...fixtureAccount, _id: new ObjectId(fixtureAccount._id) }
      return context
    },
  })
}
