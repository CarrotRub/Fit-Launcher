import { createEffect, createSignal, onMount } from "solid-js";
import './Basic-PathInput-PopUp.css'
import '../Download-PopUp/Download-PopUp.css'
import { open } from '@tauri-apps/plugin-dialog';

const BasicPathInputPopup = ({ infoTitle, infoMessage, infoPlaceholder, defaultPath, fileType, multipleFiles, isDirectory, infoFooter, action }) => {
    const [textInputValue, setTextInputValue] = createSignal("");
    const [isDialogOpen, setIsDialogOpen] = createSignal(false); // Lock for dialog state
    const [currentPath, setCurrentPath] = createSignal("")
    function closePopup() {
        const fullPopup = document.querySelector('.popup-pathinput-overlay');
        if (fullPopup) {
            fullPopup.remove();
        }
    }

    onMount(() => {
        console.log(infoMessage);
    });

    createEffect(() => {
        const labelElement = document.querySelector('.popup-input-label');

        if (labelElement) {
            const handleClick = async (event) => {
                if (isDialogOpen()) {
                    console.log("Dialog already open. Wait for it to close.");
                    return; // Prevent opening another dialog
                }

                console.log("dope");
                const rect = labelElement.getBoundingClientRect();
                const clickPosition = event.clientX;
                const iconBoundary = rect.right - 30;
                console.warn(defaultPath);

                if (clickPosition >= iconBoundary) {
                    setIsDialogOpen(true); // Lock the dialog state
                    try {
                        let chosenPath = await open({
                            directory: isDirectory,
                            multiple: multipleFiles,
                            filters: [{
                                name: fileType[0],
                                extensions: fileType
                            }],
                            defaultPath: defaultPath,
                        });
                        if (chosenPath) {
                            setCurrentPath(chosenPath)
                        }
                    } catch (error) {
                        console.error("Error opening dialog:", error);
                    } finally {
                        setIsDialogOpen(false); // Unlock the dialog state
                    }
                }
            };

            labelElement.addEventListener("click", handleClick);

            // Cleanup the listener to prevent duplication
            return () => {
                labelElement.removeEventListener("click", handleClick);
            };
        }
    });

    createEffect(() => {
        console.log(currentPath())
    })

    return (
        <div className="popup-pathinput-overlay">
            <div className="basic-pathinput-popup">
                <div className="popup-content">
                    <div className="popup-text-title">
                        <p className="popup-main-title">{infoTitle ? infoTitle : 'Fill the input :)'}</p>
                    </div>

                    <div className="popup-text-container">
                        <p innerHTML={infoMessage}></p>
                    </div>

                    <div className="popup-path-input-container">
                        <label className="popup-input-label">
                            <input
                                className="popup-path-input"
                                placeholder={infoPlaceholder}
                                style={{ fontSize: '14px' }}
                                value={currentPath()}
                                onInput={(e) => setCurrentPath(e.target.value)}
                            />
                        </label>
                    </div>

                    <div className="popup-footer-container">
                        {infoFooter ? infoFooter : 'If you have any issues with this, try to close and open the app. If it still persists, please contact us on Discord (link in the settings page) or on GitHub.'}
                    </div>
                </div>
                <div className="popup-buttons">
                    <button id="popup-cancel-button" onClick={closePopup}>Cancel</button>
                    <button id="popup-confirm-button"
                        onClick={async () => {
                            if (action != null && currentPath()) {
                                await action(currentPath());
                            }
                            closePopup();
                        }}
                    >Confirm</button>
                </div>
            </div>
        </div>
    );
};

export default BasicPathInputPopup;
