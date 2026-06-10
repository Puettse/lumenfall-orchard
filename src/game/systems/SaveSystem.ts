type SaveData = {
  bestSeeds: number;
  bestTime: number | null;
  wins: number;
};

const storageKey = "lumenfall-orchard-save-v1";

export class SaveSystem {
  private data: SaveData = {
    bestSeeds: 0,
    bestTime: null,
    wins: 0
  };

  constructor() {
    this.load();
  }

  get snapshot(): SaveData {
    return { ...this.data };
  }

  recordSeeds(seedCount: number): void {
    if (seedCount <= this.data.bestSeeds) {
      return;
    }
    this.data.bestSeeds = seedCount;
    this.persist();
  }

  recordWin(timeSeconds: number, seedCount: number): void {
    this.data.wins += 1;
    this.data.bestSeeds = Math.max(this.data.bestSeeds, seedCount);
    if (this.data.bestTime === null || timeSeconds < this.data.bestTime) {
      this.data.bestTime = timeSeconds;
    }
    this.persist();
  }

  private load(): void {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return;
      }
      this.data = {
        ...this.data,
        ...JSON.parse(raw)
      };
    } catch {
      this.data = { bestSeeds: 0, bestTime: null, wins: 0 };
    }
  }

  private persist(): void {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(this.data));
    } catch {
      // WebView storage can be unavailable in restrictive test shells.
    }
  }
}
