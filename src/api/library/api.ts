import {
  commands,
  DownloadedGame,
  ExecutableInfo,
  Game,
  GameCollection,
  InstallationInfo,
  Result,
} from "../../bindings";

export class LibraryApi {
  async getDownloadedGames(): Promise<DownloadedGame[]> {
    return await commands.getDownloadedGames();
  }
  async getCollectionsList(): Promise<GameCollection[]> {
    return await commands.getCollectionList();
  }
  async getGamesToDownload(): Promise<Game[]> {
    return await commands.getGamesToDownload();
  }

  async hasDownloadedGame(game: DownloadedGame): Promise<boolean> {
    const result = await commands.getDownloadedGames();
    if (result.includes(game)) {
      return true;
    }
    return false;
  }

  async addGameToCollection(
    collectionName: string,
    gameData: Game
  ): Promise<Result<null, string>> {
    return await commands.addGameToCollection(collectionName, gameData);
  }

  async createCollection(
    collectionName: string,
    gamesList: Game[] | null
  ): Promise<Result<null, string>> {
    return await commands.createCollection(collectionName, gamesList);
  }

  async addDownloadedGame(game: DownloadedGame): Promise<Result<null, string>> {
    return await commands.addDownloadedGame(game);
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

  downloadedGameToGame(game: DownloadedGame): Game {
    return {
      description: game.description,
      details: game.details,
      features: game.features,
      gameplay_features: game.gameplay_features,
      href: game.href,
      img: game.img,
      included_dlcs: game.included_dlcs,
      magnetlink: game.magnetlink,
      secondary_images: [],
      tag: game.tag,
      title: game.title,
    };
  }

  gameToDownloadedGame(game: Game): DownloadedGame {
    const executableInfo: ExecutableInfo = {
      executable_disk_size: 0,
      executable_installed_date: null,
      executable_last_opened_date: null,
      executable_path: "",
      executable_play_time: 0,
    };

    const installationInfo: InstallationInfo = {
      download_folder: "",
      file_list: [],
      output_folder: "",
    };

    return {
      description: game.description,
      details: game.details,
      executable_info: executableInfo,
      features: game.features,
      gameplay_features: game.gameplay_features,
      href: game.href,
      img: game.img,
      included_dlcs: game.included_dlcs,
      installation_info: installationInfo,
      magnetlink: game.magnetlink,
      tag: game.tag,
      title: game.title,
    };
  }
}
