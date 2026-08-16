const {performance} = require('node:perf_hooks');
const {inspect} = require('node:util');
const fc = require('fast-check');

// This target is pure controller validation. Stub the default model before loading
// the controller so a long campaign never opens or depends on a database connection.
const bandModelPath = require.resolve('../models/band');
require.cache[bandModelPath] = {
    id: bandModelPath,
    filename: bandModelPath,
    loaded: true,
    exports: {}
};
const {BandController} = require('../controllers/BandController');
const {createWeightValidationProperties} = require('../robustness/weight-validation-properties');

const controller = new BandController({});

function positiveInteger(name, fallback) {
    const value = Number(process.env[name] || fallback);
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive safe integer.`);
    }
    return value;
}

const durationMs = positiveInteger('FUZZ_DURATION_MS', 60000);
const batchRuns = positiveInteger('FUZZ_BATCH_RUNS', 1000);
const baseSeed = positiveInteger('FUZZ_SEED', 20260816);
const progressMs = positiveInteger('FUZZ_PROGRESS_MS', 60000);
const properties = createWeightValidationProperties(controller);

let stopRequested = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        stopRequested = true;
        process.stderr.write(`\n${signal} received; stopping after the current property batch.\n`);
    });
}

const startedAtIso = new Date().toISOString();
const startedAt = performance.now();
const deadline = startedAt + durationMs;
let nextProgress = startedAt + progressMs;
let totalCases = 0;
let completedProperties = 0;
let batch = 0;

console.log(JSON.stringify({
    event: 'start',
    startedAt: startedAtIso,
    durationMs,
    batchRuns,
    baseSeed,
    properties: properties.length
}));

while (!stopRequested && performance.now() < deadline) {
    for (let propertyIndex = 0; propertyIndex < properties.length; propertyIndex += 1) {
        if (stopRequested || performance.now() >= deadline) break;

        const target = properties[propertyIndex];
        const seed = baseSeed + batch * properties.length + propertyIndex;
        const result = fc.check(target.property, {numRuns: batchRuns, seed});
        totalCases += result.numRuns;

        if (result.failed) {
            const failure = {
                event: 'failure',
                property: target.name,
                seed,
                path: result.counterexamplePath,
                totalCases,
                elapsedMs: Math.round(performance.now() - startedAt)
            };
            console.error(JSON.stringify(failure));
            console.error(`counterexample=${inspect(result.counterexample, {depth: null})}`);
            console.error(`error=${result.error}`);
            process.exitCode = 1;
            stopRequested = true;
            break;
        }

        completedProperties += 1;
        if (performance.now() >= nextProgress) {
            console.log(JSON.stringify({
                event: 'progress',
                elapsedMs: Math.round(performance.now() - startedAt),
                totalCases,
                completedProperties,
                completedBatches: Math.floor(completedProperties / properties.length)
            }));
            nextProgress = performance.now() + progressMs;
        }
    }
    batch += 1;
}

console.log(JSON.stringify({
    event: process.exitCode ? 'failed' : (stopRequested ? 'stopped' : 'complete'),
    endedAt: new Date().toISOString(),
    elapsedMs: Math.round(performance.now() - startedAt),
    totalCases,
    completedProperties,
    completedBatches: Math.floor(completedProperties / properties.length),
    baseSeed
}));
