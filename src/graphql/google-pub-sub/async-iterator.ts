import { Message } from '@google-cloud/pubsub'
import { $$asyncIterator } from 'iterall'
import { firstValueFrom, Observable, of } from 'rxjs'
import { shareReplay, switchMap, take, takeWhile } from 'rxjs/operators'
import { GooglePubSub, GooglePubSubSubscribeOptions } from '.'

type ReactiveDoubleEndedQueueConsumer<T> = (value: T) => void
class ReactiveDoubleEndedQueue<T> {
  private consumersWaitingForValues: ReactiveDoubleEndedQueueConsumer<T>[] = []
  private valuesWaitingToBeConsumed: T[] = []
  private acceptingValues = true

  /**
   * Supply a value asynchronously
   * @throws if you attempt to supply a value when the queue is no longer accepting values
   */
  supply(value: T): void {
    if (!this.isAcceptingValues()) {
      throw new Error('This queue is no longer accepting values')
    }
    const consumer = this.consumersWaitingForValues.shift()
    if (consumer) {
      // a consumer was immediately available
      consumer(value)
    } else {
      // post the value as available for future consumption
      this.valuesWaitingToBeConsumed.push(value)
    }
  }

  /**
   * Consume a value asynchronously
   * @throws if you attempt to consume a value when the queue is no longer accepting values
   */
  consume(consumer: ReactiveDoubleEndedQueueConsumer<T>): void {
    if (!this.isAcceptingValues()) {
      throw new Error('This queue is no longer accepting values')
    }
    const value = this.valuesWaitingToBeConsumed.shift()
    if (value) {
      // a value was immediately available
      consumer(value)
    } else {
      // add the consumer to the queue of consumers in need of a supplier
      this.consumersWaitingForValues.push(consumer)
    }
  }

  isAcceptingValues(): boolean {
    return this.acceptingValues
  }

  /**
   * Mark this queue as no longer accepting values & clear all values waiting to be consumed
   * @returns consumers waiting for values
   * @throws if the queue is already closed
   */
  close(): ReactiveDoubleEndedQueueConsumer<T>[] {
    if (!this.isAcceptingValues()) {
      throw new Error('This queue is already closed')
    }
    this.acceptingValues = false
    this.valuesWaitingToBeConsumed.length = 0
    return this.consumersWaitingForValues.splice(0, this.consumersWaitingForValues.length)
  }
}

/**
 * A separate instance should be used for separate subscribers.
 */
export class GooglePubSubAsyncIterator<T> implements AsyncIterator<T> {
  private subscriptionNumber$: Observable<number>
  private messageQueue: ReactiveDoubleEndedQueue<IteratorResult<T>>
  private isRunning: boolean

  constructor(
    private engine: GooglePubSub,
    private subscriptionId: string,
    options: GooglePubSubSubscribeOptions
  ) {
    this.isRunning = true
    this.subscriptionNumber$ = of(undefined).pipe(
      switchMap(() => this.engine.subscribe(this.subscriptionId, this.onMessageOrClose.bind(this), options)),
      shareReplay(1), // call subscribe() once, replay the value afterwards
      // complete the Observable once the next value is requested & the iterator no longer running
      // this frees up resources in case any other subscribers are listening but aren't processing input
      takeWhile(() => this.isRunning)
    )
    this.messageQueue = new ReactiveDoubleEndedQueue()
  }

  public [$$asyncIterator]() {
    return this
  }

  public async next(): Promise<IteratorResult<T>> {
    // get the subscription number (starts/joins a subscription if there is none already present)
    return await firstValueFrom(
      this.subscriptionNumber$.pipe(
        take(1),
        switchMap(_ => {
          return new Promise<IteratorResult<T>>(resolve => this.messageQueue.consume(resolve))
        })
      ),
      { defaultValue: { value: undefined, done: true } }
    )
  }

  public async return(): Promise<IteratorResult<T>> {
    await this.emptyMessageQueue()
    return { value: undefined, done: true }
  }

  public async throw(err: any): Promise<never> {
    await this.emptyMessageQueue()
    return Promise.reject(err)
  }

  private async onMessageOrClose(done: boolean, message?: Message): Promise<void> {
    if (done || !message) {
      return await this.emptyMessageQueue()
    }
    try {
      const data: T = JSON.parse(message.data.toString())
      this.messageQueue.supply(this.isRunning
        ? { value: data, done: false }
        : { value: undefined, done: true },
      )
      message.ack()
    } catch (err) {
      console.error(err)
      message.nack()
    }
  }

  private async emptyMessageQueue(): Promise<void> {
    if (!this.isRunning) return
    const subscriptionNumber = await firstValueFrom(this.subscriptionNumber$)
    this.isRunning = false
    const consumersWaitingForValues = this.messageQueue.close()
    consumersWaitingForValues.forEach(consumer => consumer({ value: undefined, done: true }))
    this.engine.unsubscribe(subscriptionNumber)
  }

}