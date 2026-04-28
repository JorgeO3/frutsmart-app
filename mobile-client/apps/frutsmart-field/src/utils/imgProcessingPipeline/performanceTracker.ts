export abstract class PerformanceTracker {
  private static createLabel(name: string): string {
    return `[PERF] ${name}`;
  }

  static startTimer(name: string): void {
    console.time(PerformanceTracker.createLabel(name));
  }

  static endTimer(name: string): void {
    console.timeEnd(PerformanceTracker.createLabel(name));
  }
}
