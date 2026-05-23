import { createRoot, createSignal } from "solid-js";
import { DM, Aria2StatusEvent, ManagerErrorEvent } from "../api/manager/api";

const RECENT_ERROR_MAX = 5;
const ERROR_TTL_MS = 10_000;

export const createManagerStatusStore = () => {
  const [status, setStatus] = createSignal<Aria2StatusEvent>(
    DM.getAria2Status()
  );
  const [recentErrors, setRecentErrors] = createSignal<ManagerErrorEvent[]>([]);

  DM.onAria2Status((s) => setStatus(s));

  DM.onError((err) => {
    setRecentErrors((prev) => [...prev.slice(-(RECENT_ERROR_MAX - 1)), err]);
    setTimeout(() => {
      setRecentErrors((prev) => prev.filter((e) => e !== err));
    }, ERROR_TTL_MS);
  });

  return {
    status,
    recentErrors,
    dismissError: (target: ManagerErrorEvent) => {
      setRecentErrors((prev) => prev.filter((e) => e !== target));
    },
  };
};

export const ManagerStatusStore = createRoot(createManagerStatusStore);
