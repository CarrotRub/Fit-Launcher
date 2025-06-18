import { JSX } from "solid-js";

export type ButtonVariants = "glass" | "solid" | "bordered";

export interface CheckboxProps {
  checked: boolean;
  action?: () => void | Promise<void>;
}

export interface DropdownProps {
  list: string[];
  activeItem?: string;
  onListChange: (item: string) => Promise<void>;
  onChange?: () => void;
  placeholder?: string;
  removableList?: string[];
  onRemove?: (item: string) => Promise<void> | void;
}

export interface ButtonProps {
  id?: string;
  class?: string;
  onClick: (e: MouseEvent) => void | Promise<void>;
  label: string | JSX.Element;
  disabled?: boolean;
  variant?: ButtonVariants;
  size?: "sm" | "md" | "lg";
  icon?: JSX.Element;
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
  placeholder?: string;
  initialPath?: string;
  isDirectory?: boolean;
  onPathChange?: (path: string, isValid: boolean) => void;
  isValidPath?: boolean;
  class?: string;
}

export interface PathTextProps {
  path: string;
  class?: string;
}

export interface NumericalInputProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onInput: (value: number) => void | Promise<void>;
  class?: string;
}

export interface IpAddressInputProps {
  value: string;
  onInput?: (value: number, ...args: any[]) => void | Promise<void>;
  disabled?: boolean;
}
