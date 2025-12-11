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
    let result = await commands.getDownloadedGames();
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
      title: game.title,
      img: game.img,
      details: game.details,
      features: game.features,
      description: game.description,
      gameplay_features: game.gameplay_features,
      included_dlcs: game.included_dlcs,
      magnetlink: game.magnetlink,
      href: game.href,
      tag: game.tag,
      secondary_images: [],
    };
  }

  gameToDownloadedGame(game: Game): DownloadedGame {
    const executableInfo: ExecutableInfo = {
      executable_path: "",
      executable_last_opened_date: null,
      executable_play_time: 0,
      executable_installed_date: null,
      executable_disk_size: 0,
    };

    const installationInfo: InstallationInfo = {
      output_folder: "",
      download_folder: "",
      file_list: [],
    };

    return {
      title: game.title,
      img: game.img,
      details: game.details,
      features: game.features,
      description: game.description,
      gameplay_features: game.gameplay_features,
      included_dlcs: game.included_dlcs,
      magnetlink: game.magnetlink,
      href: game.href,
      tag: game.tag,
      executable_info: executableInfo,
      installation_info: installationInfo,
    };
  }
}
