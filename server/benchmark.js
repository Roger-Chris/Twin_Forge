// server/benchmark.js

import { performance } from 'perf_hooks';
import { getInitialState, runWhatIf } from './simulation.js';

function benchmarkForecast(durationMinutes, iterations = 100) {
  const state = getInitialState();
  const times = [];

  // Warmup
  for (let i = 0; i < 5; i++) {
    runWhatIf(state, durationMinutes, {}, 'healthy', 12345);
  }

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    runWhatIf(state, durationMinutes, {}, 'healthy', 12345);
    const end = performance.now();
    times.push(end - start);
  }

  const sum = times.reduce((a, b) => a + b, 0);
  const mean = sum / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  const stdDev = Math.sqrt(
    times.map(t => Math.pow(t - mean, 2)).reduce((a, b) => a + b, 0) / times.length
  );

  return {
    mean: mean.toFixed(3),
    min: min.toFixed(3),
    max: max.toFixed(3),
    stdDev: stdDev.toFixed(3),
    iterations
  };
}

console.log('====================================================');
console.log('TWINFORGE SIMULATOR FORECAST BENCHMARK');
console.log('====================================================');

const durations = [5, 30, 60];
durations.forEach(d => {
  console.log(`Running benchmark for ${d}-minute forecast (${d * 60} steps)...`);
  const stats = benchmarkForecast(d, 50);
  console.log(`  Average Execution Time: ${stats.mean} ms`);
  console.log(`  Minimum Execution Time: ${stats.min} ms`);
  console.log(`  Maximum Execution Time: ${stats.max} ms`);
  console.log(`  Standard Deviation:     ${stats.stdDev} ms`);
  console.log(`  Sample Iterations:      ${stats.iterations}`);
  console.log('----------------------------------------------------');
});

console.log('Benchmark completed successfully.');
