import fs from "node:fs";
import path from "node:path";

/**
 * The one record the PDF captions, coverage ticks, chapters.vtt and
 * chapters.json are all generated from (template section 7.5). A tick in
 * the coverage matrix is never hand-edited — it only ever comes from a
 * `covers` entry here actually being recorded by a real step.
 */
export type TimelineStep = {
  id: string;
  chapter: string;
  role: string;
  name: string;
  /** Coverage row ids (coverage.<tier>.yaml) this step proves. */
  covers: string[];
  startMs: number;
  endMs: number;
  /** Path to this step's screenshot, relative to the run's output dir. */
  screenshot: string;
};

export class Timeline {
  private readonly steps: TimelineStep[] = [];
  private readonly runStartMs = Date.now();

  record(
    args: Omit<TimelineStep, "startMs" | "endMs" | "screenshot"> & {
      startMs: number;
      endMs: number;
      screenshot: string;
    },
  ): void {
    this.steps.push(args);
  }

  /** Convenience: times a step from `fn`'s start to its resolution. */
  async time<T>(
    meta: Omit<TimelineStep, "startMs" | "endMs" | "screenshot">,
    screenshot: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startMs = Date.now() - this.runStartMs;
    const result = await fn();
    const endMs = Date.now() - this.runStartMs;
    this.record({ ...meta, startMs, endMs, screenshot });
    return result;
  }

  all(): readonly TimelineStep[] {
    return this.steps;
  }

  /** Every coverage row id any step claims to cover, deduped. */
  coveredRowIds(): Set<string> {
    const ids = new Set<string>();
    for (const step of this.steps) for (const id of step.covers) ids.add(id);
    return ids;
  }

  writeJson(outFile: string): void {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(this.steps, null, 2));
  }

  /** WebVTT chapters derived 1:1 from the recorded steps. */
  writeVtt(outFile: string): void {
    const toTimestamp = (ms: number) => {
      const totalSeconds = Math.floor(ms / 1000);
      const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const ss = String(totalSeconds % 60).padStart(2, "0");
      const mmm = String(ms % 1000).padStart(3, "0");
      return `${hh}:${mm}:${ss}.${mmm}`;
    };

    const lines = ["WEBVTT", ""];
    for (const step of this.steps) {
      lines.push(`${toTimestamp(step.startMs)} --> ${toTimestamp(Math.max(step.endMs, step.startMs + 1))}`);
      lines.push(`${step.id} — ${step.name}`);
      lines.push("");
    }
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, lines.join("\n"));
  }

  writeChaptersJson(outFile: string): void {
    const chapters = this.steps.map((s) => ({
      id: s.id,
      title: s.name,
      startMs: s.startMs,
      endMs: s.endMs,
    }));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(chapters, null, 2));
  }
}
