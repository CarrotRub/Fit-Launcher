import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { message } from "@tauri-apps/plugin-dialog";
import { showError } from "../../helpers/error";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";

import Searchbar from "../../components/Topbar-01/Topbar-Components-01/Searchbar-01/Searchbar";
import Button from "../../components/UI/Button/Button";
import { Modal } from "../Modal/Modal";
import { AddLocalGamePopupProps } from "../../types/popup";
import { ExecutableInfo, DownloadedGame } from "../../bindings";
import { GamesCacheApi } from "../../api/cache/api";
import { LibraryApi } from "../../api/library/api";

export default function createAddLocalGamePopup(props: AddLocalGamePopupProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const destroy = () => {
    render(() => null, container);
    container.remove();
  };

  const cache = new GamesCacheApi();
  const library = new LibraryApi();
  const [searchValue, setSearchValue] = createSignal("");

  const handleConfirm = async () => {
    const link = searchValue().trim();

    if (!link) {
      await message("Please provide a valid game link.", {
        title: "FitLauncher",
        kind: "warning",
      });
      return;
    }

    try {
      console.log(link)
      await cache.getSingularGameInfo(link)

      let gameResult = await cache.getSingularGameLocal(link);

      if (gameResult.status === "ok") {
        const newGame = library.gameToDownloadedGame(gameResult.data);
        await library.addDownloadedGame(newGame)

        if (props.action) await props.action(newGame);
      } else {
        await showError(gameResult.error.data, "Error");
      }

      await message("Game added to Library successfully", {
        title: "FitLauncher",
        kind: "info",
      });

    } catch (err) {
      await showError(err, "Error");
    } finally {
      destroy();
    }
  };

  render(
    () => (
      <Modal
        {...props}
        onClose={destroy}
        onConfirm={handleConfirm}
      >
        <div class="space-y-6">
          <Searchbar isTopBar={false} setSearchValue={setSearchValue} />
        </div>
      </Modal>
    ),
    container
  );
}
