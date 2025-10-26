/**
 * @see {@link https://github.com/ai/nanoevents}
 */

interface EventsMap {
	[event: string]: any;
}
interface DefaultEvents extends EventsMap {
	[event: string]: (...args: any) => void;
}
export type Unsubscriber = () => void;

export type Emitter<Events extends EventsMap = DefaultEvents> = {
	/**
	 * Calls each of the listeners registered for a given event.
	 *
	 * ```ts
	 * ee.emit("tick", tickType, tickDuration);
	 * ```
	 *
	 * @param event The event name.
	 * @param args The arguments for listeners.
	 */
	emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void;
	/**
	 * Event names in keys and arrays with listeners in values.
	 *
	 * ```ts
	 * emitter1.events = emitter2.events;
	 * emitter2.events = {};
	 * ```
	 */
	events: Partial<{ [E in keyof Events]: Events[E][] }>;
	/**
	 * Add a listener for a given event.
	 *
	 * ```js
	 * const unbind = ee.on('tick', (tickType, tickDuration) => {
	 *   count += 1
	 * })
	 *
	 * disable () {
	 *   unbind()
	 * }
	 * ```
	 *
	 * @param event The event name.
	 * @param cb The listener function.
	 * @returns Unbind listener from event.
	 */
	on<K extends keyof Events>(event: K, cb: Events[K]): Unsubscriber;
};
/**
 * An interface for mixins that expose the `on` function (without the emitter
 * bound to `this`)
 *
 * ```js
 * import { createNanoEvents } from 'nanoevents'
 *
 * class Ticker implements EmitterMixin<Events> {
 *   constructor() {
 *     this.emitter = createNanoEvents()
 *   }
 *   on(...args) {
 *     return this.emitter.on(...args)
 *   }
 *   tick() {
 *     this.emitter.emit('tick')
 *   }
 * }
 * ```
 */
export interface EmitterMixin<Events extends EventsMap = DefaultEvents> {
	on<K extends keyof Events>(event: K, cb: Events[K]): Unsubscriber;
}

export const createEvents = <
	Events extends EventsMap = DefaultEvents,
>(): Emitter<Events> => ({
	emit(event, ...args) {
		const callbacks = this.events[event] || [];
		for (const cb of callbacks) {
			cb();
		}
	},
	events: {},
	on(event, cb) {
		(this.events[event] ||= []).push(cb);
		return () => {
			this.events[event] = this.events[event]?.filter((i) => cb !== i);
		};
	},
});
