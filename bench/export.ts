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
	avgDurationMs: number;
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
	bySize: SizeData[];
};

type BenchmarkResults = {
	timestamp: string;
	summary: {
		models: string[];
		sizes: string[];
	};
	byModel: ModelData[];
	chartData: Array<{ model: string } & SizeData>;
};

// Query type for aggregated stats
type AggregatedRow = {
	model: string;
	size: string;
	timestamp: string;
	total: number;
	correct: number;
	failed: number;
	avg_duration_ms: number;
	avg_tokens: number;
	total_tokens: number;
	avg_cost: number;
	total_cost: number;
};

// Aggregate stats from the runs table
const aggregatedResults = db
	.query<AggregatedRow, []>(
		`
    SELECT 
      model,
      size,
      MAX(timestamp) as timestamp,
      COUNT(*) as total,
      SUM(correct) as correct,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      AVG(duration_ms) as avg_duration_ms,
      AVG(tokens) as avg_tokens,
      SUM(tokens) as total_tokens,
      AVG(cost) as avg_cost,
      SUM(cost) as total_cost
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

	const sizeData: SizeData = {
		size: row.size,
		timestamp: row.timestamp,
		accuracy: row.total > 0 ? (row.correct / row.total) * 100 : 0,
		correct: row.correct,
		failed: row.failed,
		total: row.total,
		avgDurationMs: row.avg_duration_ms,
		avgTokens: row.avg_tokens,
		totalTokens: row.total_tokens,
		avgCost: row.avg_cost,
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

	for (const sizeData of sortedSizeDatas) {
		overallCorrect += sizeData.correct;
		overallFailed += sizeData.failed;
		overallTotal += sizeData.total;

		// Add to chartData
		chartData.push({
			model,
			...sizeData,
		});
	}

	byModel.push({
		model,
		overallAccuracy: overallTotal > 0 ? (overallCorrect / overallTotal) * 100 : 0,
		overallCorrect,
		overallFailed,
		overallTotal,
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
