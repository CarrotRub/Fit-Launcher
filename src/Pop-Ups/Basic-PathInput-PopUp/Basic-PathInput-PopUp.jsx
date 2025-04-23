import { createSignal } from "solid-js";
import PopupModal from "../../components/Popup-Modal/PopupModal";
import { open } from "@tauri-apps/plugin-dialog";
import "./Basic-PathInput-PopUp.css";

const BasicPathInputPopup = ({
    infoTitle,
    infoMessage,
    infoPlaceholder,
    defaultPath,
    fileType,
    multipleFiles,
    isDirectory,
    infoFooter,
    action,
}) => {
    const [currentPath, setCurrentPath] = createSignal("");
    const [isOpen, setIsOpen] = createSignal(true);

    const closePopup = () => setIsOpen(false);

    const openFileDialog = async () => {
        try {
            const chosenPath = await open({
                directory: isDirectory,
                multiple: multipleFiles,
                filters: [{ name: fileType[0], extensions: fileType }],
                defaultPath,
            });
            if (chosenPath) setCurrentPath(chosenPath);
        } catch (error) {
            console.error("Error opening dialog:", error);
        }
    };

    return (
        <PopupModal isOpen={isOpen()} onClose={closePopup}>
            <div className="popup-content">
                <div className="popup-text-title">
                    <p className="popup-main-title">{infoTitle || "Fill the input :)"}</p>
                </div>

                <div className="popup-text-container">
                    <p innerHTML={infoMessage}></p>
                </div>

                <div className="popup-path-input-container">
                    <label className="popup-input-label">
                        <input
                            className="popup-path-input"
                            placeholder={infoPlaceholder}
                            style={{ fontSize: "14px" }}
                            value={currentPath()}
                            onInput={(e) => setCurrentPath(e.target.value)}
                        />
                        <button onClick={openFileDialog}>Browse</button>
                    </label>
                </div>

                <div className="popup-footer-container">
                    {infoFooter ||
                        "If you have any issues with this, try to close and open the app. If it still persists, please contact us on Discord or GitHub."}
                </div>

                <div className="popup-buttons">
                    <button id="popup-cancel-button" onClick={closePopup}>
                        Cancel
                    </button>
                    <button
                        id="popup-confirm-button"
                        onClick={async () => {
                            if (action && currentPath()) {
                                await action(currentPath());
                            }
                            closePopup();
                        }}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </PopupModal>
    );
};

export default BasicPathInputPopup;
