const BandCohort = require('../models/band');

const BAND_NAMES = Object.freeze([
    'Band A1', 'Band A2', 'Band A3',
    'Band B4', 'Band B5', 'Band B6',
    'Band C7', 'Band C8', 'Band C9'
]);
const YEARS = Object.freeze([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
const SEMESTERS = Object.freeze(['Semester 1', 'Semester 2']);
const CENTRES = Object.freeze(['Centre 1', 'Centre 2']);
const EDUCATOR_ROLES = Object.freeze(['Lead Educator', 'Supporting Educator']);
const WEIGHT_TOTAL = 100;
const WEIGHT_TOTAL_TOLERANCE = 0.0001;

class ValidationError extends Error {
    constructor(message, code = 'VALIDATION_ERROR') {
        super(message);
        this.name = 'ValidationError';
        this.code = code;
    }
}

class BandController {
    constructor(model = BandCohort) {
        this.model = model;
    }

    async listBandCohorts() {
        return this.model.getBands();
    }

    async createBandCohort(details) {
        this.validateRequiredFields(details);
        // same Band cannot appear twice in one semester
        if (await this.model.bandExists(details.name, details.year, details.semester)) {
            throw new ValidationError(
                `${details.name} already exists for ${details.year} ${details.semester}.`,
                'DUPLICATE_BAND_COHORT'
            );
        }
        return this.model.createBandCohort(details);
    }

    async getBandSettings(cohortId) {
        return this.model.getBand(cohortId);
    }

    async updateBandSettings(cohortId, draft) {
        const cohort = await this.getBandSettings(cohortId);
        if (!cohort) return null;

        // check the full draft before updating anything
        this.validateTerm(draft.year, draft.semester);
        this.validateDescription(draft.description);
        this.validateWeightageTotal(draft.weights, cohort.assessments);
        this.validateEducators(draft.educators);

        if (await this.model.bandExists(cohort.name, draft.year, draft.semester, cohortId)) {
            throw new ValidationError(
                `${cohort.name} already exists for ${draft.year} ${draft.semester}.`,
                'DUPLICATE_BAND_COHORT'
            );
        }

        const updated = await this.model.updateBandSettings(cohortId, draft);
        if (!updated) {
            throw new ValidationError(
                'The Band settings could not be updated.',
                'SETTINGS_UPDATE_FAILED'
            );
        }
        return updated;
    }

    validateWeightageTotal(weights, assessments) {
        if (!assessments.length) return true;
        const values = assessments.map((assessment) => {
            try {
                return Number(weights[assessment.id]);
            } catch {
                return NaN;
            }
        });
        const total = values.reduce((sum, weight) => sum + weight, 0);
        const roundingAllowance = Number.EPSILON * Math.max(1, Math.abs(total), WEIGHT_TOTAL);
        // The tolerance boundary is inclusive. roundingAllowance prevents an exact
        // decimal boundary such as 100.0001 being rejected by binary rounding noise.
        if (values.some((weight) => !Number.isFinite(weight) || weight < 0 || weight > 100) ||
            Math.abs(total - WEIGHT_TOTAL) > WEIGHT_TOTAL_TOLERANCE + roundingAllowance) {
            throw new ValidationError(
                'Assessment weightages must each be between 0% and 100% and add up to exactly 100%.',
                'INVALID_WEIGHTAGE_TOTAL'
            );
        }
        return true;
    }

    async deleteBandCohort(cohortId) {
        return this.model.deleteBandCohort(cohortId);
    }

    validateRequiredFields(details) {
        if (!BAND_NAMES.includes(details.name)) {
            throw new ValidationError('A valid Band, year and semester are required.', 'INVALID_BAND');
        }
        this.validateTerm(details.year, details.semester);
        this.validateDescription(details.description);
    }

    validateTerm(year, semester) {
        if (!YEARS.includes(Number(year)) || !SEMESTERS.includes(semester)) {
            throw new ValidationError('A valid Band, year and semester are required.', 'INVALID_TERM');
        }
    }

    validateDescription(description) {
        if (String(description || '').length > 2000) {
            throw new ValidationError('Band description must be 2000 characters or fewer.', 'INVALID_DESCRIPTION');
        }
    }

    validateEducators(educators) {
        const valid = educators.every((educator) =>
            typeof educator.name === 'string' && educator.name.trim().length > 0 &&
            educator.name.trim().length <= 100 && CENTRES.includes(educator.centre) &&
            EDUCATOR_ROLES.includes(educator.role)
        );
        if (!valid) {
            throw new ValidationError('Each educator must have a valid name, centre and role.', 'INVALID_EDUCATOR');
        }
    }
}

const controller = new BandController();
module.exports = controller;
module.exports.BandController = BandController;
module.exports.ValidationError = ValidationError;
module.exports.BAND_NAMES = BAND_NAMES;

