/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSignal, createEffect, Show, onCleanup } from "solid-js";
import { commands } from "../../bindings";

const cachedDownloadImage = commands.cachedDownloadImage;

const inFlight = new Map<string, Promise<any>>();

function fetchCached(src: string): Promise<any> {
    if (inFlight.has(src)) {
        return inFlight.get(src)!;
    }

    const promise = cachedDownloadImage(src);
    inFlight.set(src, promise);
    promise.finally(() => inFlight.delete(src));

    return promise;
}

interface LazyImageProps {
    src: string;
    alt?: string;
    class?: string;
    style?: any;
    onLoad?: () => void;
    onError?: (e: Event) => void;
    objectFit?: 'cover' | 'contain' | 'fill';
    loadTimeout?: number;
}

export default function LazyImage(props: LazyImageProps) {
    const [loaded, setLoaded] = createSignal(false);
    const [currentSrc, setCurrentSrc] = createSignal<string | undefined>(undefined);
    const [currentUrl, setCurrentUrl] = createSignal<string | undefined>(undefined);

    const loadTimeout = props.loadTimeout ?? 15000;
    let loadTimeoutId: number | undefined;
    let fetchCancelled = false;

    createEffect(async () => {
        if (props.src !== currentUrl()) {
            clearTimeout(loadTimeoutId);
            fetchCancelled = false;
            setLoaded(false);
            setCurrentSrc(undefined);
            setCurrentUrl(props.src);

            loadTimeoutId = setTimeout(() => {
                if (!loaded()) {
                    console.warn(`LazyImage: Timeout loading ${props.src}`);
                    fetchCancelled = true;
                    setCurrentSrc(props.src);
                    setLoaded(true);
                }
            }, loadTimeout);

            try {
                const result = await fetchCached(props.src);

                if (fetchCancelled) return;

                if (result.status === "ok") {
                    setCurrentSrc(result.data);
                } else {
                    console.warn(`LazyImage: Cache failed for ${props.src}`, result.error || 'Unknown error');
                    setCurrentSrc(props.src);
                }
            } catch (err) {
                if (fetchCancelled) return;
                console.error(`LazyImage: Unexpected error fetching ${props.src}`, err);
                setCurrentSrc(props.src);
            }
        }
    });

    onCleanup(() => {
        clearTimeout(loadTimeoutId);
        fetchCancelled = true;
    });

    const handleLoad = () => {
        clearTimeout(loadTimeoutId);
        setLoaded(true);
        props.onLoad?.();
    };

    const handleError = (e: Event) => {
        clearTimeout(loadTimeoutId);
        setLoaded(true);
        props.onError?.(e);
    };

    const objectFitClass = () => {
        switch (props.objectFit) {
            case 'contain': return 'object-contain';
            case 'fill': return 'object-fill';
            default: return 'object-cover';
        }
    };

    return (
        <div class={`relative ${props.class ?? ""}`} style={props.style}>
            <Show when={!loaded()}>
                <div class="absolute inset-0 bg-secondary-20/40" />
            </Show>

            <Show when={currentSrc()}>
                <img
                    src={currentSrc()!}
                    alt={props.alt ?? ""}
                    class={`w-full h-full ${objectFitClass()} will-change-[opacity]`}
                    style={{ opacity: loaded() ? 1 : 0, transition: 'opacity 0.15s ease-out' }}
                    onLoad={handleLoad}
                    onError={handleError}
                    loading="lazy"
                    decoding="async"
                />
            </Show>
        </div>
    );
}