import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import type { TimelineStep } from "./timeline";

/** One chapter's recorded data, as written by `Timeline.writeJson`. */
export type ChapterInput = {
  /** e.g. "Chapter A — first screen and authentication" */
  title: string;
  /** Directory containing this chapter's timeline.json and screenshots/. */
  dir: string;
};

const PAGE_WIDTH = 1280;
const PAGE_HEIGHT = 820; // 720 for the screenshot + 100 for its caption bar
const MARGIN = 40;

function readTimeline(chapterDir: string): TimelineStep[] {
  const file = path.join(chapterDir, "timeline.json");
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw) as TimelineStep[];
}

function addCoverPage(doc: jsPDF, scopeStatement: { does: string; doesNot: string }, runDate: string): void {
  doc.setFontSize(28);
  doc.setTextColor(31, 41, 55);
  doc.text("Octalve IMS — Walkthrough", MARGIN, 90);

  doc.setFontSize(12);
  doc.setTextColor(107, 114, 128);
  doc.text(`Generated ${runDate}`, MARGIN, 120);

  doc.setFontSize(14);
  doc.setTextColor(31, 41, 55);
  doc.text("What this run shows", MARGIN, 165);
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  const doesLines = doc.splitTextToSize(scopeStatement.does, PAGE_WIDTH - MARGIN * 2);
  doc.text(doesLines, MARGIN, 185);

  const afterDoes = 185 + doesLines.length * 13 + 30;
  doc.setFontSize(14);
  doc.setTextColor(31, 41, 55);
  doc.text("What it does not prove", MARGIN, afterDoes);
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  const doesNotLines = doc.splitTextToSize(scopeStatement.doesNot, PAGE_WIDTH - MARGIN * 2);
  doc.text(doesNotLines, MARGIN, afterDoes + 20);
}

function addChapterDivider(doc: jsPDF, title: string): void {
  doc.addPage([PAGE_WIDTH, PAGE_HEIGHT], "landscape");
  doc.setFontSize(32);
  doc.setTextColor(31, 41, 55);
  doc.text(title, PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: "center" });
}

function addStepPage(doc: jsPDF, chapterDir: string, step: TimelineStep): void {
  doc.addPage([PAGE_WIDTH, PAGE_HEIGHT], "landscape");
  const imagePath = path.join(chapterDir, step.screenshot);
  if (fs.existsSync(imagePath)) {
    const imageData = fs.readFileSync(imagePath).toString("base64");
    doc.addImage(`data:image/png;base64,${imageData}`, "PNG", 0, 0, PAGE_WIDTH, 720);
  } else {
    doc.setFontSize(12);
    doc.setTextColor(239, 68, 68);
    doc.text(`Missing screenshot: ${step.screenshot}`, MARGIN, 360);
  }

  // Caption bar
  doc.setFillColor(31, 41, 55);
  doc.rect(0, 720, PAGE_WIDTH, 100, "F");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(`${step.id} — ${step.name}`, MARGIN, 752);
  if (step.covers.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(209, 213, 219);
    doc.text(`Covers: ${step.covers.join(", ")}`, MARGIN, 772);
  }
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text(`Role: ${step.role}`, PAGE_WIDTH - MARGIN, 752, { align: "right" });
}

/**
 * Builds one PDF across every chapter's recorded steps: a cover page (the
 * scope statement), a divider page per chapter, then one page per step with
 * its screenshot and caption. Every page's content comes straight from
 * timeline.json — nothing here is hand-written per run.
 */
export function generateWalkthroughPdf(
  chapters: ChapterInput[],
  scopeStatement: { does: string; doesNot: string },
  outFile: string,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [PAGE_WIDTH, PAGE_HEIGHT] });
  addCoverPage(doc, scopeStatement, new Date().toISOString().slice(0, 10));

  for (const chapter of chapters) {
    const steps = readTimeline(chapter.dir);
    addChapterDivider(doc, chapter.title);
    for (const step of steps) {
      addStepPage(doc, chapter.dir, step);
    }
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, Buffer.from(doc.output("arraybuffer")));
}
