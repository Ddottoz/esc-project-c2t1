const fc = require('fast-check');
const {BandController} = require('../../controllers/BandController');
const {
    assertInvalid,
    createWeightValidationProperties
} = require('../../robustness/weight-validation-properties');

const controller = new BandController({});
const requestedRuns = Number(process.env.FUZZ_RUNS || 1000);
const numRuns = Number.isSafeInteger(requestedRuns) && requestedRuns > 0 ? requestedRuns : 1000;
const requestedSeed = Number(process.env.FUZZ_SEED || 20260816);
const seed = Number.isSafeInteger(requestedSeed) ? requestedSeed : 20260816;
jest.setTimeout(Math.max(5000, Math.ceil(numRuns / 1000) * 1000));

describe('UC14 assessment-weight robustness fuzzing', () => {
    for (const target of createWeightValidationProperties(controller)) {
        test(target.name, () => {
            fc.assert(target.property, {numRuns, seed});
        });
    }

    test('documents the inclusive tolerance and coercion boundaries', () => {
        const assessments = [{id: 'a'}, {id: 'b'}];

        expect(controller.validateWeightageTotal({a: 50, b: 50.0001}, assessments)).toBe(true);
        expect(controller.validateWeightageTotal({a: '50', b: '50'}, assessments)).toBe(true);
        expect(controller.validateWeightageTotal({a: null, b: 100}, assessments)).toBe(true);
        expect(controller.validateWeightageTotal({a: ' ', b: 100}, assessments)).toBe(true);
        expect(controller.validateWeightageTotal({a: [], b: 100}, assessments)).toBe(true);

        assertInvalid(controller, {a: 50, b: 50.0002}, assessments);
        assertInvalid(controller, {a: 50, b: 49.9998}, assessments);
        assertInvalid(controller, {a: -0.0001, b: 100}, assessments);
        assertInvalid(controller, {a: 0, b: 100.0001}, assessments);
    });

    test('records the unresolved zero-assessment behaviour without treating it as an oracle', () => {
        // This assertion documents current behaviour. Product clarification is still
        // required before empty assessment collections can be called valid or invalid.
        expect(controller.validateWeightageTotal({}, [])).toBe(true);
    });
});
