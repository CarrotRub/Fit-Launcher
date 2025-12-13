import { DialogFilter } from "@tauri-apps/plugin-dialog";
import { JSX } from "solid-js";

export type ButtonVariants = "glass" | "solid" | "bordered";

export interface CheckboxProps {
  checked: boolean;
  action?: (...args: any[]) => void | Promise<void>;
}

export interface DropdownProps<T = string> {
  list: T[];
  activeItem?: T;
  onListChange: (item: T) => Promise<void>;
  placeholder?: string;
  removableList?: T[];
  onRemove?: (item: T) => Promise<void> | void;
  buttonClass?: string;
}

export interface ButtonProps {
  id?: string;
  class?: string;
  onClick: (e: MouseEvent) => any | Promise<any>;
  label?: string | JSX.Element;
  disabled?: boolean;
  variant?: "glass" | "solid" | "bordered";
  size?: "sm" | "md" | "lg";
  icon?: JSX.Element;
  notRounded?: boolean;
}

export interface RangeSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onInput: (value: number) => void;
  class?: string;
}

export interface PathInputProps {
  value?: string;
  placeholder?: string;
  initialPath?: string;
  isDirectory?: boolean;
  multipleFiles?: boolean;
  filters?: DialogFilter[];
  onPathChange?: (path: string, isValid: boolean) => void;
  isValidPath?: boolean;
  class?: string;
}

export interface TextInputProps {
  value: string;
  class?: string;
  placeholder?: string;
  disabled?: boolean;
  onInput?: (value: string) => void;
}

export interface NumericalInputProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  valueType?: string;
  onInput: (value: number) => void | Promise<void>;
  class?: string;
  unit?: boolean;
  isDirty?: boolean;
  savePulse?: boolean;
}

export interface IpAddressInputProps {
  value: string;
  action?: (e: InputEvent) => void | Promise<void>;
  disabled?: boolean;
  isDirty?: boolean;
  savePulse?: boolean;
}

export interface SliderProps {
  images: string[];
  titles: string[];
  hrefs: string[];
  filePath?: string;
}

export interface DualRangeSliderProps {
  min: number;
  max: number;
  minValue: number;
  maxValue: number;
  step?: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  onChangeComplete?: () => void;
  formatValue?: (value: number) => string;
  label?: string;
  class?: string;
}

export interface MultiSelectDropdownProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  class?: string;
}