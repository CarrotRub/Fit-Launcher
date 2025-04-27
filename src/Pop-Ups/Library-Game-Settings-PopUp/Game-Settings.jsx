import { createSignal, onMount } from "solid-js";
import PopupModal from "../../components/Popup-Modal/PopupModal";
import Button from "../../components/UI/Button/Button";
import PathInput from "../../components/UI/PathInput/PathInput";
import "./Game-Settings.css";

const GameSettingsLibraryPopUp = ({
    infoTitle,
    infoMessage,
    infoPlaceholder,
    defaultPath,
    fileType,
    multipleFiles,
    isDirectory,
    infoFooter,
    userGame,
}) => {
    const [currentPath, setCurrentPath] = createSignal("");
    const [currentFolderPath, setCurrentFolderPath] = createSignal("");
    const [isOpen, setIsOpen] = createSignal(true);

    const closePopup = () => setIsOpen(false);

    onMount(() => {
        const pathExe = userGame?.executableInfo?.executable_path || defaultPath;
        setCurrentPath(pathExe);
        setCurrentFolderPath(userGame?.torrentOutputFolder?.replace(" [FitGirl Repacks]", ""));
    });

    const handleDeleteGame = async () => {
        const confirmation = await confirm(
            "This will only delete the files from the library, not the game's files. You will need to do that manually. Are you sure?",
            { title: "Tauri", kind: "warning" }
        );

        if (confirmation) {
            // Logic to delete the game from the library
            closePopup();
            window.location.reload();
        }
    };

    return (
        <PopupModal isOpen={isOpen} onClose={closePopup}>
            <div className="popup-content" style={{ justifyContent: "space-between" }}>
                <div className="popup-text-title">
                    <p className="popup-main-title">{infoTitle || "Fill the input :)"}</p>
                </div>

                <div className="popup-text-container">
                    <p innerHTML={infoMessage}></p>
                </div>

                <div className="popup-input-container">
                    <div className="popup-game-settings-container" style={{ display: "flex", flexDirection: "column", width: "100%", gap: "1rem" }}>
                        <div className="popup-game-settings-input-container" >
                            <div>
                                <p>Executable:</p>
                                <PathInput
                                    placeholder={infoPlaceholder || "Enter the path to the executable"}
                                    initialPath={currentPath()}
                                    isDirectory={false}
                                    onPathChange={(path) => setCurrentPath(path)}
                                />
                            </div>
                            <div>
                                <p>Folder:</p>
                                <PathInput
                                    placeholder="Enter the path to the folder"
                                    initialPath={currentFolderPath()}
                                    isDirectory={true}
                                    onPathChange={(path) => setCurrentFolderPath(path)}
                                />
                                <small>
                                    <i>
                                        Sadly, for now, there is no way to get the game's size when adding a
                                        local game :(
                                    </i>
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="popup-footer-container">
                    {infoFooter ||
                        "If you have any issues with this, try to close and open the app. If it still persists, please contact us on Discord (link in the settings page) or on GitHub."}
                </div>

                <div className="popup-buttons">
                    <Button id="popup-delete-button" onClick={handleDeleteGame} label="Delete Game" />
                    <Button id="popup-cancel-button" onClick={closePopup} label="Cancel" />
                    <Button
                        id="popup-confirm-button"
                        onClick={() => {
                            closePopup();
                        }}
                        label="Confirm"
                    />
                </div>
            </div>
        </PopupModal>
    );
};

export default GameSettingsLibraryPopUp;
