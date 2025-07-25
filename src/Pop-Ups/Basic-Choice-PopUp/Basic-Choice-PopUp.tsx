import { Show } from "solid-js";
import Button from "../../components/UI/Button/Button";
import { ModalPopupProps, PopupProps } from "../../types/popup";
import { Modal } from "../Modal/Modal";
import { render } from "solid-js/web";

export default function createBasicChoicePopup(props: PopupProps) {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const destroy = () => {
        render(() => null, container);
        container.remove();
    };

    render(
        () => (
            <Modal
                {...props}
                onConfirm={async () => props.action?.()}
                onClose={destroy}
                disabledConfirm={props.disabledConfirm}
            >
                <div class="space-y-4">
                    <Show when={props.infoMessage}>
                        <div class="text-text">
                            <p innerHTML={props.infoMessage!}></p>
                        </div>
                    </Show>
                </div>
            </Modal>
        ),
        container
    );
}