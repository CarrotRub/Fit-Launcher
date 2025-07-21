import { createSignal, onCleanup, onMount } from "solid-js";
import { listen } from "@tauri-apps/api/event";

type TauriDragDropEvent = {
    paths: string[];
    position: {
        x: number;
        y: number;
    };
};

export function useDropZone(onDrop: (paths: string[]) => void) {
    const [dragIn, setDragIn] = createSignal(false);
    let ref: HTMLDivElement | undefined;

    const checkHit = (x: number, y: number) =>
        ref && (ref === document.elementFromPoint(x, y) || ref.contains(document.elementFromPoint(x, y))) || false;

    onMount(() => {
        const unlistenDrop = listen<TauriDragDropEvent>("tauri://drag-drop", (e) => {
            const { x, y } = e.payload.position;
            if (checkHit(x, y)) {
                onDrop(e.payload.paths);
                setDragIn(false);
            }
        });

        const unlistenOver = listen<TauriDragDropEvent>("tauri://drag-over", (e) => {
            const { x, y } = e.payload.position;
            setDragIn(checkHit(x, y));
        });

        onCleanup(() => {
            unlistenDrop.then((unsub) => unsub());
            unlistenOver.then((unsub) => unsub());
        });
    });

    return {
        ref: (el: HTMLDivElement) => (ref = el),
        dragIn,
    };
}