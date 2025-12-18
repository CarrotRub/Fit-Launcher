import { createSignal, Show } from "solid-js";
import PathInput from "../../components/UI/PathInput/PathInput";
import { PopupPathInputProps } from "../../types/popup";
import { Modal } from "../Modal/Modal";
import { render } from "solid-js/web";



export default function createPathInputPopup(props: PopupPathInputProps<[string]>) {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const destroy = () => {
        render(() => null, container);
        container.remove();
    };

    render(
        () => {
            const [textInputValue, setTextInputValue] = createSignal("");
            const closePopup = () => destroy();

            const handleConfirm = async () => {
                if (props.action) {
                    console.log("Text is", textInputValue())
                    await props.action(textInputValue());
                }
                closePopup();
            };

            return (
                <Modal {...props} onConfirm={handleConfirm} onClose={destroy}>
                    <div class="space-y-6">
                        <Show when={props.infoMessage}>
                            {props.infoMessage && (
                                <p class="text-sm text-muted" innerHTML={props.infoMessage}></p>
                            )}

                            <PathInput
                                onPathChange={(path) => setTextInputValue(path)}
                                value={textInputValue()}
                                {...props}
                            />
                        </Show>
                    </div>
                </Modal>
            );
        },
        container
    );
}

