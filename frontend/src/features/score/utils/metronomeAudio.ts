import { getBeatClickProfile, type BeatStrengthLevel } from './beatStrength';

export class MetronomeAudio {
  private context: AudioContext | null = null;

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    return this.context;
  }

  playClick(strength: BeatStrengthLevel): void {
    const profile = getBeatClickProfile(strength);
    if (!profile) return;

    const audioContext = this.ensureContext();
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.connect(audioContext.destination);

    this.scheduleTone(
      audioContext,
      gain,
      now,
      profile.frequency,
      profile.oscillatorType,
      profile.peakGain,
      profile.durationSec,
    );

    if (profile.harmonicFrequency !== null && profile.harmonicGainRatio > 0) {
      this.scheduleTone(
        audioContext,
        gain,
        now,
        profile.harmonicFrequency,
        'sine',
        profile.peakGain * profile.harmonicGainRatio,
        profile.durationSec * 0.85,
      );
    }
  }

  private scheduleTone(
    audioContext: AudioContext,
    destination: GainNode,
    startTime: number,
    frequency: number,
    oscillatorType: OscillatorType,
    peakGain: number,
    durationSec: number,
  ): void {
    const oscillator = audioContext.createOscillator();
    const toneGain = audioContext.createGain();

    oscillator.type = oscillatorType;
    oscillator.frequency.value = frequency;

    toneGain.gain.setValueAtTime(peakGain, startTime);
    toneGain.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

    oscillator.connect(toneGain);
    toneGain.connect(destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + durationSec + 0.01);
  }

  dispose(): void {
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }
}
