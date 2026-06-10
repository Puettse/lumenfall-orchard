type Cue =
  | "start"
  | "jump"
  | "dash"
  | "collect"
  | "bell"
  | "hurt"
  | "checkpoint"
  | "gate"
  | "launch"
  | "secret"
  | "win"
  | "deny";

const cueMap: Record<Cue, { notes: number[]; duration: number; wave: OscillatorType }> = {
  start: { notes: [196, 294, 392], duration: 0.13, wave: "triangle" },
  jump: { notes: [330, 470], duration: 0.07, wave: "triangle" },
  dash: { notes: [180, 390, 620], duration: 0.06, wave: "triangle" },
  collect: { notes: [660, 880, 1320], duration: 0.06, wave: "triangle" },
  bell: { notes: [262, 392, 523, 784], duration: 0.22, wave: "sine" },
  hurt: { notes: [190, 120], duration: 0.12, wave: "square" },
  checkpoint: { notes: [330, 440, 660], duration: 0.16, wave: "triangle" },
  gate: { notes: [147, 220, 330, 494], duration: 0.18, wave: "triangle" },
  launch: { notes: [220, 440, 880], duration: 0.09, wave: "triangle" },
  secret: { notes: [523, 659, 784, 1047], duration: 0.1, wave: "sine" },
  win: { notes: [392, 494, 659, 988, 1319], duration: 0.22, wave: "triangle" },
  deny: { notes: [180, 145], duration: 0.08, wave: "triangle" }
};

export class AudioDirector {
  private context: AudioContext | null = null;
  private muted = false;
  private ambienceTimer = 0;
  private active = false;

  resume(): void {
    const context = this.getContext();
    this.active = true;
    if (context.state === "suspended") {
      void context.resume();
    }
  }

  setMuted(value: boolean): void {
    this.muted = value;
  }

  play(cue: Cue): void {
    if (this.muted) {
      return;
    }

    const profile = cueMap[cue];
    const context = this.getContext();
    profile.notes.forEach((note, index) => {
      const start = context.currentTime + index * profile.duration * 0.55;
      const end = start + profile.duration;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = profile.wave;
      oscillator.frequency.setValueAtTime(note, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(cue === "hurt" ? 0.12 : 0.075, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    });
  }

  update(dt: number): void {
    if (this.muted || !this.active || !this.context || this.context.state !== "running") {
      return;
    }
    this.ambienceTimer -= dt;
    if (this.ambienceTimer > 0) {
      return;
    }
    this.ambienceTimer = 9 + Math.random() * 7;
    const context = this.getContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.value = 74 + Math.random() * 18;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.008, now + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 4.4);
  }

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    return this.context;
  }
}
