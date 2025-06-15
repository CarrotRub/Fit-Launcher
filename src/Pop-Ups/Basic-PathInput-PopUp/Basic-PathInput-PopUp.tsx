import { createSignal } from "solid-js";
import PopupModal from "../../components/Popup-Modal/PopupModal";
import { open } from "@tauri-apps/plugin-dialog";
import "./Basic-PathInput-PopUp.css";
import Button from "../../components/UI/Button/Button";

const BasicPathInputPopup = (props: PopupPathInputProps<[string]>) => {
    const [currentPath, setCurrentPath] = createSignal("");
    const [isOpen, setIsOpen] = createSignal(true);

    const closePopup = () => setIsOpen(false);

    const openFileDialog = async () => {
        try {
            const chosenPath = await open({
                directory: props.isDirectory,
                multiple: props.multipleFiles,
                filters: [{ name: props.fileType[0], extensions: props.fileType }],
                defaultPath: props.defaultPath,
            });
            if (chosenPath) setCurrentPath(chosenPath);
        } catch (error) {
            console.error("Error opening dialog:", error);
        }
    };

    return (
        <PopupModal isOpen={isOpen()} onClose={closePopup}>
            <div class="popup-content">
                <div class="popup-text-title">
                    <p class="popup-main-title">{props.infoTitle || "Fill the input :)"}</p>
                </div>

                <div class="popup-text-container">
                    <p innerHTML={props.infoMessage}></p>
                </div>

                <div class="popup-path-input-container">
                    <label class="popup-input-label">
                        <input
                            class="popup-path-input"
                            placeholder={props.infoPlaceholder}
                            style={{ "font-size": "14px" }}
                            value={currentPath()}
                            onInput={(e) => setCurrentPath(e.target.value)}
                        />
                        <button onClick={openFileDialog}>Browse</button>
                    </label>
                </div>

                <div class="popup-footer-container">
                    {props.infoFooter ||
                        "If you have any issues with this, try to close and open the app. If it still persists, please contact us on Discord or GitHub."}
                </div>

                <div class="popup-buttons">
                    <Button id="popup-cancel-button" onClick={closePopup} label="Cancel" />
                    <Button
                        id="popup-confirm-button"
                        onClick={async () => {
                            if (props.action && currentPath()) {
                                await props.action?.(currentPath());
                            }
                            closePopup();
                        }}
                        label="Confirm"
                    />
                </div>
            </div>
        </PopupModal>
    );
};

export default BasicPathInputPopup;
