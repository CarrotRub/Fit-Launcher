import {
    createSignal,
    createEffect,
    Show,
    onCleanup,
    onMount,
    JSX
} from "solid-js";
import {
    observeVisibility,
    priorityFromEntry,
    queueImage
} from "../../services/imagesScheduler";
import { pageAbortController } from "../../App";
import { commands } from "../../bindings";

interface LazyImageProps {
    src: string;
    alt?: string;
    class?: string;
    style?: string | JSX.CSSProperties;
    objectFit?: "cover" | "contain" | "fill";
}

export default function LazyImage(props: LazyImageProps) {
    const [entry, setEntry] = createSignal<IntersectionObserverEntry | null>(null);
    const [loaded, setLoaded] = createSignal(false);
    const [currentSrc, setCurrentSrc] = createSignal<string>();
    const [currentUrl, setCurrentUrl] = createSignal<string>();

    let el!: HTMLDivElement;
    let abort = new AbortController();
    let unobserve: (() => void) | undefined;

    onMount(() => {
        unobserve = observeVisibility(el, (e) => {
            setEntry(e);
        });
    });

    createEffect(async () => {
        const e = entry();
        if (!e) return;
        if (loaded() && props.src == currentUrl()) return;

        setCurrentUrl(props.src);

        abort.abort();
        abort = new AbortController();
        if (e.isIntersecting) {
            // Try to use cached version immediately if visible or else it will cause some stutters
            const result = await commands.cachedDownloadImage(props.src);
            setCurrentSrc(result.status === "ok" ? result.data : props.src);
            setLoaded(true);
            return;
        }
        try {
            const priority = priorityFromEntry(e);

            const result = await queueImage(
                props.src,
                priority,
                mergeAbortSignals(abort.signal, pageAbortController.signal)
            );

            if (result.status === "ok") {
                setCurrentSrc(result.data);
            } else {
                setCurrentSrc(props.src);
            }
        } catch (err) {
            if (!abort.signal.aborted) {
                setCurrentSrc(props.src);
            }
            console.error("Error setting src: ", err)
        }
    });

    onCleanup(() => {
        abort.abort();
        unobserve?.();
    });

    const objectFitClass = () =>
        props.objectFit === "contain"
            ? "object-contain"
            : props.objectFit === "fill"
                ? "object-fill"
                : "object-cover";

    return (
        <div ref={el} class={`relative ${props.class ?? ""}`} style={props.style}>
            <Show when={!loaded()}>
                <div class="absolute inset-0 bg-secondary-20/40" />
            </Show>

            <Show when={currentSrc()}>
                <img
                    src={currentSrc()!}
                    alt={props.alt ?? ""}
                    class={`w-full h-full ${objectFitClass()}`}
                    onLoad={() => setLoaded(true)}
                    onError={() => setLoaded(true)}
                    decoding="async"
                />
            </Show>
        </div>
    );
}

function mergeAbortSignals(...signals: AbortSignal[]) {
    const ctrl = new AbortController();
    const listeners = signals.map(sig => {
        const fn = () => ctrl.abort();
        sig.addEventListener("abort", fn);
        return () => sig.removeEventListener("abort", fn);
    });
    if (signals.some(s => s.aborted)) ctrl.abort();
    onCleanup(() => listeners.forEach(remove => remove()));
    return ctrl.signal;
}
