import { Accessor, JSX } from "solid-js";
import { DownloadedGame, Game, GameCollection } from "../bindings";
import { PathInputProps, TextInputProps } from "./components/types";
import { GameDetails } from "./game";

export type DownloadType = "bittorrent" | "direct_download" | "realdebrid";
export type PopupTypeVariant = "warning" | "error" | "success" | "info";

export type PopupProps<T extends unknown[] = []> = {
  infoTitle: string;
  infoMessage?: string;
  infoFooter?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  action?: (...args: T) => void | Promise<void>;
  onConfirm?: () => void | Promise<void>;
  disabledConfirm?: Accessor<boolean>;
};

export type ModalPopupProps<T extends unknown[] = []> = PopupProps<T> & {
  children: JSX.Element;
  variant?: PopupTypeVariant;
  onClose?: (...args: T) => void | Promise<void>;
};

export type PopupPathInputProps<T extends any[] = any[]> = PathInputProps &
  PopupProps<T>;

export type PopupTextInputProps<T extends unknown[] = [string]> =
  PopupProps<T> & TextInputProps;

export type AddToCollectionProps<T extends any[] = any[]> = PopupProps<T> &
  Omit<PopupProps, "action"> & {
    gameObjectInfo: Game;
    action?: (addedTo: string[]) => void | Promise<void>;
    createCollection: () => void | Promise<void>;
  };

export type AddLocalGamePopupProps<T extends any[] = any[]> = PopupProps<T> &
  Omit<PopupProps, "action"> & {
    action?: (game: DownloadedGame) => void | Promise<void>;
  };

export type DownloadPopupProps<T extends any[] = any[]> = PopupProps<T> & {
  downloadedGame: DownloadedGame;
  gameDetails: GameDetails;
  downloadType: "bittorrent" | "direct_download" | "realdebrid";
  onFinish: () => void | Promise<void>;
};
