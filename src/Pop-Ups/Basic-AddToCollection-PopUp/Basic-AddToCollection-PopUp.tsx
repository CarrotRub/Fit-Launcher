import { createSignal, For, onMount } from "solid-js";
import { message } from "@tauri-apps/plugin-dialog";
import Button from "../../components/UI/Button/Button";
import { AddToCollectionProps } from "../../types/popup";
import { Modal } from "../Modal/Modal";
import { LibraryAPI } from "../../api/library/api";
import LabelCheckboxSettings from "../../pages/Settings-01/Settings-Categories/Components/UI/LabelCheckbox/LabelCheckbox";
import { GameCollection } from "../../bindings";
import { render } from "solid-js/web";

const createAddToCollectionPopup = (props: AddToCollectionProps) => {
  const [selectedCollections, setSelectedCollections] = createSignal<string[]>([]);
  const [availableCollections, setAvailableCollections] = createSignal<GameCollection[]>([]);
  const api = new LibraryAPI();

  const container = document.createElement("div");
  document.body.appendChild(container);
  const destroy = () => {
    render(() => null, container);
    container.remove();
  };

  const toggleCollection = (collectionName: string) => {
    setSelectedCollections((prev) =>
      prev.includes(collectionName)
        ? prev.filter((name) => name !== collectionName)
        : [...prev, collectionName]
    );
  };

  const handleConfirm = async () => {
    const title = props.gameObjectInfo?.title;
    if (!title) return;

    const addedTo: string[] = [];

    for (const collectionName of selectedCollections()) {
      const result = await api.addGameToCollection(collectionName, props.gameObjectInfo);
      if (result.status === "ok") {
        addedTo.push(collectionName);
        await message(`Added to ${collectionName}`, { title: "Success", kind: "info" });
      } else {
        await message(result.error ?? "Unknown error", { title: "Error", kind: "error" });
      }
    }

    props.action?.(addedTo);
  };

  onMount(async () => {
    const allCollections = await api.getCollectionsList();
    const filtered = allCollections.filter(
      (c) => c.name !== "downloaded_games" && c.name !== "games_to_download"
    );
    setAvailableCollections(filtered);
  });

  render(

    () => (
      <Modal {...props} onConfirm={handleConfirm} onClose={destroy}>
        <div class="space-y-6">
          <For each={availableCollections()}>
            {(collection) => (
              <LabelCheckboxSettings
                text={collection.name.replace(/_/g, " ")}
                checked={selectedCollections().includes(collection.name)}
                action={() => toggleCollection(collection.name)}
              />
            )}
          </For>
        </div>
      </Modal>
    ),
    container
  );
};

export default createAddToCollectionPopup;
