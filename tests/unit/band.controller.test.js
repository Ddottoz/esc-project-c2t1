const {BandController, ValidationError} = require('../../controllers/BandController');

const band = {
    id: '42', name: 'Band A1', year: 2026, semester: 'Semester 1',
    description: 'Starter band', assessments: [{id: '101'}, {id: '102'}], educators: []
};
const validDraft = {
    year: '2026', semester: 'Semester 2', description: 'Updated',
    weights: {'101': 40, '102': 60},
    educators: [{name: 'Alice', centre: 'Centre 1', role: 'Lead Educator'}]
};

function model(overrides = {}) {
    return {
        bandExists: jest.fn().mockResolvedValue(false),
        createBandCohort: jest.fn().mockResolvedValue({id: '42', name: 'Band A1'}),
        getBand: jest.fn().mockResolvedValue(band),
        updateBandSettings: jest.fn().mockResolvedValue({...band, ...validDraft}),
        deleteBandCohort: jest.fn().mockResolvedValue(true),
        ...overrides
    };
}

describe('UC13 BandController creation', () => {
    test('13.1.5: creates a unique Band with a 2000-character description', async () => {
        const dependency = model();
        const controller = new BandController(dependency);
        const details = {name: 'Band A1', year: '2026', semester: 'Semester 1', description: 'x'.repeat(2000)};

        await expect(controller.createBandCohort(details)).resolves.toEqual({id: '42', name: 'Band A1'});
        expect(dependency.bandExists).toHaveBeenCalledWith('Band A1', '2026', 'Semester 1');
        expect(dependency.createBandCohort).toHaveBeenCalledWith(details);
    });

    test('13.1.6: rejects a duplicate without creating it', async () => {
        const dependency = model({bandExists: jest.fn().mockResolvedValue(true)});
        const controller = new BandController(dependency);

        await expect(controller.createBandCohort({
            name: 'Band A1', year: '2026', semester: 'Semester 1', description: 'Starter band'
        })).rejects.toMatchObject({code: 'DUPLICATE_BAND_COHORT'});
        expect(dependency.createBandCohort).not.toHaveBeenCalled();
    });

    test('13.1.9: accepts 2000 characters and rejects 2001', () => {
        const controller = new BandController(model());
        expect(() => controller.validateDescription('x'.repeat(2000))).not.toThrow();
        expect(() => controller.validateDescription('x'.repeat(2001))).toThrow(
            expect.objectContaining({code: 'INVALID_DESCRIPTION'})
        );
    });
});

describe('UC14 BandController settings', () => {
    test('14.1.5: updates a valid draft', async () => {
        const dependency = model();
        const controller = new BandController(dependency);

        await expect(controller.updateBandSettings('42', validDraft)).resolves.toMatchObject({description: 'Updated'});
        expect(dependency.bandExists).toHaveBeenCalledWith('Band A1', '2026', 'Semester 2', '42');
        expect(dependency.updateBandSettings).toHaveBeenCalledWith('42', validDraft);
    });

    test('14.1.6: rejects weights totalling 110 before mutation', async () => {
        const dependency = model();
        const controller = new BandController(dependency);

        await expect(controller.updateBandSettings('42', {...validDraft, weights: {'101': 60, '102': 50}}))
            .rejects.toMatchObject({code: 'INVALID_WEIGHTAGE_TOTAL'});
        expect(dependency.bandExists).not.toHaveBeenCalled();
        expect(dependency.updateBandSettings).not.toHaveBeenCalled();
    });

    test('14.1.10: validates weight boundaries and empty assessments', () => {
        const controller = new BandController(model());
        const weights = {'101': 0, '102': 100};
        const assessmentInput = structuredClone(band.assessments);
        const beforeWeights = structuredClone(weights);
        expect(controller.validateWeightageTotal(weights, assessmentInput)).toBe(true);
        expect(controller.validateWeightageTotal({}, [])).toBe(true);
        for (const weights of [{'101': -1, '102': 101}, {'101': 50}]) {
            expect(() => controller.validateWeightageTotal(weights, band.assessments)).toThrow(
                expect.objectContaining({code: 'INVALID_WEIGHTAGE_TOTAL'})
            );
        }
        expect(weights).toEqual(beforeWeights);
        expect(assessmentInput).toEqual(band.assessments);
    });

    test('14.1.11: validates educator boundaries', () => {
        const controller = new BandController(model());
        expect(() => controller.validateEducators([
            {name: 'x'.repeat(100), centre: 'Centre 1', role: 'Lead Educator'}
        ])).not.toThrow();
        for (const educator of [
            {name: 'x'.repeat(101), centre: 'Centre 1', role: 'Lead Educator'},
            {name: ' ', centre: 'Centre 1', role: 'Lead Educator'},
            {name: 'Alice', role: 'Lead Educator'},
            {name: 'Alice', centre: 'Centre 1', role: 'Owner'}
        ]) {
            expect(() => controller.validateEducators([educator])).toThrow(
                expect.objectContaining({code: 'INVALID_EDUCATOR'})
            );
        }
    });

    test('returns null for a missing Band and reports a false model update', async () => {
        const missing = model({getBand: jest.fn().mockResolvedValue(null)});
        await expect(new BandController(missing).updateBandSettings('999', validDraft)).resolves.toBeNull();
        expect(missing.updateBandSettings).not.toHaveBeenCalled();

        const failed = model({updateBandSettings: jest.fn().mockResolvedValue(false)});
        await expect(new BandController(failed).updateBandSettings('42', validDraft))
            .rejects.toMatchObject({code: 'SETTINGS_UPDATE_FAILED'});
    });

    test('delegates Band deletion', async () => {
        const dependency = model();
        await expect(new BandController(dependency).deleteBandCohort('42')).resolves.toBe(true);
        expect(dependency.deleteBandCohort).toHaveBeenCalledWith('42');
    });
});
