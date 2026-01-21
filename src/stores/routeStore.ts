import { createStore } from "solid-js/store";

export const [routeHistory, setRouteHistory] = createStore<string[]>([]);
