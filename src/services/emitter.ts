export class FitEmitter {
  private listeners = new Map<string, Set<(...args: any[]) => void>>();

  on(event: string, fn: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }

  off(event: string, fn: (...args: any[]) => void) {
    this.listeners.get(event)?.delete(fn);
  }
}
