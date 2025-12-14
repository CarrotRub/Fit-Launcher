import { createSignal, createEffect, Show, onCleanup } from "solid-js";
import { commands } from "../../bindings";

const cachedDownloadImage = commands.cachedDownloadImage;

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

    const startLoadTimeout = () => {
        clearTimeout(loadTimeoutId);
        loadTimeoutId = setTimeout(() => {
            if (!loaded()) {
                console.warn(`LazyImage: Timeout loading ${props.src}`);
                setLoaded(true); // Stop showing placeholder even on timeout
            }
        }, loadTimeout);
    };

    // When src changes, reset state and load new image
    createEffect(async () => {
        if (props.src !== currentUrl()) {
            clearTimeout(loadTimeoutId);
            setLoaded(false);
            setCurrentSrc(undefined);

            setCurrentUrl(props.src);

            try {
                // Let the backend handle caching + any retries internally
                const result = await cachedDownloadImage(props.src);

                if (result.status == "ok") {
                    setCurrentSrc(result.data); // data URI from cache/backend
                } else {
                    // On any cache/download error, fall back to original src
                    // (backend couldn't provide it, so try direct load)
                    console.warn(`LazyImage: Cache failed for ${props.src}`, result.error);
                    setCurrentSrc(props.src);
                }
            } catch (err) {
                console.error(`LazyImage: Unexpected error fetching ${props.src}`, err);
                setCurrentSrc(props.src);
            }

            startLoadTimeout();
        }
    });

    onCleanup(() => {
        clearTimeout(loadTimeoutId);
    });

    const handleLoad = () => {
        clearTimeout(loadTimeoutId);
        setLoaded(true);
        props.onLoad?.();
    };

    const handleError = (e: Event) => {
        clearTimeout(loadTimeoutId);
        setLoaded(true); // Hide placeholder even on error
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
            {/* Placeholder overlay while loading */}
            <Show when={!loaded()}>
                <div class="absolute inset-0 bg-secondary-20/40" />
            </Show>

            {/* Only render img when we have a src */}
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