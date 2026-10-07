export const DEFAULT_VAPID_PUBLIC_KEY =
  "BP38BKIAvWW9C0mR9hwQ5Y8GjL7x8fU3lrPYPrU53eLNiWMEEjKhsC8UKBw0FiFCGI4VVZx38gKFrfrOf9mhIhQ";

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register("/sw.js", {
    updateViaCache: "none",
  });
  if (registration.active) return registration;

  const worker = registration.installing ?? registration.waiting;
  if (!worker) {
    throw new Error("The push service worker was registered without an active worker.");
  }

  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      window.clearTimeout(timeoutId);
      worker.removeEventListener("statechange", checkState);
      if (error) reject(error);
      else resolve();
    };

    const checkState = () => {
      if (registration.active) finish();
      else if (worker.state === "redundant") {
        finish(new Error("The push service worker failed to activate."));
      }
    };

    worker.addEventListener("statechange", checkState);
    const timeoutId = window.setTimeout(
      () => finish(new Error("The push service worker activation timed out.")),
      10_000,
    );
    checkState();
  });

  return registration;
}
