import { JSX } from "solid-js";
import { DownloadedGame, Game, GameCollection } from "../bindings";
import {
  ButtonVariants,
  PathInputProps,
  TextInputProps,
} from "./components/types";

export type PopupTypeVariant = "warning" | "error" | "success" | "info";

export type PopupProps<T extends unknown[] = []> = {
  infoTitle: string;
  infoMessage?: string;
  infoFooter?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  action?: (...args: T) => void | Promise<void>;
  onConfirm?: () => void | Promise<void>;
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
  };

export type AddLocalGamePopUpProps<T extends any[] = any[]> = PopupProps<T> &
  Omit<PopupProps, "action"> & {
    action?: (game: DownloadedGame) => void | Promise<void>;
  };
