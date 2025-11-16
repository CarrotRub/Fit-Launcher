import { Aria2Error } from "../bindings";

export class AriaError {
  static isRPCError(err: Aria2Error): err is { RPCError: string } {
    return typeof err === "object" && err !== null && "RPCError" in err;
  }
}
