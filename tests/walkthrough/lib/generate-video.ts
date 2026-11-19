import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { TimelineStep } from "./timeline";

/** One chapter's recorded data. */
export type VideoChapterInput = {
  /** e.g. "Chapter A — first screen and authentication" */
  title: string;
  /** Directory containing this chapter's timeline.json (written by `Timeline.writeJson`). */
  timelineDir: string;
  /** Path to this chapter's recorded video (Playwright writes it under test-results/, not timelineDir). */
  videoPath: string;
};

function probeDurationMs(file: string): number {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file],
    { encoding: "utf8" },
  );
  return Math.round(Number.parseFloat(out.trim()) * 1000);
}

function readTimeline(chapterDir: string): TimelineStep[] {
  const raw = fs.readFileSync(path.join(chapterDir, "timeline.json"), "utf8");
  return JSON.parse(raw) as TimelineStep[];
}

function toFfmetadataTimestamp(ms: number): string {
  // ffmetadata chapter TIMEBASE defaults to 1/1000, so a plain ms value works.
  return String(ms);
}

function buildChaptersMetadata(chapters: VideoChapterInput[], durationsMs: number[]): string {
  const lines = [";FFMETADATA1"];
  let offsetMs = 0;
  for (const [chapter, durationMs] of chapters.map((c, i) => [c, durationsMs[i]] as const)) {
    const steps = readTimeline(chapter.timelineDir);
    lines.push("", "[CHAPTER]", "TIMEBASE=1/1000", `START=${toFfmetadataTimestamp(offsetMs)}`);
    const chapterEndMs = offsetMs + (durationMs ?? 0);
    lines.push(`END=${toFfmetadataTimestamp(chapterEndMs)}`, `title=${chapter.title}`);
    for (const step of steps) {
      lines.push(
        "",
        "[CHAPTER]",
        "TIMEBASE=1/1000",
        `START=${toFfmetadataTimestamp(offsetMs + step.startMs)}`,
        `END=${toFfmetadataTimestamp(offsetMs + Math.max(step.endMs, step.startMs + 1))}`,
        `title=${step.id} — ${step.name}`,
      );
    }
    offsetMs = chapterEndMs;
  }
  return lines.join("\n");
}

/**
 * Concatenates every chapter's recorded video.webm into one continuous
 * video (stream copy, no re-encode) and embeds a chapter marker for every
 * chapter and every recorded step, offset by the cumulative duration of the
 * chapters before it.
 */
export function generateWalkthroughVideo(chapters: VideoChapterInput[], outFile: string): void {
  const videoPaths = chapters.map((c) => c.videoPath);
  for (const videoPath of videoPaths) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Missing chapter video: ${videoPath}`);
    }
  }

  const durationsMs = videoPaths.map(probeDurationMs);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "walkthrough-video-"));
  try {
    const concatListFile = path.join(workDir, "concat-list.txt");
    fs.writeFileSync(
      concatListFile,
      videoPaths.map((p) => `file '${path.resolve(p).replace(/'/g, "'\\''")}'`).join("\n"),
    );

    const concatenatedFile = path.join(workDir, "concatenated.webm");
    execFileSync("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListFile,
      "-c",
      "copy",
      concatenatedFile,
    ]);

    const metadataFile = path.join(workDir, "chapters.ffmetadata");
    fs.writeFileSync(metadataFile, buildChaptersMetadata(chapters, durationsMs));

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    execFileSync("ffmpeg", [
      "-y",
      "-i",
      concatenatedFile,
      "-i",
      metadataFile,
      "-map_metadata",
      "1",
      "-codec",
      "copy",
      outFile,
    ]);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
