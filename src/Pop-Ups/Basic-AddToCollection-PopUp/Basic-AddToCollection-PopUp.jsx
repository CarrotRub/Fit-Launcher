import { createSignal, For, onMount } from "solid-js";
import PopupModal from "../../components/Popup-Modal/PopupModal";
import { appDataDir, join } from "@tauri-apps/api/path";
import { message } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import Button from "../../components/UI/Button/Button";

const appDir = await appDataDir();

async function userCollectionPath() {
    return await join(appDir, "library", "collections");
}

const BasicAddToCollectionPopup = ({ infoTitle, collectionsList, gameObjectInfo }) => {
    const [selectedCollections, setSelectedCollections] = createSignal([]);
    const [possibleCollections, setPossibleCollections] = createSignal([]);
    const [isOpen, setIsOpen] = createSignal(true);

    const closePopup = () => setIsOpen(false);

    const toggleCollection = (collectionName) => {
        setSelectedCollections((prev) =>
            prev.includes(collectionName)
                ? prev.filter((name) => name !== collectionName)
                : [...prev, collectionName]
        );
    };

    const addToCollectionFile = async () => {
        const collectionFolderPath = await userCollectionPath();

        for (const collectionName of selectedCollections()) {
            try {
                const jsonFullName = `${collectionName}.json`;
                const collectionFilePath = await join(collectionFolderPath, jsonFullName);

                const fileContent = await readTextFile(collectionFilePath);
                const currentData = JSON.parse(fileContent);

                const isDuplicate = currentData.some(
                    (item) => item.torrentExternInfo.title === gameObjectInfo.torrentExternInfo.title
                );

                if (!isDuplicate) {
                    currentData.push(gameObjectInfo);
                    await writeTextFile(collectionFilePath, JSON.stringify(currentData, null, 2));
                    await message("Your Game has been added correctly!", {
                        title: "Everything is good",
                        kind: "info",
                    });
                } else {
                    await message("The game already exists in the collection.", {
                        title: "FitLauncher Error",
                        kind: "warning",
                    });
                }
            } catch (error) {
                await message(`Error adding game to collection: ${error}`, {
                    title: "FitLauncher Error",
                    kind: "error",
                });
            }
        }

        closePopup();
    };

    onMount(() => {
        const filteredCollections = Object.entries(collectionsList)
            .filter(([key]) => key !== "downloaded_games" && key !== "games_to_download")
            .reduce((acc, [key, value]) => {
                acc[key] = value;
                return acc;
            }, {});
        setPossibleCollections(filteredCollections);
    });

    return (
        <PopupModal isOpen={isOpen} onClose={closePopup}>
            <div className="popup-content">
                <div className="popup-text-title">
                    <p className="popup-main-title">{infoTitle || "Please choose a collection :)"}</p>
                </div>
                <div className="popup-collection-container">
                    {possibleCollections() ? (
                        <For each={Object.keys(possibleCollections())}>
                            {(collectionKey) => (
                                <div className="popup-collection-item" key={collectionKey}>
                                    <li className="popup-category-list-item">
                                        {collectionKey.replace(/_/g, " ")}
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                checked={selectedCollections().includes(collectionKey)}
                                                onChange={() => toggleCollection(collectionKey)}
                                            />
                                            <span className="switch-slider round"></span>
                                        </label>
                                    </li>
                                </div>
                            )}
                        </For>
                    ) : (
                        <p>Nothing here...</p>
                    )}
                </div>
                <div className="popup-footer-container">
                    Select one or more collections to add your games to.
                </div>
                <div className="popup-buttons">
                    <Button id="popup-cancel-button" onClick={closePopup} label="Cancel" />
                    <Button
                        id="popup-confirm-button"
                        onClick={addToCollectionFile}
                        label="Confirm"
                    />
                </div>
            </div>
        </PopupModal>
    );
};

export default BasicAddToCollectionPopup;
