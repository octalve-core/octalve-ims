/**
 * Builds the walkthrough's two deliverables — one PDF, one continuous video
 * — from a completed run's four chapter directories plus Playwright's
 * `test-results/`. Run the four chapter specs first (see README.md); this
 * only assembles what they recorded.
 *
 * Usage: tsx tests/walkthrough/generate-deliverables.ts [runDir]
 * (wired as `pnpm walkthrough:deliverables`)
 */
import fs from "node:fs";
import path from "node:path";
import { generateWalkthroughPdf, type ChapterInput } from "./lib/generate-pdf";
import { generateWalkthroughVideo, type VideoChapterInput } from "./lib/generate-video";

const ROOT = path.resolve(__dirname, "..", "..");
const TEST_RESULTS_DIR = path.join(ROOT, "test-results");

const CHAPTERS = [
  { key: "chapter-a", title: "Chapter A — first screen and authentication", testResultsPrefix: "steps-chapter-a-" },
  { key: "chapter-b", title: "Chapter B — admin's first look (empty database)", testResultsPrefix: "steps-chapter-b-" },
  { key: "chapter-c", title: "Chapter C — people (user management)", testResultsPrefix: "steps-chapter-c-" },
  { key: "chapter-d", title: "Chapter D — catalog and stock (admin)", testResultsPrefix: "steps-chapter-d-" },
] as const;

const SCOPE_STATEMENT = {
  does: "This run exercises the full monorepo build (every feature, Premium behaviour) as a production build (next build / next start), against a new empty PostgreSQL database and local Redis, with no third-party service configured. It shows, for each role (admin, supplier, client, retailer), every screen reachable by clicking, including the empty, validation-error and populated states of every list and form, the role-scoped navigation, the order -> invoice -> payment -> review -> ticket lifecycle, user creation, CSV import/export, and session behaviour (sign-in, sign-out, silent refresh, rate limit, Back button after sign-out). Every step is a hard assertion made without database access, API calls, URL navigation, cookie edits or waits.",
  doesNot:
    "It does not prove: that direct-URL or direct-API access is blocked for the wrong role (a person cannot type a URL in this run; the static review covers that); that concurrent requests are safe (stock races, double payment); the behaviour of Stripe, Shippo, ImageKit, Brevo email, Google sign-in, AI providers, QStash or Sentry; anything that needs days of real time; the Core and Pro exports (only the full build is run); other browsers; or accessibility beyond what automated axe scans find.",
};

function findTestResultsDir(prefix: string): string {
  const entries = fs.readdirSync(TEST_RESULTS_DIR, { withFileTypes: true });
  const match = entries.find((e) => e.isDirectory() && e.name.startsWith(prefix));
  if (!match) {
    throw new Error(`No test-results directory starting with "${prefix}" found under ${TEST_RESULTS_DIR}`);
  }
  return path.join(TEST_RESULTS_DIR, match.name);
}

function main(): void {
  const runDir = path.resolve(process.argv[2] ?? path.join(ROOT, "out", "walkthrough-dev"));

  const pdfChapters: ChapterInput[] = [];
  const videoChapters: VideoChapterInput[] = [];

  for (const chapter of CHAPTERS) {
    const chapterDir = path.join(runDir, chapter.key);
    if (!fs.existsSync(path.join(chapterDir, "timeline.json"))) {
      throw new Error(`Missing ${chapterDir}/timeline.json — run that chapter's spec first`);
    }
    pdfChapters.push({ title: chapter.title, dir: chapterDir });

    const testResultsDir = findTestResultsDir(chapter.testResultsPrefix);
    const videoPath = path.join(testResultsDir, "video.webm");
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Missing ${videoPath} — Playwright didn't record this chapter's video`);
    }
    videoChapters.push({ title: chapter.title, timelineDir: chapterDir, videoPath });
  }

  const pdfOutFile = path.join(runDir, "walkthrough.pdf");
  console.log(`Building PDF -> ${pdfOutFile}`);
  generateWalkthroughPdf(pdfChapters, SCOPE_STATEMENT, pdfOutFile);

  const videoOutFile = path.join(runDir, "walkthrough.webm");
  console.log(`Building video -> ${videoOutFile}`);
  generateWalkthroughVideo(videoChapters, videoOutFile);

  console.log("Done.");
}

main();
