import type { PlatformCompat } from "./client";

const browserSubscribe = (name: string, fn: () => void) => {
	const isServer = typeof window === "undefined";
	if (!isServer && window.addEventListener) {
		window.addEventListener(name, fn);
	}
};

export const browserPlatform: PlatformCompat = {
	isAppVisible: () => !document.hidden,
	visibilityChangeSubscribe: (cb) => browserSubscribe("visibilitychange", cb),
	reconnectChangeSubscribe: (cb) => browserSubscribe("online", cb),
};
