import { JSX, createSignal, Show, onMount, onCleanup } from "solid-js";
import { X, AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-solid";
import Button from "../../components/UI/Button/Button";
import { ModalPopupProps } from "../../types/popup";
import { render } from "solid-js/web";

export function Modal<T extends unknown[]>(props: ModalPopupProps<T>) {
    const [isOpen, setIsOpen] = createSignal(true);

    function closePopup(): void;
    function closePopup(...args: T): void;
    function closePopup(...args: T) {
        setIsOpen(false);
        props.onClose?.(...args);
    }


    const handleConfirm = async () => {
        if (props.onConfirm) {
            await props.onConfirm();
        }

        closePopup();
    };

    const getIcon = () => {
        switch (props.variant) {
            case "warning":
                return <AlertTriangle class="w-6 h-6 text-yellow-500" />;
            case "error":
                return <AlertCircle class="w-6 h-6 text-red-500" />;
            case "success":
                return <CheckCircle2 class="w-6 h-6 text-green-500" />;
            default:
                return <Info class="w-6 h-6 text-accent" />;
        }
    };

    // onMount(() => {
    //     const handleKeyDown = (e: KeyboardEvent) => {
    //         if (e.key === "Escape") {
    //             e.preventDefault();
    //             closePopup();
    //         } else if (e.key === "Enter") {
    //             e.preventDefault();
    //             handleConfirm();
    //         }
    //     };

    //     window.addEventListener("keydown", handleKeyDown);
    //     onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
    // });


    if (!isOpen()) return null;

    return (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div class="relative bg-popup-background rounded-xl shadow-2xl border border-secondary-20 max-w-md w-full mx-4  transition-all duration-300 transform">
                {/* Close Button */}
                <div class="w-full flex flex-row justify-end p-2">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            closePopup();
                        }}
                        class="p-1 rounded-full hover:bg-secondary-20 transition-colors duration-200 text-muted hover:text-text"
                    >
                        <X class="w-5 h-5" />
                    </button>
                </div>


                {/* Header */}
                <div class="px-6 pb-4">
                    <div class="flex items-start gap-3">
                        <div class="mt-0.5">{getIcon()}</div>
                        <div class="text-text">
                            <h3 class="text-xl font-bold text-text">{props.infoTitle}</h3>
                            <Show when={props.infoMessage}>
                                <div class="mt-2 text-muted">
                                    <p innerHTML={props.infoMessage!} class="text-sm leading-relaxed "></p>
                                </div>
                            </Show>
                        </div>
                    </div>
                </div>

                {/* Children Content */}
                {props.children && (
                    <div class="px-6 py-4 border-t border-secondary-20 text-text">{props.children}</div>
                )}

                {/* Footer */}
                <div class="px-6 py-3 bg-background-30 text-xs text-muted">
                    {props.infoFooter ||
                        "If you experience issues, restart the app or contact support."}
                </div>

                {/* Action Buttons */}
                <div class="flex justify-end gap-3 px-6 py-4 bg-popup">
                    <Button
                        id="popup-cancel-button"
                        onClick={closePopup}
                        label={props.cancelLabel || "Cancel"}
                        variant="glass"
                        class="hover:bg-secondary-20"
                    />
                    <Button
                        id="popup-confirm-button"
                        onClick={handleConfirm}
                        label={props.confirmLabel || "Confirm"}
                    />
                </div>
            </div>
        </div>
    );
}

export function createModal(props: Omit<Parameters<typeof Modal>[0], "onClose">) {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const destroy = () => {
        render(() => null, container);
        container.remove();
    };

    render(() => <Modal {...props} onClose={destroy} />, container);
}
