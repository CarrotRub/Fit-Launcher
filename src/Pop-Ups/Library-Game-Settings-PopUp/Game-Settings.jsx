import { createSignal, onMount } from "solid-js";
import PopupModal from "../../components/Popup-Modal/PopupModal";
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

    const clearExeTextInput = () => setCurrentPath("");
    const clearFolderTextInput = () => setCurrentFolderPath("");

    onMount(() => {
        let path_exe = userGame?.executableInfo?.executable_path || defaultPath;
        setCurrentPath(path_exe);
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

                <div className="popup-game-settings-container">
                    <p>Path to Executable:</p>
                    <label className="popup-input-label">
                        <input
                            className="popup-game-settings"
                            placeholder={infoPlaceholder}
                            style={{ fontSize: "14px" }}
                            value={currentPath()}
                            onInput={(e) => setCurrentPath(e.target.value)}
                        />
                    </label>
                    <svg
                        onClick={clearExeTextInput}
                        style={{ cursor: "pointer" }}
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="lucide lucide-eraser"
                    >
                        <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21m9 0H7M5 11l9 9" />
                    </svg>
                </div>

                <div className="popup-game-settings-container">
                    <p>
                        Path to Folder:{" "}
                        <small>
                            <i>
                                Sadly, for now, there is no way to get the game's size when adding a
                                local game :(
                            </i>
                        </small>
                    </p>
                </div>

                <div className="popup-footer-container">
                    {infoFooter ||
                        "If you have any issues with this, try to close and open the app. If it still persists, please contact us on Discord (link in the settings page) or on GitHub."}
                </div>

                <div className="popup-buttons">
                    <button id="popup-delete-button" onClick={handleDeleteGame}>
                        Delete
                    </button>
                    <button id="popup-cancel-button" onClick={closePopup}>
                        Cancel
                    </button>
                    <button
                        id="popup-confirm-button"
                        onClick={() => {
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

export default GameSettingsLibraryPopUp;
