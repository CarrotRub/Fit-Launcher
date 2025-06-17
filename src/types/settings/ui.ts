import { JSX } from "solid-js";
import { SettingsTypes } from "./types";

export type PageGroupProps = {
  title: string;
  children: JSX.Element;
};

export type SettingsLabelProps = {
  text: string;
  typeText?: string;
  action?: (...args: any[]) => void | Promise<void>;
};

export type SettingsCheckboxLabelProps = SettingsLabelProps & {
  checked: boolean;
};

export type SettingsInputAddressLabelProps = SettingsLabelProps & {
  value: string;
  disabled: boolean;
};

export type SettingsButtonLabelProps = SettingsLabelProps & {
  buttonLabel: string;
  disabled: boolean;
};
