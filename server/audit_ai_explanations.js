import fs from 'node:fs';

const base = 'http://127.0.0.1:3001';
const scenarios = [
  ['baseline', {}],
  ['high-load', { loadSetting: 95 }],
  ['cooling-loss', { coolingSetting: 20, injectFault: { id: 'cooling_failure', name: 'Cooling Loss' } }],
  ['overheating', { tempStress: 48, injectFault: { id: 'overheating', name: 'Overheating' } }],
  ['bearing-wear', { bearingHealth: 45, injectFault: { id: 'bearing_degradation', name: 'Bearing Wear' } }],
  ['imbalance', { injectFault: { id: 'shaft_imbalance', name: 'Shaft Imbalance' } }],
  ['vibration', { injectFault: { id: 'excessive_vibration', name: 'Vibration' } }],
  ['voltage-drop', { voltageSetting: 180, injectFault: { id: 'voltage_drop', name: 'Voltage Drop' } }],
  ['overcurrent', { injectFault: { id: 'overcurrent', name: 'Overcurrent' } }],
  ['phase-unbalance', { injectFault: { id: 'power_instability', name: 'Phase Unbalance' } }],
];

const results = [];
for (const [name, modifications] of scenarios) {
  const started = Date.now();
  const response = await fetch(base + '/api/whatif', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration: 10, mode: 'healthy', seed: 4242, modifications }),
  });
  const data = await response.json();
  const explanation = data.explanation || '';
  const result = {
    name,
    status: response.status,
    elapsedMs: Date.now() - started,
    aiGenerated: explanation.startsWith('[AI-GENERATED EXPLANATION]'),
    // Character bound avoids treating decimal points in values such as 50.4°C
    // and 1.9 mm/s as sentence boundaries.
    concise: explanation.length > 0 && explanation.length <= 700,
    outcome: data.outcome,
    explanation,
  };
  result.pass = result.status === 200 && result.aiGenerated && result.concise;
  results.push(result);
  console.log(`${name}: ${result.pass ? 'PASS' : 'FAIL'} (${result.elapsedMs} ms)`);
}

const report = { generatedAt: new Date().toISOString(), total: results.length, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results };
fs.mkdirSync(new URL('../validation/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../validation/ai-explanation-report.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed }, null, 2));
if (report.failed) process.exitCode = 1;
