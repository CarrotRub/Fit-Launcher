import { message } from "@tauri-apps/plugin-dialog";
import {
  commands,
  CustomError,
  DiscoveryGame,
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

  async getDiscoveryGames(): Promise<Result<DiscoveryGame[], ScrapingError>> {
    return await this.getCached("discovery", commands.getDiscoveryGames);
  }

  async getSingularGameLocal(
    url: string
  ): Promise<Result<Game, ScrapingError>> {
    let hash = await commands.hashUrl(url);
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

  async removeNSFW<T extends { tag?: string; game_tags?: string }>(
    gameList: T[]
  ): Promise<T[]> {
    let settingsInst = new GlobalSettingsApi();
    let nsfw = (await settingsInst.getGamehubSettings()).nsfw_censorship;
    if (nsfw) {
      return gameList.filter((game) =>
        typeof game.tag === "string"
          ? !game.tag.includes("Adult")
          : typeof game.game_tags === "string"
          ? !game.game_tags.includes("Adult")
          : true
      );
    } else {
      return gameList;
    }
  }

  async getNewlyAddedGamesPath(): Promise<string> {
    return await this.getCached(
      "newlyAddedPath",
      commands.getNewlyAddedGamesPath
    );
  }

  async getPopularGamesPath(): Promise<string> {
    return await this.getCached(
      "popularGamesPath",
      commands.getPopularGamesPath
    );
  }

  async getRecentlyUpdatedGamesPath(): Promise<string> {
    return await this.getCached(
      "recentlyUpdatedPath",
      commands.getRecentlyUpdatedGamesPath
    );
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
        this.cache.set(key, resultTyped);
      } else {
        await message(
          resultTyped.error.data.toString() ?? "An unknown error occurred.",
          { title: "Fetch Error", kind: "error" }
        );
      }
      return resultTyped;
    }

    this.cache.set(key, result);
    return result;
  }
}
