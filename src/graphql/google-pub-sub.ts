import { PubSub, Subscription, Message } from '@google-cloud/pubsub'
import { PubSubEngine } from 'apollo-server-express'

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

  get(subscriptionName: string): Subscription | undefined
  get(subscriptionNumber: number): Subscription | undefined
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

export interface GooglePubSubConfig {
  projectId: string
  /** Note: this is NOT the full topicName (i.e. should not follow the pattern "projects/{project}/topics/{topic}") */
  topicId: string
  labels?: { [k: string]: string }
  filter?: SubscriptionFilter
  orderingKey?: string
  messageExpirationSeconds?: number
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
 * Some definitions:
 * * `itemId`: the short-form (so to speak) name of the item (e.g. chat-messages for the ChatMessages Topic)
 * * `itemName`: the actual name of the item (e.g. projects/{projectId}/topics/chat-messages)
 * * `subscriptionNumber`: [internal] tracking number that should never be used outside of the instance where it was obtained
 */
export class GooglePubSub extends PubSubEngine {
  private readonly client = new PubSub()
  private readonly subscriptions = new SubscriptionTracker()
  private readonly topicName: string

  constructor(
    public readonly config: Readonly<GooglePubSubConfig>
  ) {
    super()
    this.topicName = `projects/${this.config.projectId}/topics/${this.config.topicId}`
  }

  /**
   * Start a subscription
   * @param subscriptionId
   * Note: this is NOT the full subscriptionName (i.e. should not follow the pattern "projects/{project}/subscriptions/{subscription}")
   * Must start with a letter, and contain only letters ([A-Za-z]), numbers ([0-9]), dashes (-), underscores (_),
   * periods (.), tildes (~), plus (+) or percent signs (%). It must be between 3 and 255 characters in length,
   * and it must not start with "goog"
   * @param onMessage
   * @returns
   */
  async subscribe(subscriptionId: string, onMessage: Function): Promise<number> {
    const subscriptionName = this.getSubscriptionName(subscriptionId)
    const subscription = await this.getSubscription(subscriptionName)
    const subscriptionNumber = this.subscriptions.getSubscriptionNumber(subscriptionName)
    if (!subscriptionNumber) throw new Error('subscriptionNumber was unexpectedly falsy')
    subscription.on('message', (message: Message) => {
      message.ack()
      try {
        const data = JSON.parse(message.data.toString())
        onMessage(data)
      } catch (err) {
        console.error(err)
      }
    })
    subscription.on('error', err => {
      console.error(err)
      this.endSubscription(subscriptionNumber, subscription)
    })
    return subscriptionNumber
  }

  unsubscribe(subscriptionNumber: number) {
    const subscription = this.subscriptions.get(subscriptionNumber)
    if (!subscription) throw new Error('There is no subscription with that number')
    this.endSubscription(subscriptionNumber, subscription)
  }

  /**
   * Subscribe to the (already provided) topic
   * @param subscriptionIds see {@link GooglePubSub.subscribe} for the meaning of `subscriptionId`
   */
  asyncIterator<T>(subscriptionIds: string[]): AsyncIterator<T> {
    return super.asyncIterator(subscriptionIds)
  }

  /**
   * Publish a new message.
   * Attributes are automatically calculated based on the payload keys and values (values are converted to `string` via interpolation).
   * For best results, ensure your payload values can be accurately converted to `string`
   * @param _triggerName THIS PARAMETER IS NOT USED. Specify a topic in {@link GooglePubSub} constructor
   * @param payload whatever you want to send
   */
  async publish(_triggerName: string, payload: { [k: string]: any }): Promise<void> {
    const topic = this.client.topic(this.topicName)
    const attributes: { [key: string]: string } = {}
    Object.entries(payload).forEach(([key, value]) => attributes[key] = `${value}`)
    await topic.publishMessage({
      json: payload,
      attributes,
      orderingKey: this.config.orderingKey
    })
  }

  private getSubscriptionName(subscriptionId: string): string {
    return `projects/${this.config.projectId}/subscriptions/${subscriptionId}`
  }

  private async getSubscription(subscriptionName: string): Promise<Subscription> {
    const savedSubscription = this.subscriptions.get(subscriptionName)
    if (savedSubscription) return savedSubscription
    const topic = this.client.topic(this.topicName)
    const subscription = topic.subscription(subscriptionName)
    const [exists] = await subscription.exists()
    if (exists) {
      const subscriptionIsNotBeingTracked = !this.subscriptions.get(subscription.name)
      if (subscriptionIsNotBeingTracked) this.subscriptions.add(subscription)
      return subscription
    }
    return await this.createSubscription(subscriptionName)
  }

  private async createSubscription(subscriptionName: string): Promise<Subscription> {
    const [subscription] = await this.client.createSubscription(this.topicName, subscriptionName, {
      labels: this.config.labels,
      enableMessageOrdering: !!this.config.orderingKey,
      expirationPolicy: { ttl: { seconds: this.config.messageExpirationSeconds || 24 * 60 * 60 } },
      filter: this.config.filter ? this.convertFilterToString(this.config.filter) : undefined
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

  private endSubscription(subscriptionNumber: number, subscription: Subscription): void {
    subscription.close()
    subscription.delete()
    this.subscriptions.unlink(subscriptionNumber)
  }
}
