export const defaultThemes = [
  "Blue Cyan",
  "Dark Purple",
  "Forest Dark Green",
  "Ocean Dark Blue",
  "Dark Orange Mead",
  "Desert Light Beige",
  "Gnome Dark",
  "Gnome Light",
] as const;

export type DefaultTheme = (typeof defaultThemes)[number];
