import {
  commands,
  DownloadedGame,
  ExecutableInfo,
  Game,
  GameCollection,
  Result,
} from "../../bindings";

export class LibraryAPI {
  async getDownloadedGames(): Promise<DownloadedGame[]> {
    return await commands.getDownloadedGames();
  }
  async getCollectionsList(): Promise<GameCollection[]> {
    return await commands.getCollectionList();
  }
  async getGamesToDownload(): Promise<Game[]> {
    return await commands.getGamesToDownload();
  }
  async removeDownloadedGame(gameTitle: string): Promise<Result<null, string>> {
    return await commands.removeDownloadedGame(gameTitle);
  }
  async removeGameFromCollection(
    gameTitle: string,
    collectionName: string
  ): Promise<Result<null, string>> {
    return await commands.removeGameFromCollection(gameTitle, collectionName);
  }
  async removeGameToDownload(gameTitle: string): Promise<Result<null, string>> {
    return await commands.removeGameToDownload(gameTitle);
  }
  async removeCollection(
    collectionName: string
  ): Promise<Result<null, string>> {
    return await commands.removeCollection(collectionName);
  }
  async runExecutable(path: string): Promise<void> {
    return await commands.startExecutable(path);
  }
  async getExecutableInfo(
    pathToExe: string,
    pathToFolder: string
  ): Promise<ExecutableInfo | null> {
    return await commands.executableInfoDiscovery(pathToExe, pathToFolder);
  }
  async updateGameExecutableInfo(gameTitle: string, exec_info: ExecutableInfo) {
    return await commands.updateDownloadedGameExecutableInfo(
      gameTitle,
      exec_info
    );
  }
}
