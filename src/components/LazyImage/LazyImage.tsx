import { createSignal, createEffect, Show, onCleanup } from "solid-js";

interface LazyImageProps {
    src: string;
    alt?: string;
    class?: string;
    style?: any;
    onLoad?: () => void;
    onError?: (e: Event) => void;
    maxRetries?: number;
    retryDelay?: number;
    objectFit?: 'cover' | 'contain' | 'fill';
    loadTimeout?: number;
}

export default function LazyImage(props: LazyImageProps) {
    const [loaded, setLoaded] = createSignal(false);
    const [currentSrc, setCurrentSrc] = createSignal(props.src);
    const [retryCount, setRetryCount] = createSignal(0);

    const maxRetries = props.maxRetries ?? 3;
    const baseDelay = props.retryDelay ?? 1000;
    const loadTimeout = props.loadTimeout ?? 15000;

    let retryTimeout: number | undefined;
    let loadTimeoutId: number | undefined;

    const startLoadTimeout = () => {
        clearTimeout(loadTimeoutId);
        loadTimeoutId = setTimeout(() => {
            if (!loaded()) {
                setLoaded(true);
                console.warn(`LazyImage: Timeout loading ${props.src}`);
            }
        }, loadTimeout);
    };

    createEffect(() => {
        if (props.src !== currentSrc()) {
            clearTimeout(retryTimeout);
            clearTimeout(loadTimeoutId);
            setLoaded(false);
            setRetryCount(0);
            setCurrentSrc(props.src);
        }
        startLoadTimeout();
    });

    onCleanup(() => {
        clearTimeout(retryTimeout);
        clearTimeout(loadTimeoutId);
    });

    const handleLoad = () => {
        clearTimeout(loadTimeoutId);
        setLoaded(true);
        setRetryCount(0);
        props.onLoad?.();
    };

    const handleError = (e: Event) => {
        const attempts = retryCount();
        if (attempts < maxRetries) {
            const delay = baseDelay * Math.pow(1.5, attempts);
            retryTimeout = setTimeout(() => {
                setRetryCount(attempts + 1);
                const sep = props.src.includes('?') ? '&' : '?';
                setCurrentSrc(`${props.src}${sep}_r=${attempts + 1}`);
                startLoadTimeout();
            }, delay);
        } else {
            clearTimeout(loadTimeoutId);
            setLoaded(true);
            props.onError?.(e);
        }
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
            <img
                src={currentSrc()}
                alt={props.alt ?? ""}
                class={`w-full h-full ${objectFitClass()} will-change-[opacity]`}
                style={{ opacity: loaded() ? 1 : 0, transition: 'opacity 0.15s ease-out' }}
                onLoad={handleLoad}
                onError={handleError}
                loading="lazy"
                decoding="async"
            />
        </div>
    );
}

