import { routeHistory, setRouteHistory } from "../stores/routeStore";
import { MemoryHistoryWrapper } from "../types/router";

const MAX_ROUTER_HISTORY = 50;

export function initRouteObserver(history: MemoryHistoryWrapper) {
  history.listen((path) => {
    localStorage.setItem(
      "latestGlobalHref",
      routeHistory[routeHistory.length - 1],
    );

    if (!path.includes("/game/")) {
      setRouteHistory((prev) => {
        const next = [...prev, path];
        return next.length > MAX_ROUTER_HISTORY
          ? next.slice(-MAX_ROUTER_HISTORY)
          : next;
      });
    }
  });
}
