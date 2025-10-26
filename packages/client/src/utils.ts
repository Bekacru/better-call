import { atom, batched, type ReadableAtom } from "nanostores";
import type { KeyInput, KeySelector, OnErrorRetry, QueryStore } from "./client";
import type { Key, KeyParts, NoKey, SomeKey } from "./types";

export function getNow() {
	return new Date().getTime();
}

export function isSomeKey(key: unknown): key is SomeKey {
	return typeof key === "string" || typeof key === "number" || key === true;
}

export function noop() {}

export function testKeyAgainstSelector(
	key: Key,
	selector: KeySelector,
): boolean {
	if (Array.isArray(selector)) {
		return selector.includes(key);
	} else if (typeof selector === "function") {
		return selector(key);
	}
	return key === selector;
}

/**
 * Transforming the input keys into a reactive store.
 * Basically creates a single store out of `['/api/v1/', $postId]`.
 */
export function getKeyStore(keys: KeyInput, querySymbol: Symbol) {
	if (isSomeKey(keys))
		return [atom(["" + keys, [keys] as SomeKey[]] as const), () => {}] as const;

	/*
  Idea is simple:
  1. we split incoming key array into parts. Every "stable" key (not an atom) gets there
  immediately and basically is immutable.
  2. all atom-based keys are fed into a `batched` store. We subscribe to it and push the
  values into appropriate indexes into `keyParts`.
  */
	const keyParts: (SomeKey | NoKey)[] = [];
	const $key = atom<[Key, KeyParts] | null>(null);

	const keysAsStoresToIndexes = new Map<
		ReadableAtom<SomeKey | NoKey> | QueryStore,
		number
	>();

	const setKeyStoreValue = () => {
		if (keyParts.some((v) => v === null || v === void 0 || v === false)) {
			$key.set(null);
		} else {
			$key.set([keyParts.join(""), keyParts as KeyParts]);
		}
	};

	for (let i = 0; i < keys.length; i++) {
		const keyOrStore = keys[i]!;
		if (isSomeKey(keyOrStore)) {
			keyParts.push(keyOrStore);
		} else {
			keyParts.push(null);
			keysAsStoresToIndexes.set(keyOrStore, i);
		}
	}

	const storesAsArray = [...keysAsStoresToIndexes.keys()];
	const $storeKeys = batched(storesAsArray, (...storeValues) => {
		for (let i = 0; i < storeValues.length; i++) {
			const store = storesAsArray[i]!;
			const partIndex = keysAsStoresToIndexes.get(store) as number;

			keyParts[partIndex] =
				(store as any)._ === querySymbol
					? store.value && "data" in (store as QueryStore).value!
						? (store as QueryStore).key
						: null
					: (storeValues[i] as SomeKey | NoKey);
		}

		setKeyStoreValue();
	});

	setKeyStoreValue();

	return [$key, $storeKeys.subscribe(noop)] as const;
}

/**
 * @see {@link https://github.com/vercel/swr/blob/0b3c2c757d9ce4f7e386a925f695adf93cf9065c/src/_internal/utils/config.ts#L29-L33}
 */
export const defaultOnErrorRetry = (({ retryAttempt, errorRetryInterval }) => {
	// Exponential backoff
	return (
		~~((Math.random() + 0.5) * (1 << (retryAttempt < 8 ? retryAttempt : 8))) *
		errorRetryInterval
	);
}) satisfies OnErrorRetry;
