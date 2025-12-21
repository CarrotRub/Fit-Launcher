import {
  Accessor,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";
import { LibraryApi } from "../../../api/library/api";
import { GamesCacheApi } from "../../../api/cache/api";
import { listen } from "@tauri-apps/api/event";
import { commands, DownloadedGame } from "../../../bindings";
import * as Debrid from "../../../api/debrid/api";
import { useToast } from "solid-notifications";
import {
  extractCompany,
  extractLanguage,
  formatBytesToSize,
  parseGameSize,
} from "../../../helpers/gameFilters";
import { GameDetails } from "../../../types/game";

const library = new LibraryApi();
const cache = new GamesCacheApi();

export const useGameResource = (href: () => string) => {
  const fetcher = async (gameHref: string) => {
    if (!gameHref) return null;
    await cache.getSingularGameInfo(gameHref);
    const res = await cache.getSingularGameLocal(gameHref);
    return res.status === "ok" ? library.gameToDownloadedGame(res.data) : null;
  };

  const [game] = createResource(href, fetcher);
  return game;
};

export const useGameImages = (href: () => string) => {
  const [images, setImages] = createSignal<string[]>([]);
  let unlisten: (() => void) | null = null;

  createEffect(async () => {
    const h = href();
    if (!h) return;

    setImages([]);
    unlisten?.();

    const cached = await cache.getGameImages(h);
    if (cached.status === "ok") setImages(cached.data);

    unlisten = await listen<{ game_link: string; image_url: string }>(
      "game_images::image_ready",
      (e) => {
        if (e.payload.game_link === h) {
          setImages((prev) =>
            prev.includes(e.payload.image_url)
              ? prev
              : [...prev, e.payload.image_url]
          );
        }
      }
    );
  });

  onCleanup(() => unlisten?.());

  return images;
};

export const useDebridCache = (
  game: Accessor<DownloadedGame | null | undefined>
): Accessor<boolean> => {
  const [hasDebridCached, setHasDebridCached] = createSignal(false);

  createEffect(() => {
    const magnet = game()?.magnetlink;

    if (!magnet) {
      setHasDebridCached(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const hash = Debrid.extractHashFromMagnet(magnet);
        if (!hash || cancelled) return;

        const credInfo = await Debrid.listCredentials();
        if (cancelled || credInfo.status !== "ok") return;

        const configured = new Set(credInfo.data.configured_providers);

        const providers = await Debrid.listProviders();
        if (cancelled) return;

        const results = await Promise.all(
          providers
            .filter((p) => p.supports_cache_check && configured.has(p.id))
            .map(async (p) => {
              const res = await Debrid.checkCache(p.id, hash);
              return res.status === "ok" && res.data.is_cached;
            })
        );

        if (!cancelled) {
          setHasDebridCached(results.some(Boolean));
        }
      } catch {
        if (!cancelled) {
          setHasDebridCached(false);
        }
      }
    })();

    onCleanup(() => {
      cancelled = true;
    });
  });

  return hasDebridCached;
};

export type FavoritesSave = {
  isSaved: Accessor<boolean>;
  toggle: () => Promise<void>;
};

export const useFavorites = (
  game: Accessor<DownloadedGame | null | undefined>
): FavoritesSave => {
  const [isSaved, setIsSaved] = createSignal(false);
  const { notify } = useToast();

  // keeps state in sync with current game
  createEffect(async () => {
    const g = game();
    if (!g?.title) {
      setIsSaved(false);
      return;
    }

    try {
      const list = await library.getGamesToDownload();
      setIsSaved(list.some((item) => item.title === g.title));
    } catch {
      setIsSaved(false);
    }
  });

  const toggle = async () => {
    const g = game();
    if (!g) return;

    try {
      if (isSaved()) {
        await library.removeGameToDownload(g.title);
        setIsSaved(false);
        notify(`${g.title} removed from favorites`, { type: "success" });
      } else {
        await library.addGameToCollection(
          "games_to_download",
          library.downloadedGameToGame(g)
        );
        setIsSaved(true);
        notify(`${g.title} added to favorites`, { type: "success" });
      }
    } catch {
      notify("Error updating favorites", { type: "error" });
    }
  };

  return {
    isSaved,
    toggle,
  };
};

export const useGameDetails = (
  game: Accessor<DownloadedGame | null | undefined>
): Accessor<GameDetails> => {
  return createMemo<GameDetails>(() => {
    const description = game()?.details;

    if (!description) {
      return {
        companies: "N/A",
        language: "N/A",
        originalSize: "N/A",
        repackSize: "N/A",
        tags: "N/A",
      };
    }

    const originalBytes = parseGameSize(description, "original");
    const repackBytes = parseGameSize(description, "repack");
    const tagsMatch = description.match(/Genres\/Tags:\s*([^\n]+)/i);

    return {
      companies: extractCompany(description),
      language: extractLanguage(description),
      originalSize:
        originalBytes > 0 ? formatBytesToSize(originalBytes) : "N/A",
      repackSize: repackBytes > 0 ? formatBytesToSize(repackBytes) : "N/A",
      tags: tagsMatch?.[1]?.trim() ?? "N/A",
    };
  });
};

export const useGameDatabase = (
  game: Accessor<DownloadedGame | null | undefined>
): Accessor<DownloadedGame | null> => {
  const [downloadedGames] = createResource(async () => {
    return await commands.getDownloadedGames();
  });

  const foundGame = createMemo<DownloadedGame | null>(() => {
    const g = game();
    const list = downloadedGames();

    if (!g || !list) return null;

    return list.find((dg) => dg.href === g.href) ?? null;
  });

  return foundGame;
};
