import { db } from "./db";

// Output path
const resultsPath = new URL("../visualizer/app/results.json", import.meta.url).pathname;

// Types for the JSON output (matching existing format)
type SizeData = {
	size: string;
	timestamp: string;
	accuracy: number;
	correct: number;
	failed: number;
	total: number;
	runs: number;
	avgDurationMs: number;
	totalDurationMs: number;
	avgTokens: number;
	totalTokens: number;
	avgCost: number;
	totalCost: number;
};

type ModelData = {
	model: string;
	overallAccuracy: number;
	overallCorrect: number;
	overallFailed: number;
	overallTotal: number;
	overallRuns: number;
	bySize: SizeData[];
};

type ErrorMessageData = {
	message: string;
	count: number;
};

type ModelErrorData = {
	model: string;
	totalErrors: number;
	errors: ErrorMessageData[];
};

type BenchmarkResults = {
	timestamp: string;
	summary: {
		models: string[];
		sizes: string[];
	};
	byModel: ModelData[];
	chartData: Array<{ model: string } & SizeData>;
	errorsByModel: ModelErrorData[];
};

// Query type for aggregated stats
type AggregatedRow = {
	model: string;
	size: string;
	timestamp: string;
	total: number;
	runs: number;
	correct: number;
	failed: number;
	avg_duration_ms: number;
	total_duration_ms: number;
	avg_tokens: number;
	total_tokens: number;
	avg_cost: number;
	total_cost: number;
};

// Aggregate stats from the runs table
// All averages and totals EXCLUDE failed runs (status = 'failed')
const aggregatedResults = db
	.query<AggregatedRow, []>(
		`
    SELECT 
      model,
      size,
      MAX(timestamp) as timestamp,
      COUNT(*) as total,
      SUM(CASE WHEN status != 'failed' THEN 1 ELSE 0 END) as runs,
      SUM(correct) as correct,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      AVG(CASE WHEN status != 'failed' THEN duration_ms ELSE NULL END) as avg_duration_ms,
      SUM(CASE WHEN status != 'failed' THEN duration_ms ELSE 0 END) as total_duration_ms,
      AVG(CASE WHEN status != 'failed' THEN tokens ELSE NULL END) as avg_tokens,
      SUM(CASE WHEN status != 'failed' THEN tokens ELSE 0 END) as total_tokens,
      AVG(CASE WHEN status != 'failed' THEN cost ELSE NULL END) as avg_cost,
      SUM(CASE WHEN status != 'failed' THEN cost ELSE 0 END) as total_cost
    FROM runs
    GROUP BY model, size
    ORDER BY model, size
  `,
	)
	.all();

if (aggregatedResults.length === 0) {
	console.log("No runs found in database. Nothing to export.");
	process.exit(0);
}

// Query error messages grouped by model
type ErrorRow = {
	model: string;
	error_message: string;
	count: number;
};

const errorResults = db
	.query<ErrorRow, []>(
		`
    SELECT 
      model,
      error_message,
      COUNT(*) as count
    FROM runs
    WHERE error_message IS NOT NULL AND error_message != ''
    GROUP BY model, error_message
    ORDER BY model, count DESC
  `,
	)
	.all();

// Build errorsByModel structure
const errorMap = new Map<string, ErrorMessageData[]>();
for (const row of errorResults) {
	if (!errorMap.has(row.model)) {
		errorMap.set(row.model, []);
	}
	errorMap.get(row.model)!.push({
		message: row.error_message,
		count: row.count,
	});
}

const errorsByModel: ModelErrorData[] = [];
for (const [model, errors] of errorMap) {
	errorsByModel.push({
		model,
		totalErrors: errors.reduce((sum, e) => sum + e.count, 0),
		errors,
	});
}
// Sort by total errors descending
errorsByModel.sort((a, b) => b.totalErrors - a.totalErrors);

// Sort sizes in order (5x5, 10x10, 15x15)
function sortSizes(sizes: string[]): string[] {
	return [...sizes].sort((a, b) => {
		const aNum = Number.parseInt(a.split("x")[0] ?? "0", 10);
		const bNum = Number.parseInt(b.split("x")[0] ?? "0", 10);
		return aNum - bNum;
	});
}

// Build the results structure
const modelMap = new Map<string, SizeData[]>();
const allSizes = new Set<string>();

for (const row of aggregatedResults) {
	if (!modelMap.has(row.model)) {
		modelMap.set(row.model, []);
	}

	// Accuracy is calculated from runs (excluding failed), not total
	const sizeData: SizeData = {
		size: row.size,
		timestamp: row.timestamp,
		accuracy: row.runs > 0 ? (row.correct / row.runs) * 100 : 0,
		correct: row.correct,
		failed: row.failed,
		total: row.total,
		runs: row.runs,
		avgDurationMs: row.avg_duration_ms ?? 0,
		totalDurationMs: row.total_duration_ms,
		avgTokens: row.avg_tokens ?? 0,
		totalTokens: row.total_tokens,
		avgCost: row.avg_cost ?? 0,
		totalCost: row.total_cost,
	};

	modelMap.get(row.model)!.push(sizeData);
	allSizes.add(row.size);
}

// Build byModel array
const byModel: ModelData[] = [];
const chartData: BenchmarkResults["chartData"] = [];

for (const [model, sizeDatas] of modelMap) {
	// Sort size data by size
	const sortedSizeDatas = sortSizes(sizeDatas.map((s) => s.size)).map(
		(size) => sizeDatas.find((s) => s.size === size)!,
	);

	// Calculate overall stats
	let overallCorrect = 0;
	let overallFailed = 0;
	let overallTotal = 0;
	let overallRuns = 0;

	for (const sizeData of sortedSizeDatas) {
		overallCorrect += sizeData.correct;
		overallFailed += sizeData.failed;
		overallTotal += sizeData.total;
		overallRuns += sizeData.runs;

		// Add to chartData
		chartData.push({
			model,
			...sizeData,
		});
	}

	// Overall accuracy uses runs (excluding failed), not total
	byModel.push({
		model,
		overallAccuracy: overallRuns > 0 ? (overallCorrect / overallRuns) * 100 : 0,
		overallCorrect,
		overallFailed,
		overallTotal,
		overallRuns,
		bySize: sortedSizeDatas,
	});
}

// Sort byModel by overall accuracy descending
byModel.sort((a, b) => b.overallAccuracy - a.overallAccuracy);

// Build final results
const results: BenchmarkResults = {
	timestamp: new Date().toISOString(),
	summary: {
		models: byModel.map((m) => m.model),
		sizes: sortSizes([...allSizes]),
	},
	byModel,
	chartData,
	errorsByModel,
};

// Write to file
await Bun.write(resultsPath, JSON.stringify(results, null, 2));

console.log(`Exported ${aggregatedResults.length} model+size combinations to:`);
console.log(`  ${resultsPath}`);
console.log(`\nSummary:`);
console.log(`  Models: ${results.summary.models.length}`);
console.log(`  Sizes: ${results.summary.sizes.join(", ")}`);

// Show per-model stats
console.log(`\nModel Accuracy:`);
for (const modelData of byModel) {
	console.log(
		`  ${modelData.model}: ${modelData.overallAccuracy.toFixed(2)}% (${modelData.overallCorrect}/${modelData.overallTotal})`,
	);
}

// Show error stats
if (errorsByModel.length > 0) {
	const totalErrors = errorsByModel.reduce((sum, m) => sum + m.totalErrors, 0);
	console.log(`\nError Messages: ${totalErrors} total across ${errorsByModel.length} models`);
}
