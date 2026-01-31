export class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private spinAudio: HTMLAudioElement | null = null;
  private applauseAudio: HTMLAudioElement | null = null;

  constructor() {
    try {
      // Initialize AudioContext only on user interaction usually,
      // but we prepare the class here.
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContext();

      // Preload the spin sound audio file with cache-busting
      // Use timestamp to force reload on each dev server restart
      this.spinAudio = new Audio(`/spin-sound.mp3?v=${Date.now()}`);
      this.spinAudio.loop = true;
      this.spinAudio.volume = 0.3;

      // Preload applause sound with cache-busting
      this.applauseAudio = new Audio(`/applause.mp3?v=${Date.now()}`);
      this.applauseAudio.volume = 0.4;
    } catch (e) {
      console.error("Web Audio API not supported");
    }
  }

  public setMute(mute: boolean) {
    this.isMuted = mute;
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play a "tick" sound for the reel spinning/stopping
  public playTick() {
    if (this.isMuted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  // Play a looping "drum roll" or motor sound
  public playSpinSound(): HTMLAudioElement | null {
    if (this.isMuted || !this.spinAudio) return null;

    // Reset audio to start and play
    this.spinAudio.currentTime = 0;
    this.spinAudio.play().catch(error => {
      console.error("Error playing spin sound:", error);
    });

    return this.spinAudio;
  }

  // Stop the spin sound
  public stopSpinSound() {
    if (this.spinAudio) {
      this.spinAudio.pause();
      this.spinAudio.currentTime = 0;
    }
  }

  // Play a celebration fanfare - crowd cheer/applause sound
  public playWin() {
    if (this.isMuted || !this.applauseAudio) return;

    // Play applause sound from file
    this.applauseAudio.currentTime = 0;
    this.applauseAudio.play().catch(error => {
      console.error("Error playing applause sound:", error);
    });
  }
}

export const soundManager = new SoundManager();
