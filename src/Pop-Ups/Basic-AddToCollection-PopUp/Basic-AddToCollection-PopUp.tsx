import { createSignal, For, onMount, Show } from "solid-js";
import { message } from "@tauri-apps/plugin-dialog";
import { showError } from "../../helpers/error";
import Button from "../../components/UI/Button/Button";
import { AddToCollectionProps } from "../../types/popup";
import { Modal } from "../Modal/Modal";
import { LibraryApi } from "../../api/library/api";
import LabelCheckboxSettings from "../../pages/Settings-01/Settings-Categories/Components/UI/LabelCheckbox/LabelCheckbox";
import { GameCollection } from "../../bindings";
import { render } from "solid-js/web";
import { FolderPlus, Plus } from "lucide-solid";

const createAddToCollectionPopup = (props: AddToCollectionProps) => {
  const [selectedCollections, setSelectedCollections] = createSignal<string[]>([]);
  const [availableCollections, setAvailableCollections] = createSignal<GameCollection[]>([]);
  const libraryApi = new LibraryApi();

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
      const result = await libraryApi.addGameToCollection(collectionName, props.gameObjectInfo);
      if (result.status === "ok") {
        addedTo.push(collectionName);
        await message(`Added to ${collectionName}`, { title: "Success", kind: "info" });
      } else {
        await showError(result.error ?? "Unknown error", "Error");
      }
    }

    props.action?.(addedTo);
  };

  onMount(async () => {
    const allCollections = await libraryApi.getCollectionsList();
    const filtered = allCollections.filter(
      (c) => c.name !== "downloaded_games" && c.name !== "games_to_download"
    );
    setAvailableCollections(filtered);
  });

  render(

    () => (
      <Modal {...props} onConfirm={handleConfirm} onClose={destroy}>
        <div class="space-y-6">
          <Show when={availableCollections().length > 0} fallback={
            <div class="flex flex-col items-center justify-center py-8 px-4 text-center">
              <div class="mb-4 flex flex-col items-center">
                <div class="w-16 h-16 mb-2 rounded-full flex items-center justify-center bg-secondary-20 border-2 border-dashed border-accent">
                  <FolderPlus class="w-8 h-8 text-accent" />
                </div>
                <h3 class="text-lg font-medium text-text">No Collections Found</h3>
                <p class="text-muted max-w-xs">
                  You don't have any collections yet. Create one to get started.
                </p>
              </div>
              <Button label="New Collection" onClick={() => { props.createCollection(); destroy() }} icon={<Plus class="w-5 h-5 transition-transform group-hover:rotate-90" />} />
            </div>
          }>
            <For each={availableCollections()}>
              {(collection) => (
                <LabelCheckboxSettings
                  text={collection.name.replace(/_/g, " ")}
                  checked={selectedCollections().includes(collection.name)}
                  action={() => toggleCollection(collection.name)}
                />
              )}
            </For>
          </Show>
        </div>
      </Modal>
    ),
    container
  );
};

export default createAddToCollectionPopup;
