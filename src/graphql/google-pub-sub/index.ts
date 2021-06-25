import { PubSub, Subscription, Message } from '@google-cloud/pubsub'
import { PubSubEngine } from 'apollo-server-express'
import { GooglePubSubAsyncIterator } from './async-iterator'

class FreezingMap<K, V> extends Map<K, V | undefined> {
  set(key: K, value?: V): this {
    if (value !== undefined && this.has(key)) {
      throw new Error('A value already exists for that key')
    }
    return super.set(key, value)
  }
}

class SubscriptionTracker {
  private readonly numberToSubscriptionMap = new FreezingMap<number, Subscription>()
  private readonly nameToSubscriptionNumber = new FreezingMap<string, number>()
  private nextSubscriptionNumber = 1

  add(subscription: Subscription): number {
    const subscriptionNumber = this.nextSubscriptionNumber
    this.numberToSubscriptionMap.set(subscriptionNumber, subscription)
    this.nameToSubscriptionNumber.set(subscription.name, subscriptionNumber)
    this.nextSubscriptionNumber++
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
   */
  unlink(subscriptionNumber: number): void {
    this.numberToSubscriptionMap.set(subscriptionNumber)
  }
}

export interface GooglePubSubSubscribeOptions {
  labels?: { [k: string]: string }
  filter?: SubscriptionFilter
  messageExpirationSeconds?: number
  deleteExistingSubscription?: boolean
}

export interface GooglePubSubPublishOptions {
  payload: { [k: string]: any }
  attributes?: { [k: string]: string }
}

export interface GooglePubSubConfig {
  projectId: string
  /** Note: this is NOT the full topicName (i.e. should not follow the pattern "projects/{project}/topics/{topic}") */
  topicId: string
  orderingKey?: string
}

/**
 * Only use one query at a time.
 * i.e.) hasKey, keyEquals, & startsWith are mutually exclusive.
 * $and, & $or are also mutually exclusive.
 * Not following this will result in undefined behaviour.
 */
export interface SubscriptionFilter {
  /** attributes:"{hasKey}" */
  hasKey?: string
  /** attributes."{keyEquals.key}" = "{keyEquals.value}" */
  keyEquals?: { key: string, value: string }
  /** hasPrefix(attributes."{startsWith.key}", "{startsWith.value}") */
  startsWith?: { key: string, value: string }
  /** NOT | != */
  isNegated?: true
  /** this AND (that) AND (that) AND (that) */
  $and?: SubscriptionFilter[]
  /** this OR (that) OR (that) OR (that) */
  $or?: SubscriptionFilter[]
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
export class GooglePubSub implements PubSubEngine {
  private readonly client = new PubSub()
  private readonly subscriptions = new SubscriptionTracker()
  private readonly topicName: string

  constructor(
    public readonly config: Readonly<GooglePubSubConfig>
  ) {
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
    options: GooglePubSubSubscribeOptions
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
  asyncIteratorWithOptions<T>(subscriptionId: string, options: GooglePubSubSubscribeOptions): GooglePubSubAsyncIterator<T> {
    return new GooglePubSubAsyncIterator(this, subscriptionId, options)
  }

  /**
   * Publish a new message.
   * Attributes are automatically calculated based on the payload keys and values (values are converted to `string` via interpolation).
   * For best results, ensure your payload values can be accurately converted to `string`
   * You may also explicitly provide your own attributes.
   * @param _triggerName THIS PARAMETER IS NOT USED. Specify a topic in {@link GooglePubSub} constructor
   */
  async publish(_triggerName: string, options: GooglePubSubPublishOptions): Promise<void> {
    const topic = this.client.topic(this.topicName)
    let attributes: { [key: string]: string }
    if (options.attributes) {
      attributes = options.attributes
    } else {
      attributes = {}
      Object.entries(options.payload).forEach(([key, value]) => attributes[key] = `${value}`)
    }
    await topic.publishMessage({
      json: options.payload,
      attributes,
      orderingKey: this.config.orderingKey
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
  private async getSubscription(subscriptionName: string, options: GooglePubSubSubscribeOptions): Promise<Subscription> {
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

  private async createSubscription(subscriptionName: string, options: GooglePubSubSubscribeOptions): Promise<Subscription> {
    const [subscription] = await this.client.createSubscription(this.topicName, subscriptionName, {
      labels: options.labels,
      enableMessageOrdering: !!this.config.orderingKey,
      expirationPolicy: { ttl: { seconds: options.messageExpirationSeconds || 24 * 60 * 60 } },
      filter: options.filter ? this.convertFilterToString(options.filter) : undefined
    })
    this.subscriptions.add(subscription)
    return subscription
  }

  private convertFilterToString(filter: SubscriptionFilter): string {
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
    const getRelatedQueries = (filters: SubscriptionFilter[]): string[] => filters.map(filter => `(${this.convertFilterToString(filter)})`)
    if (filter.$and && filter.$and.length != 0) {
      query = `${query} AND ${getRelatedQueries(filter.$and).join('AND')}`
    } else if (filter.$or && filter.$or.length != 0) {
      query = `${query} OR ${getRelatedQueries(filter.$or).join('OR')}`
    }
    return query
  }

  /**
   * Closes & deletes the subscription.
   * If `subscriptionNumber` is provided, also removes the subscription from the set of saved subscriptions
   */
  private async endSubscription(subscription: Subscription, subscriptionNumber?: number): Promise<void> {
    await subscription.close()
    await subscription.delete()
    if (subscriptionNumber) this.subscriptions.unlink(subscriptionNumber)
  }
}
