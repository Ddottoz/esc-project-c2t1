const assert = require('node:assert/strict');
const fc = require('fast-check');

function assessmentsFor(values) {
    return values.map((_, index) => ({id: `assessment-${index}`}));
}

function weightMap(values) {
    return Object.fromEntries(values.map((value, index) => [`assessment-${index}`, value]));
}

function assertInvalid(controller, weights, assessments) {
    const snapshot = {...weights};
    assert.throws(
        () => controller.validateWeightageTotal(weights, assessments),
        (error) => error.name === 'ValidationError' && error.code === 'INVALID_WEIGHTAGE_TOTAL'
    );
    assert.deepStrictEqual(weights, snapshot);
}

// Partition 10,000 hundredths so valid cases include both integer and two-decimal weights.
const validDecimalPartitions = fc.uniqueArray(fc.integer({min: 0, max: 10000}), {
    minLength: 2,
    maxLength: 20
}).map((cuts) => {
    const ordered = [...cuts, 0, 10000].sort((a, b) => a - b);
    return ordered.slice(1).map((cut, index) => (cut - ordered[index]) / 100);
});

function createWeightValidationProperties(controller) {
    return [
        {
            name: 'valid decimal partitions total exactly 100',
            property: fc.property(validDecimalPartitions, (values) => {
                const weights = weightMap(values);
                const snapshot = {...weights};
                assert.equal(controller.validateWeightageTotal(weights, assessmentsFor(values)), true);
                assert.deepStrictEqual(weights, snapshot);
            })
        },
        {
            name: 'numeric form strings follow the documented coercion contract',
            property: fc.property(validDecimalPartitions, (values) => {
                const strings = values.map(String);
                assert.equal(
                    controller.validateWeightageTotal(weightMap(strings), assessmentsFor(strings)),
                    true
                );
            })
        },
        {
            name: 'incorrect multi-weight totals are rejected',
            property: fc.property(
                fc.integer({min: 1, max: 99}),
                fc.integer({min: 2, max: 1000}),
                fc.boolean(),
                (first, deltaUnits, positive) => {
                    const delta = (positive ? deltaUnits : -deltaUnits) / 10000;
                    const values = [first, 100 - first + delta];
                    assertInvalid(controller, weightMap(values), assessmentsFor(values));
                }
            )
        },
        {
            name: 'out-of-range and non-finite weights are rejected',
            property: fc.property(fc.oneof(
                fc.double({min: -Number.MAX_VALUE, max: -Number.MIN_VALUE, noNaN: true}),
                fc.double({min: 100.0001, max: Number.MAX_VALUE, noNaN: true}),
                fc.constantFrom(NaN, Infinity, -Infinity)
            ), (value) => assertInvalid(
                controller,
                {'assessment-0': value},
                [{id: 'assessment-0'}]
            ))
        },
        {
            name: 'missing and malformed weights are rejected',
            property: fc.property(
                fc.integer({min: 1, max: 30}),
                fc.constantFrom(undefined, {}, [], 'not-a-number', Symbol('weight')),
                (count, value) => {
                    const assessments = Array.from(
                        {length: count},
                        (_, index) => ({id: `assessment-${index}`})
                    );
                    assertInvalid(
                        controller,
                        Object.fromEntries(assessments.map(({id}) => [id, value])),
                        assessments
                    );
                }
            )
        }
    ];
}

module.exports = {
    assertInvalid,
    createWeightValidationProperties
};
