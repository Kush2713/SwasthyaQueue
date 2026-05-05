const QUEUE_UPDATE_KEY = "sq_queue_updated_at";

export function publishQueueUpdate() {
  const stamp = String(Date.now());
  try {
    window.localStorage.setItem(QUEUE_UPDATE_KEY, stamp);
  } catch (_error) {
    // ignore storage errors (private mode / quota)
  }
  window.dispatchEvent(new CustomEvent("sq:queue-updated", { detail: { stamp } }));
}

export function subscribeQueueUpdates(onUpdate) {
  if (typeof onUpdate !== "function") return () => {};

  const handleCustomEvent = () => onUpdate();
  const handleStorageEvent = (event) => {
    if (event.key === QUEUE_UPDATE_KEY) onUpdate();
  };

  window.addEventListener("sq:queue-updated", handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener("sq:queue-updated", handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);
  };
}

