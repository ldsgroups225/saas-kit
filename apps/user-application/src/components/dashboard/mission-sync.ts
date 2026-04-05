const PENDING_UPDATES_STORAGE_KEY = "naf.field.pending-mission-updates";
const inMemoryStorage = new Map<string, string>();

type MissionUpdateKind = "status" | "proof";

export type PendingMissionUpdate = {
  id: string;
  missionId: string;
  kind: MissionUpdateKind;
  payload: Record<string, string>;
  createdAt: string;
};

type UpdateSender = (update: PendingMissionUpdate) => Promise<void>;

type StorageAdapter = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function getStorage(): StorageAdapter {
  if (typeof window === "undefined") {
    return {
      getItem: (key) => inMemoryStorage.get(key) ?? null,
      setItem: (key, value) => {
        inMemoryStorage.set(key, value);
      },
      removeItem: (key) => {
        inMemoryStorage.delete(key);
      },
    };
  }

  const browserStorage = window.localStorage as Partial<Storage>;
  if (
    typeof browserStorage.getItem === "function" &&
    typeof browserStorage.setItem === "function" &&
    typeof browserStorage.removeItem === "function"
  ) {
    return {
      getItem: (key) => browserStorage.getItem!(key),
      setItem: (key, value) => {
        browserStorage.setItem!(key, value);
      },
      removeItem: (key) => {
        browserStorage.removeItem!(key);
      },
    };
  }

  return {
    getItem: (key) => inMemoryStorage.get(key) ?? null,
    setItem: (key, value) => {
      inMemoryStorage.set(key, value);
    },
    removeItem: (key) => {
      inMemoryStorage.delete(key);
    },
  };
}

export function createMissionUpdate(
  missionId: string,
  kind: MissionUpdateKind,
  payload: Record<string, string>,
): PendingMissionUpdate {
  return {
    id: `${missionId}-${kind}-${Date.now()}`,
    missionId,
    kind,
    payload,
    createdAt: new Date().toISOString(),
  };
}

export function getPendingMissionUpdates(): Array<PendingMissionUpdate> {
  const storage = getStorage();

  const raw = storage.getItem(PENDING_UPDATES_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<PendingMissionUpdate>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function queueMissionUpdate(update: PendingMissionUpdate): void {
  const storage = getStorage();
  const pending = getPendingMissionUpdates();
  pending.push(update);
  storage.setItem(PENDING_UPDATES_STORAGE_KEY, JSON.stringify(pending));
}

export function clearPendingMissionUpdates(): void {
  const storage = getStorage();
  storage.removeItem(PENDING_UPDATES_STORAGE_KEY);
}

export async function flushPendingMissionUpdates(send: UpdateSender): Promise<{
  sent: number;
  failed: number;
}> {
  const storage = getStorage();
  const pending = getPendingMissionUpdates();
  if (pending.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const remaining: Array<PendingMissionUpdate> = [];
  let sent = 0;

  for (const update of pending) {
    try {
      await send(update);
      sent += 1;
    } catch {
      remaining.push(update);
    }
  }

  storage.setItem(PENDING_UPDATES_STORAGE_KEY, JSON.stringify(remaining));

  return {
    sent,
    failed: remaining.length,
  };
}
