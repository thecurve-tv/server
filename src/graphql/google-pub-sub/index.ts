import { PubSub, Subscription, Message } from '@google-cloud/pubsub'
import { PubSubEngine } from 'apollo-server-express'
import { GooglePubSubAsyncIterator } from './async-iterator'

class FreezingMap<K, V> extends Map<K, V | undefined> {
  /**
   * Set a key for a value.
   * If the key already exists and the supplied value is not `undefined`, an error is thrown.
   * You may free up some memory by setting the value to `undefined`.
   * This is the only case when a value may be re-supplied.
   */
  set(key: K, value: V | undefined): this {
    if (value !== undefined && this.has(key)) {
      throw new Error(`A value already exists for the key ${key}`)
    }
    return super.set(key, value)
  }

  /**
   * Convenience Method. `key` is never deleted (because it is frozen).
   * This method simply frees up some memory by assigning `undefined` to the value at `key`.
   * @see {@link FreezingMap.set}
   */
  delete(key: K): false {
    this.set(key, undefined)
    return false
  }
}

class SubscriptionTracker {
  private readonly numberToSubscriptionMap = new FreezingMap<number, Subscription>()
  private readonly nameToSubscriptionNumber = new Map<string, number>()
  private nextSubscriptionNumber = 1

  add(subscription: Subscription): number {
    const subscriptionNumber = this.nextSubscriptionNumber++
    this.numberToSubscriptionMap.set(subscriptionNumber, subscription)
    this.nameToSubscriptionNumber.set(subscription.name, subscriptionNumber)
    return subscriptionNumber
  }

  get(subscriptionNameOrNumber: number | string): Subscription | undefined {
    const usingSubscriptionNumber = typeof subscriptionNameOrNumber === 'number'
    const subscriptionNumber = usingSubscriptionNumber ? <number>subscriptionNameOrNumber : this.nameToSubscriptionNumber.get(<string>subscriptionNameOrNumber)
    if (!subscriptionNumber) return undefined
    return this.numberToSubscriptionMap.get(subscriptionNumber)
  }

  getSubscriptionNumber(subscriptionName: string): number | undefined {
    return this.nameToSubscriptionNumber.get(subscriptionName)
  }

  /**
   * Frees up some memory by setting `undefined` as the value for the key `subscriptionNumber`.
   * This should only be called once the subscription is deleted.
   * If this method is called more than once, subsequent calls do nothing.
   */
  unlink(subscriptionNumber: number): void {
    const subscription = this.numberToSubscriptionMap.get(subscriptionNumber)
    if (!subscription) return
    this.numberToSubscriptionMap.delete(subscriptionNumber)
    this.nameToSubscriptionNumber.delete(subscription.name)
  }
}

export interface GooglePubSubConfig {
  projectId: string
  /** Note: this is NOT the full topicName (i.e. should not follow the pattern "projects/{project}/topics/{topic}") */
  topicId: string
  /** the name of the Subscription in GraphQL. Used when publishing messages */
  graphqlSubscriptionName: string
  orderingKey?: string
}

export interface GooglePubSubSubscribeOptions<TPayload> {
  labels?: { [k: string]: string }
  filter?: SubscriptionFilter<TPayload>
  messageExpirationSeconds?: number
  deleteExistingSubscription?: boolean
}

export interface GooglePubSubPublishOptions<TPayload> {
  payload: TPayload
  attributes?: { [k: string]: string }
}

/**
 * Only use one query at a time.
 * i.e.) hasKey, keyEquals, & startsWith are mutually exclusive.
 * $and, & $or are also mutually exclusive.
 * Not following this will result in undefined behaviour.
 */
export interface SubscriptionFilter<TPayload> {
  /** attributes:"{hasKey}" */
  hasKey?: keyof TPayload
  /** attributes."{keyEquals.key}" = "{keyEquals.value}" */
  keyEquals?: { key: keyof TPayload; value: string }
  /** hasPrefix(attributes."{startsWith.key}", "{startsWith.value}") */
  startsWith?: { key: keyof TPayload; value: string }
  /** NOT | != */
  isNegated?: true
  /** this AND (that) AND (that) AND (that) */
  $and?: SubscriptionFilter<TPayload>[]
  /** this OR (that) OR (that) OR (that) */
  $or?: SubscriptionFilter<TPayload>[]
}

