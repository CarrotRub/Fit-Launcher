import { JSX } from "solid-js";
import { SettingsTypes } from "./types";
import {
  ButtonVariants,
  DropdownProps,
  IpAddressInputProps,
  NumericalInputProps,
  PathInputProps,
  RangeSliderProps,
  TextInputProps,
} from "../components/types";

export type PageGroupProps = {
  title: string;
  children: JSX.Element;
};
export type UnitType = "B" | "KB" | "MB";
export type SettingsLabelProps = {
  text: string;
  typeText?: string;
  action?: (...args: any[]) => void | Promise<void>;
};

export type SettingsDropdownLabelProps = SettingsLabelProps &
  DropdownProps & {
    variants?: ButtonVariants;
    disabled?: boolean;
  };

export type SettingsCheckboxLabelProps = SettingsLabelProps & {
  checked: boolean;
};

export type SettingsInputAddressLabelProps = SettingsLabelProps &
  IpAddressInputProps & {
    value: string;
  };

export type SettingsButtonLabelProps = SettingsLabelProps & {
  buttonLabel: string;
  disabled: boolean;
};

export type SettingsRangeLabelProps = SettingsLabelProps &
  RangeSliderProps &
  Omit<SettingsLabelProps, "action"> & {
    disabled: boolean;
  };

export type SettingsPathInputLabelProps = SettingsLabelProps & PathInputProps;

export type SettingsTextInputLabelProps = SettingsLabelProps &
  TextInputProps &
  Omit<SettingsLabelProps, "action"> & {
    value: string;
    disabled?: boolean;
  };

export type SettingsNumericalInputLabelProps = SettingsLabelProps &
  NumericalInputProps & {
    defaultUnitType?: UnitType;
    /**
     * Unit per Unit for e.g: MB/s
     *
     * so unitPerUnit = s
     */
    unitPerUnit?: string;
  };
