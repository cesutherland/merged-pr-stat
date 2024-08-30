import fs from "fs";
import { PullRequest } from "./entity";
import { uniq } from "underscore";
import { median as _median } from "mathjs";
import { fetchAllMergedPullRequests } from "./github";
import { parseISO, addMonths } from "date-fns";

interface StatCommandOptions {
  input: string | undefined;
  start: string | undefined;
  end: string | undefined;
  query: string | undefined;
}


function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function statCommand(options: StatCommandOptions): Promise<void> {
  let prs: PullRequest[] = [];

  let start = parseISO(options.start || '');
  let now = new Date();
  let end = addMonths(start, 1);
  let first = true;
  while (start < now) {
    if (options.query) {
      prs = await fetchAllMergedPullRequests(options.query, start.toISOString(), end.toISOString());
    } else if (options.input) {
      prs = createPullRequestsByLog(options.input);
    } else {
      console.error("You must specify either --query or --input");
      process.exit(1);
    }

    let stats = createStat(prs, start.toISOString(), end.toISOString());
    if (first) {
      process.stdout.write(Object.keys(stats).join(',')+"\n");
    }
    process.stdout.write(Object.values(stats).join(',')+"\n");

    start = end;
    end = addMonths(start, 1);
    first = false;
    await sleep(5000);
  };
}

interface PullRequestStat {
  count: number;
  authorCount: number;
  additions: number;
  additionsAverage: number;
  additionsMedian: number;
  deletions: number;
  deletionsAverage: number;
  deletionsMedian: number;
  end: string,
  leadTimeSecondsAverage: number;
  leadTimeSecondsMedian: number;
  start: string,
  timeToMergeSecondsAverage: number;
  timeToMergeSecondsMedian: number;
  timeToMergeFromFirstReviewSecondsAverage: number;
  timeToMergeFromFirstReviewSecondsMedian: number;
}

export function createStat(prs: PullRequest[], start: string|undefined, end: string|undefined): PullRequestStat {
  const leadTimes = prs.map((pr) => pr.leadTimeSeconds);
  const timeToMerges = prs.map((pr) => pr.timeToMergeSeconds);
  const timeToMergeFromFirstReviews = prs
    .map((pr) => pr.timeToMergeFromFirstReviewSeconds)
    .filter((x): x is number => x !== undefined);

  return {
    count: prs.length,
    authorCount: uniq(prs.map((pr) => pr.author)).length,
    additions: sum(prs.map((pr) => pr.additions)),
    additionsAverage: average(prs.map((pr) => pr.additions)),
    additionsMedian: median(prs.map((pr) => pr.additions)),
    deletions: sum(prs.map((pr) => pr.deletions)),
    deletionsAverage: average(prs.map((pr) => pr.deletions)),
    deletionsMedian: median(prs.map((pr) => pr.deletions)),
    end: end || "",
    leadTimeSecondsAverage: Math.floor(average(leadTimes)),
    leadTimeSecondsMedian: Math.floor(median(leadTimes)),
    start: start || "",
    timeToMergeSecondsAverage: Math.floor(average(timeToMerges)),
    timeToMergeSecondsMedian: Math.floor(median(timeToMerges)),
    timeToMergeFromFirstReviewSecondsAverage: Math.floor(average(timeToMergeFromFirstReviews)),
    timeToMergeFromFirstReviewSecondsMedian: Math.floor(median(timeToMergeFromFirstReviews)),
  };
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((prev, current) => prev + current) / numbers.length;
}

function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return _median(numbers);
}

function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}

export function createPullRequestsByLog(path: string): PullRequest[] {
  const logs = JSON.parse(fs.readFileSync(path, "utf8"));
  return logs.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) =>
      new PullRequest(
        p.title,
        p.author,
        p.url,
        p.createdAt,
        p.mergedAt,
        p.additions,
        p.deletions,
        p.authoredDate,
        p.firstReviewedAt
      )
  );
}