/**
 * PubSubEngine for the Google PubSub API.
 * Use a separate instance for separate topics.
 *
 * Some definitions:
 * * `itemId`: the short-form (so to speak) name of the item (e.g. chat-messages for the ChatMessages Topic)
 * * `itemName`: the actual name of the item (e.g. projects/{projectId}/topics/chat-messages)
 * * `subscriptionNumber`: [internal] tracking number that should never be used outside of the instance where it was obtained
 */
export class GooglePubSub<TPayload extends { [k: string]: any }> implements PubSubEngine {
  private readonly client = new PubSub()
  private readonly subscriptions = new SubscriptionTracker()
  private readonly topicName: string
  /**
   * The `_triggerName` param in {@link GooglePubSub.publish} isn't used & can't be removed because of the signature of
   * {@link PubSubEngine.publish}. So just put this in place so as not to confuse developers.
   */
  readonly DEFAULT_PUBLISH_TRIGGER_NAME = ''

  constructor(public readonly config: Readonly<GooglePubSubConfig>) {
    this.topicName = `projects/${this.config.projectId}/topics/${this.config.topicId}`
  }

  /**
   * Start a subscription
   * @param subscriptionId
   * MUST BE UNIQUE
   * Note: this is NOT the full subscriptionName (i.e. should not follow the pattern "projects/{project}/subscriptions/{subscription}")
   * Must start with a letter, and contain only letters ([A-Za-z]), numbers ([0-9]), dashes (-), underscores (_),
   * periods (.), tildes (~), plus (+) or percent signs (%). It must be between 3 and 255 characters in length,
   * and it must not start with "goog"
   * @returns the subscriptionNumber to be used to identify the subscription ONLY on this instance
   * @throws
   * - IF: no saved subscription was found, AND
   * - a subscription already exists in Google PubSub with an identical identifier, AND
   * - `options.deleteExistingSubscription` is false
   */
  async subscribe(
    subscriptionId: string,
    onMessageOrClose: (done: boolean, message?: Message) => Promise<void>,
    options: GooglePubSubSubscribeOptions<TPayload>
  ): Promise<number> {
    const subscriptionName = this.getSubscriptionName(subscriptionId)
    const subscription = await this.getSubscription(subscriptionName, options)
    const subscriptionNumber = this.subscriptions.getSubscriptionNumber(subscriptionName)
    if (!subscriptionNumber) throw new Error('subscriptionNumber was unexpectedly falsy')
    subscription.on('message', async (message: Message) => {
      try {
        await onMessageOrClose(false, message)
      } catch (err) {
        console.error(err)
        message.nack()
      }
    })
    subscription.on('error', async err => {
      console.error(err)
      await this.endSubscription(subscription, subscriptionNumber)
    })
    subscription.on('close', async () => {
      try {
        await onMessageOrClose(true)
      } catch (err) {
        console.error(err)
      }
    })
    return subscriptionNumber
  }

  async unsubscribe(subscriptionNumber: number) {
    const subscription = this.subscriptions.get(subscriptionNumber)
    if (!subscription) throw new Error('There is no subscription with that number')
    await this.endSubscription(subscription, subscriptionNumber)
  }

  /**
   * Subscribe to the (already provided) topic.
   * Labels, filters, etc. can only be set if you use {@link GooglePubSub.asyncIteratorWithOptions}
   * @param subscriptionIds see {@link GooglePubSub.subscribe} for the meaning of `subscriptionId`
   */
  asyncIterator<T>(subscriptionId: string): GooglePubSubAsyncIterator<T> {
    return new GooglePubSubAsyncIterator(this, subscriptionId, {})
  }

  /**
   * Subscribe to the (already provided) topic
   * @param subscriptionIds see {@link GooglePubSub.subscribe} for the meaning of `subscriptionId`
   */
  asyncIteratorWithOptions<T>(subscriptionId: string, options: GooglePubSubSubscribeOptions<TPayload>): GooglePubSubAsyncIterator<T> {
    return new GooglePubSubAsyncIterator(this, subscriptionId, options)
  }

