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
}

export default function LazyImage(props: LazyImageProps) {
    const [loaded, setLoaded] = createSignal(false);
    const [currentSrc, setCurrentSrc] = createSignal(props.src);
    const [retryCount, setRetryCount] = createSignal(0);

    const maxRetries = props.maxRetries ?? 3;
    const baseDelay = props.retryDelay ?? 1000;

    let retryTimeout: number | undefined;

    // Reset on src change
    createEffect(() => {
        if (props.src !== currentSrc()) {
            clearTimeout(retryTimeout);
            setLoaded(false);
            setRetryCount(0);
            setCurrentSrc(props.src);
        }
    });

    onCleanup(() => clearTimeout(retryTimeout));

    const handleLoad = () => {
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
            }, delay);
        } else {
            setLoaded(true); // Give up, show nothing
            props.onError?.(e);
        }
    };

    return (
        <div class={`relative ${props.class ?? ""}`} style={props.style}>
            {/* Simple loading placeholder - no animation to save GPU */}
            <Show when={!loaded()}>
                <div class="absolute inset-0 bg-secondary-20/40" />
            </Show>

            {/* Image with GPU-accelerated opacity */}
            <img
                src={currentSrc()}
                alt={props.alt ?? ""}
                class="w-full h-full object-cover will-change-[opacity]"
                style={{ opacity: loaded() ? 1 : 0, transition: 'opacity 0.15s ease-out' }}
                onLoad={handleLoad}
                onError={handleError}
                loading="lazy"
                decoding="async"
            />
        </div>
    );
}
