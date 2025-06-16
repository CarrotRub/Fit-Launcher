import { SettingsTypes } from "./types";

export type SettingsLabelProps = {
  text: string;
  action?: (...args: any[]) => void | Promise<void>;
};

export type SettingsCheckboxLabelProps = SettingsLabelProps & {
  checked: boolean;
};