  /**
   * Publish a new message.
   * Attributes are automatically calculated based on the payload keys and values (values are converted to `string` via interpolation).
   * For best results, ensure your payload values can be accurately converted to `string`
   * You may also explicitly provide your own attributes.
   * @param _triggerName THIS PARAMETER IS NOT USED. Specify a topic in {@link GooglePubSub} constructor
   */
  async publish(_triggerName: string, options: GooglePubSubPublishOptions<TPayload>): Promise<void> {
    const topic = this.client.topic(this.topicName)
    let attributes: { [key: string]: string }
    if (options.attributes) {
      attributes = options.attributes
    } else {
      attributes = {}
      Object.entries(options.payload).forEach(([key, value]) => (attributes[key] = `${value}`))
    }
    await topic.publishMessage({
      json: {
        [this.config.graphqlSubscriptionName]: options.payload,
      },
      attributes,
      orderingKey: this.config.orderingKey,
    })
  }

  private getSubscriptionName(subscriptionId: string): string {
    return `projects/${this.config.projectId}/subscriptions/${subscriptionId}`
  }

  /**
   * Gets the subscription saved in memory or creates a new subscription if none was saved.
   * @param subscriptionName MUST be unique
   * @throws
   * - IF: no saved subscription was found, AND
   * - a subscription already exists in Google PubSub with an identical identifier, AND
   * - `options.deleteExistingSubscription` is false
   */
  private async getSubscription(subscriptionName: string, options: GooglePubSubSubscribeOptions<TPayload>): Promise<Subscription> {
    const savedSubscription = this.subscriptions.get(subscriptionName)
    if (savedSubscription) return savedSubscription
    const topic = this.client.topic(this.topicName)
    const subscription = topic.subscription(subscriptionName)
    const [exists] = await subscription.exists()
    if (exists) {
      if (!options.deleteExistingSubscription) {
        throw new Error(`A subscription already exists with the name ${subscriptionName}`)
      }
      await this.endSubscription(subscription)
    }
    return await this.createSubscription(subscriptionName, options)
  }

  private async createSubscription(subscriptionName: string, options: GooglePubSubSubscribeOptions<TPayload>): Promise<Subscription> {
    const [subscription] = await this.client.createSubscription(this.topicName, subscriptionName, {
      labels: options.labels,
      enableMessageOrdering: !!this.config.orderingKey,
      expirationPolicy: { ttl: { seconds: options.messageExpirationSeconds || 24 * 60 * 60 } },
      filter: options.filter ? this.convertFilterToString(options.filter) : undefined,
    })
    this.subscriptions.add(subscription)
    return subscription
  }

  private convertFilterToString(filter: SubscriptionFilter<TPayload>): string {
    let query: string
    if (filter.hasKey) {
      query = `${filter.isNegated ? 'NOT ' : ''}attributes:"${filter.hasKey}"`
    } else if (filter.keyEquals) {
      query = `attributes."${filter.keyEquals.key}" ${filter.isNegated ? '!=' : '='} "${filter.keyEquals.value}"`
    } else if (filter.startsWith) {
      query = `${filter.isNegated ? 'NOT ' : ''}hasPrefix(attributes."${filter.startsWith.key}", "${filter.startsWith.value}")`
    } else {
      throw new Error('A SubscriptionFilter must have one of {hasKey, keyEquals, startsWith}')
    }
    const getRelatedQueries = (filters: SubscriptionFilter<TPayload>[]): string[] => {
      return filters.map(filter => `(${this.convertFilterToString(filter)})`)
    }
    if (filter.$and && filter.$and.length != 0) {
      query = `${query} AND ${getRelatedQueries(filter.$and).join('AND')}`
    } else if (filter.$or && filter.$or.length != 0) {
      query = `${query} OR ${getRelatedQueries(filter.$or).join('OR')}`
    }
    return query
  }

  /**
   * Closes & deletes the subscription. Then removed the subscription from the set of saved subscriptions
   * If `subscriptionNumber` is not provided, if there is a saved subscription with the same name as the
   * subscription to be ended, that saved subscription will be removed (forgotten).
   */
  private async endSubscription(subscription: Subscription, subscriptionNumber?: number): Promise<void> {
    await subscription.close()
    await subscription.delete()
    const subscriptionNumberToRemove = subscriptionNumber || this.subscriptions.getSubscriptionNumber(subscription.name)
    if (subscriptionNumberToRemove) this.subscriptions.unlink(subscriptionNumberToRemove)
  }
}
