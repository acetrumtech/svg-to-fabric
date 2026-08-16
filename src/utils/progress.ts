import type { ConversionPhase, ConversionProgress } from '../types/options.js';

/** Share of the run each phase is treated as taking, for a smooth `ratio`. */
const PHASE_FLOOR: Record<ConversionPhase, number> = {
  parsing: 0,
  sanitizing: 0.05,
  building: 0.1,
  converting: 0.2,
  done: 1,
};

/** Element conversion owns everything between `converting` and `done`. */
const CONVERT_SPAN = 0.8;

/**
 * Emits progress without ever going backwards.
 *
 * A monotonic `ratio` matters more than an accurate one: a progress bar that
 * jumps back reads as a bug, and the phases genuinely cannot be weighed in
 * advance — an SVG of 4 paths and one of 40 000 are not in a fixed proportion.
 */
export class ProgressReporter {
  private currentPhase: ConversionPhase = 'parsing';
  private completed = 0;
  private total = 0;
  private lastRatio = 0;

  constructor(private readonly listener?: ((progress: ConversionProgress) => void) | undefined) {}

  get enabled(): boolean {
    return this.listener !== undefined;
  }

  phase(phase: ConversionPhase): void {
    this.currentPhase = phase;
    this.emit(PHASE_FLOOR[phase]);
  }

  begin(total: number): void {
    this.total = total;
  }

  layerDone(layerName: string): void {
    this.completed += 1;
    const share = this.total > 0 ? this.completed / this.total : 0;
    this.emit(PHASE_FLOOR.converting + share * CONVERT_SPAN, layerName);
  }

  private emit(ratio: number, layerName?: string): void {
    if (!this.listener) return;
    this.lastRatio = Math.min(1, Math.max(this.lastRatio, ratio));
    this.listener({
      phase: this.currentPhase,
      completed: this.completed,
      total: this.total,
      ratio: this.lastRatio,
      ...(layerName === undefined ? {} : { layerName }),
    });
  }
}
