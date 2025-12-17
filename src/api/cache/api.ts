import { message } from "@tauri-apps/plugin-dialog";
import { resolveError, showError } from "../../helpers/error";
import {
  commands,
  CustomError,
  Game,
  Result,
  ScrapingError,
} from "../../bindings";
import { GlobalSettingsApi } from "../settings/api";

export class GamesCacheApi {
  private cache = new Map<string, unknown>();

  async getNewlyAddedGames(): Promise<Result<Game[], ScrapingError>> {
    return await this.getCached("newlyAdded", commands.getNewlyAddedGames);
  }

  async getPopularGames(): Promise<Result<Game[], ScrapingError>> {
    return await this.getCached("popular", commands.getPopularGames);
  }

  async getRecentlyUpdatedGames(): Promise<Result<Game[], ScrapingError>> {
    return await this.getCached(
      "recentlyUpdated",
      commands.getRecentlyUpdatedGames
    );
  }

  async getDiscoveryGames(): Promise<Result<Game[], ScrapingError>> {
    return await this.getCached("discovery", commands.getDiscoveryGames);
  }

  async getSingularGameLocal(
    url: string
  ): Promise<Result<Game, ScrapingError>> {
    const hash = await commands.hashUrl(url);
    return await this.getCached(`singularGameLocal:${hash}`, () =>
      commands.getSingularGameLocal(url)
    );
  }

  async getSingularGameInfo(
    gameLink: string
  ): Promise<Result<null, ScrapingError>> {
    return commands.getSingularGameInfo(gameLink);
  }

  async getGameHash(url: string): Promise<number> {
    return await commands.hashUrl(url);
  }

  async getGameImages(
    gameLink: string
  ): Promise<Result<string[], CustomError>> {
    return await commands.getGamesImages(gameLink);
  }

  async removeNSFW<T extends { tag: string }>(gameList: T[]): Promise<T[]> {
    const nsfw =
      (await GlobalSettingsApi.getGamehubSettings()).nsfw_censorship ?? false;

    if (!nsfw) return gameList;

    const isNSFW = (text: unknown) =>
      typeof text === "string" && text.toLowerCase().includes("adult");

    return gameList.filter((game) => !isNSFW(game.tag));
  }

  /** Clear cached entries. If key is provided clears only that key. Otherwise clears all. */
  clearCache(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /** Retrieve, cache and return the result of the fetcher function */
  private async getCached<T>(
    key: string,
    fetcher: () => Promise<Result<T, ScrapingError>>
  ): Promise<Result<T, ScrapingError>>;

  /** Retrieve, cache and return the result of the fetcher function */
  private async getCached<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T>;

  /** Retrieve, cache and return the result of the fetcher function */
  private async getCached<T>(
    key: string,
    fetcher: () => Promise<T> | Promise<Result<T, ScrapingError>>
  ): Promise<T | Result<T, ScrapingError>> {
    const cached = this.cache.get(key);
    if (cached) {
      return cached as T | Result<T, ScrapingError>;
    }

    const result = await fetcher();

    // If the result is a Result object, check its status
    if (typeof result === "object" && result !== null && "status" in result) {
      const resultTyped = result as Result<T, ScrapingError>;
      if (resultTyped.status === "ok") {
        // Don't cache empty arrays as backend may still be populating data
        const data = resultTyped.data;
        const isEmpty = Array.isArray(data) && data.length === 0;
        if (!isEmpty) {
          this.cache.set(key, resultTyped);
        }
      } else {
        if (resultTyped.error.type !== "articleNotFound") {
          await showError(
            resultTyped.error.data,
            "Fetch Error"
          );
        } else {
          await showError("Article Not Found.", "Fetch Error");
        }
      }
      return resultTyped;
    }

    this.cache.set(key, result);
    return result;
  }
}
