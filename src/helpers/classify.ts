import { FileInfo } from "../bindings";
import { DirectLinkWrapper } from "../types/download";
import { toTitleCaseExceptions } from "./format";

const languageMap: Record<string, string> = {
  chinese: "Chinese",
  brazilian: "Brazilian",
  mexican: "Mexican",
  french: "French",
  german: "German",
  japanese: "Japanese",
  russian: "Russian",
  spanish: "Spanish",
  arabic: "Arabic",
  italian: "Italian",
  portuguese: "Portuguese",
  dutch: "Dutch",
  korean: "Korean",
  hindi: "Hindi",
  turkish: "Turkish",
  swedish: "Swedish",
  greek: "Greek",
  polish: "Polish",
  hebrew: "Hebrew",
  norwegian: "Norwegian",
  danish: "Danish",
  finnish: "Finnish",
  swahili: "Swahili",
  bengali: "Bengali",
  vietnamese: "Vietnamese",
  tamil: "Tamil",
  malay: "Malay",
  thai: "Thai",
  czech: "Czech",
  filipino: "Filipino",
  ukrainian: "Ukrainian",
  hungarian: "Hungarian",
  romanian: "Romanian",
  indonesian: "Indonesian",
  slovak: "Slovak",
  serbian: "Serbian",
  bulgarian: "Bulgarian",
  catalan: "Catalan",
  croatian: "Croatian",
  nepali: "Nepali",
  estonian: "Estonian",
  latvian: "Latvian",
  lithuanian: "Lithuanian",
};

export function classifyTorrentFiles(files: FileInfo[]) {
  const Languages: Record<string, string> = {};
  const Others: Record<string, string> = {};
  const Uncategorized: string[] = [];

  for (const file of files) {
    const lower = file.file_name.toLowerCase();
    const matchedLanguage = Object.keys(languageMap).find((l) =>
      lower.includes(l)
    );

    if (matchedLanguage) {
      let label = `${languageMap[matchedLanguage]} Language`;
      if (lower.includes("vo")) label += " VO";
      Languages[file.file_name] = label;
      continue;
    }

    if (
      lower.includes("optional") ||
      lower.includes("selective") ||
      /fg-optional-/i.test(lower)
    ) {
      const label = file.file_name
        .replace(/fg-optional-|optional-|selective-/gi, "")
        .replace(/\..*$/, "")
        .replace(/[-_.]/g, " ")
        .trim();
      Others[file.file_name] = label || file.file_name;
      continue;
    }

    Uncategorized.push(file.file_name);
  }

  return { Languages, Others, Uncategorized };
}

export function classifyDdlFiles(files: DirectLinkWrapper[]) {
  const result = {
    Languages: [] as DirectLinkWrapper[],
    Others: [] as DirectLinkWrapper[],
    Main: [] as DirectLinkWrapper[],
    Parts: [] as DirectLinkWrapper[],
  };

  for (const file of files) {
    const lower = file.filename.toLowerCase();
    const matchedLanguage = Object.keys(languageMap).find((l) =>
      lower.includes(l)
    );

    if (matchedLanguage) {
      let displayName = `${languageMap[matchedLanguage]} Language`;
      if (lower.includes("vo")) displayName += " VO";
      result.Languages.push({ ...file, displayName });
      continue;
    }

    if (
      lower.includes("optional") ||
      lower.includes("selective") ||
      /fg-optional-/i.test(lower)
    ) {
      const label = file.filename
        .replace(/fg-optional-|optional-|selective-/gi, "")
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_.]/g, " ")
        .trim();
      result.Others.push({
        ...file,
        displayName: toTitleCaseExceptions(label || "Optional Content"),
      });
      continue;
    }

    if (
      lower.includes("part") ||
      file.filename.match(/\.0+1$|\.rar$|\.zip$/i) ||
      lower.includes("fitgirl-repacks") ||
      lower.includes("--_")
    ) {
      // treat likely multi-part archives as Parts
      const partMatch = file.filename.match(/part(\d+)/i);
      result.Parts.push({
        ...file,
        displayName: partMatch
          ? `Part ${partMatch[1]}`
          : file.filename.replace(/\.[^/.]+$/, ""),
      });
      continue;
    }

    if (lower.includes("setup") || lower.includes("install")) {
      result.Main.push({ ...file, displayName: "Game Installer" });
      continue;
    }

    // fallback
    result.Main.push({
      ...file,
      displayName: file.filename.replace(/\.[^/.]+$/, ""),
    });
  }

  return result;
}
