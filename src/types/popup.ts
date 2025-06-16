type PopupProps<T extends any[] = any[]> = {
  infoTitle: string;
  infoMessage?: string;
  infoFooter?: string;
  action?: (...args: T) => void | Promise<void>;
};

interface PopupPathInputProps<T extends any[] = any[]> extends PopupProps<T> {
  infoPlaceholder?: string;
  defaultPath?: string;
  fileType: string[];
  multipleFiles: boolean;
  isDirectory: boolean;
}

interface AddToCollectionProps<T extends any[] = any[]> extends PopupProps<T> {
  collectionsList: string[];
}
