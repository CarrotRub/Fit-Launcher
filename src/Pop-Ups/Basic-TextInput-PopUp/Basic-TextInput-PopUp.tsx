import { createSignal, Show } from "solid-js";
import { Modal } from "../Modal/Modal";
import { PopupTextInputProps } from "../../types/popup";
import TextInput from "../../components/UI/TextInput/TextInput";
import { render } from "solid-js/web";

export default function createBasicTextInputPopup(props: PopupTextInputProps<[string]>) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const destroy = () => {
    render(() => null, container);
    container.remove();
  };

  render(() => {
    const [textInputValue, setTextInputValue] = createSignal("");

    const closePopup = () => destroy();

    const handleConfirm = async () => {
      if (props.action) {
        await props.action(textInputValue());
      }
      closePopup();
    };

    return (
      <Modal {...props} onConfirm={handleConfirm} onClose={closePopup}>
        <div class="space-y-4">
          {/* <Show when={props.infoMessage}>
            <p class="text-text" innerHTML={props.infoMessage!} />
          </Show> */}
          <TextInput value={textInputValue()} onInput={(e) => setTextInputValue(e.valueOf())} />
        </div>
      </Modal>
    );
  }, container);
}

