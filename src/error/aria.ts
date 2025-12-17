import { Aria2Error } from "../bindings";

export class AriaError {
  static isRPCError(err: Aria2Error): err is { RPCError: string } {
    return typeof err === "object" && err !== null && "RPCError" in err;
  }

  static isInitializationFailed(err: Aria2Error): err is { InitializationFailed: string } {
    return typeof err === "object" && err !== null && "InitializationFailed" in err;
  }

  /**
   * Get a user-friendly error message from an Aria2Error
   */
  static getMessage(err: Aria2Error): string {
    if (err === "NotConfigured") {
      return "Download service is not configured. Please check your settings.";
    }
    if (AriaError.isInitializationFailed(err)) {
      const msg = err.InitializationFailed;
      if (msg.includes("BitTorrent port")) {
        return "Could not start download: BitTorrent ports are in use. Please close other torrent applications or restart your computer.";
      }
      if (msg.includes("port")) {
        return `Could not start download: ${msg}. Please check if another application is using the required ports.`;
      }
      return `Could not start download: ${msg}`;
    }
    if (AriaError.isRPCError(err)) {
      return `Download service error: ${err.RPCError}`;
    }
    return "An unknown download error occurred.";
  }
}
