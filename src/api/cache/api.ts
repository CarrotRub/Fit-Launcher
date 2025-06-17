import { message } from "@tauri-apps/plugin-dialog";
import {
  commands,
  DiscoveryGame,
  Game,
  Result,
  ScrapingError,
} from "../../bindings";

class GamesCacheAPI {
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

  /** Retrieve, cache and return the result of the fetcher function */
  private async getCached<T>(
    key: string,
    fetcher: () => Promise<Result<T, ScrapingError>>
  ): Promise<Result<T, ScrapingError>> {
    const cached = this.cache.get(key);
    if (cached) {
      return cached as Result<T, ScrapingError>;
    }

    const result = await fetcher();

    if (result.status === "ok") {
      this.cache.set(key, result);
    } else {
      await message(
        result.error.data.toString() ??
          "An unknown error occurred while fetching data.",
        {
          title: "Fetch Error",
          kind: "error",
        }
      );
    }

    return result;
  }
}
