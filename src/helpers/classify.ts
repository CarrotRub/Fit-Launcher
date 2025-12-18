import { DebridFile, FileInfo } from "../bindings";
import { DirectLinkWrapper } from "../types/download";
import { toTitleCaseExceptions } from "./format";

const languageMap: Record<string, string> = {
  arabic: "Arabic",
  bengali: "Bengali",
  brazilian: "Brazilian",
  bulgarian: "Bulgarian",
  catalan: "Catalan",
  chinese: "Chinese",
  croatian: "Croatian",
  czech: "Czech",
  danish: "Danish",
  dutch: "Dutch",
  estonian: "Estonian",
  filipino: "Filipino",
  finnish: "Finnish",
  french: "French",
  german: "German",
  greek: "Greek",
  hebrew: "Hebrew",
  hindi: "Hindi",
  hungarian: "Hungarian",
  indonesian: "Indonesian",
  italian: "Italian",
  japanese: "Japanese",
  korean: "Korean",
  latvian: "Latvian",
  lithuanian: "Lithuanian",
  malay: "Malay",
  mexican: "Mexican",
  nepali: "Nepali",
  norwegian: "Norwegian",
  polish: "Polish",
  portuguese: "Portuguese",
  romanian: "Romanian",
  russian: "Russian",
  serbian: "Serbian",
  slovak: "Slovak",
  spanish: "Spanish",
  swahili: "Swahili",
  swedish: "Swedish",
  tamil: "Tamil",
  thai: "Thai",
  turkish: "Turkish",
  ukrainian: "Ukrainian",
  vietnamese: "Vietnamese",
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
    Main: [] as DirectLinkWrapper[],
    Others: [] as DirectLinkWrapper[],
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

export type LabeledDebridFile = DebridFile & { displayName: string };

export function classifyDebridFiles(files: DebridFile[]) {
  const result = {
    Languages: [] as LabeledDebridFile[],
    Main: [] as LabeledDebridFile[],
    Others: [] as LabeledDebridFile[],
    Parts: [] as LabeledDebridFile[],
  };

  for (const file of files) {
    const baseName = file.short_name || file.name;
    const lower = baseName.toLowerCase();
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
      const label = baseName
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
      baseName.match(/\.0+1$|\.rar$|\.zip$/i) ||
      lower.includes("fitgirl-repacks") ||
      lower.includes("--_")
    ) {
      const partMatch = baseName.match(/part(\d+)/i);
      result.Parts.push({
        ...file,
        displayName: partMatch
          ? `Part ${partMatch[1]}`
          : baseName.replace(/\.[^/.]+$/, ""),
      });
      continue;
    }

    if (lower.includes("setup") || lower.includes("install")) {
      result.Main.push({ ...file, displayName: "Game Installer" });
      continue;
    }

    result.Main.push({
      ...file,
      displayName: baseName.replace(/\.[^/.]+$/, ""),
    });
  }

  return result;
}
