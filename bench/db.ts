import { Database } from "bun:sqlite";
import type { Puzzle } from "../visualizer/components/puzzles";
import { RERUN_THRESHOLD_DAYS } from "./constants";

// Database path
export const dbPath = new URL("./results.db", import.meta.url).pathname;

// Initialize SQLite database
export const db = new Database(dbPath);
db.run(`
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL,
    puzzle_id TEXT NOT NULL,
    size TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    correct INTEGER NOT NULL,
    status TEXT NOT NULL,
    duration_ms REAL NOT NULL,
    tokens INTEGER NOT NULL,
    cost REAL NOT NULL,
    error_message TEXT,
    UNIQUE(model, puzzle_id)
  );

  CREATE INDEX IF NOT EXISTS idx_runs_model_puzzle_id ON runs(model, puzzle_id);
  CREATE INDEX IF NOT EXISTS idx_runs_model_size ON runs(model, size);
  CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON runs(timestamp);
`);

// Result type for saving to DB
export type BenchmarkResult = {
	model: string;
	puzzleId: string;
	size: string;
	correct: boolean;
	cost: number;
	tokens: number;
	durationMs: number;
	status: "success" | "failed";
	errorMessage?: string;
};

// Generate a stable puzzle ID from the solution (hash)
export function getPuzzleId(puzzle: Puzzle): string {
	const hasher = new Bun.CryptoHasher("md5");
	hasher.update(puzzle.solution);
	return hasher.digest("hex").slice(0, 16); // Use first 16 chars of MD5
}

// Returns a map of model -> set of puzzle_ids that were recently benchmarked (within threshold)
// Only include successful runs ("status = 'success'"), so failed runs can be retried
export function getRecentPuzzlesByModel(): Map<string, Set<string>> {
	const thresholdDate = new Date();
	thresholdDate.setDate(thresholdDate.getDate() - RERUN_THRESHOLD_DAYS);
	const thresholdIso = thresholdDate.toISOString();

	const results = db
		.query<{ model: string; puzzle_id: string }, [string]>(
			`SELECT model, puzzle_id FROM runs WHERE timestamp > ? AND status = 'success'`,
		)
		.all(thresholdIso);

	const recentPuzzles = new Map<string, Set<string>>();
	for (const row of results) {
		if (!recentPuzzles.has(row.model)) {
			recentPuzzles.set(row.model, new Set());
		}
		recentPuzzles.get(row.model)!.add(row.puzzle_id);
	}

	return recentPuzzles;
}

// Prepared statement for inserting/replacing runs
const insertRunStmt = db.prepare(`
  INSERT OR REPLACE INTO runs (model, puzzle_id, size, timestamp, correct, status, duration_ms, tokens, cost, error_message)
  VALUES ($model, $puzzle_id, $size, $timestamp, $correct, $status, $duration_ms, $tokens, $cost, $error_message)
`);

// Save a single run to the database
export function saveRunToDb(result: BenchmarkResult): void {
	insertRunStmt.run({
		$model: result.model,
		$puzzle_id: result.puzzleId,
		$size: result.size,
		$timestamp: new Date().toISOString(),
		$correct: result.correct ? 1 : 0,
		$status: result.status,
		$duration_ms: result.durationMs,
		$tokens: result.tokens,
		$cost: result.cost,
		$error_message: result.errorMessage ?? null,
	});
}

