import { Show, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { Modal } from "../Modal/Modal";
import { CheckboxPopupProps } from "../../types/popup";
import CheckboxClassic from "../../components/UI/Checkbox/CheckboxClassic";

export default function createChoiceCheckboxPopup(props: CheckboxPopupProps) {
    const [checked, setChecked] = createSignal(props.defaultChecked ?? false);
    const container = createContainer();

    const cleanup = () => {
        render(() => null, container);
        container.remove();
    };

    const handleCancel = () => {
        if (checked()) {
            props.cancelAction?.();
        }
        cleanup();
    };

    const handleConfirm = () => {
        props.action?.(checked());
        cleanup();
    };

    render(
        () => (
            <Modal
                infoTitle={props.infoTitle}
                infoFooter={props.infoFooter}
                cancelLabel={props.cancelLabel}
                confirmLabel={props.confirmLabel}
                onConfirm={handleConfirm}
                onClose={handleCancel}
                cancelAction={handleCancel}
                disabledConfirm={props.disabledConfirm}
            >
                <div class="space-y-4">
                    <Show when={props.infoMessage}>
                        <div class="text-text">
                            <p innerHTML={props.infoMessage!}></p>
                        </div>
                    </Show>

                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <CheckboxClassic
                            checked={checked()}
                            action={(e) => { setChecked(e); }}
                        />
                        {props.checkboxLabel && (
                            <span class="text-sm text-text">
                                {props.checkboxLabel}
                            </span>
                        )}
                    </label>
                </div>
            </Modal>
        ),
        container
    );
}

function createContainer(): HTMLDivElement {
    const container = document.createElement("div");
    document.body.appendChild(container);
    return container;
}

