export const defaultThemes = [
  "Default Dark Purple",
  "Forest Dark Green",
  "Ocean Dark Blue",
  "Dark Orange Mead",
  "Desert Light Beige",
  "Le Beau Cyan",
] as const;

export type DefaultTheme = (typeof defaultThemes)[number];
