export const defaultThemes = [
  "Blue Cyan",
  "Dark Purple",
  "Forest Dark Green",
  "Ocean Dark Blue",
  "Dark Orange Mead",
  "Desert Light Beige",
] as const;

export type DefaultTheme = (typeof defaultThemes)[number];
