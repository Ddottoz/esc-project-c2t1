/**
 * Unit tests for UC20: Edit Educator Account.
 * Tests the duplicate email check and the two update functions in
 * models/educator.js, with the DB pool (models/db.js) mocked. bcrypt is real,
 * so we can confirm a changed password is stored as a genuine hash.
 *
 * Report mapping:
 *   Unit 1 (EducatorController.validateProfileInput) -> checkForm(), covered in educator.checkForm.test.js
 *   Unit 2 (EducatorService.isEmailTaken)            -> emailTaken()
 *   Unit 3 (EducatorService.updateProfile)           -> updateEducator() + updatePassword()
 */

jest.mock('../../models/db', () => ({
    query: jest.fn()
}));

const bcrypt = require('bcrypt');
const pool = require('../../models/db');
const EducatorModel = require('../../models/educator');

afterEach(() => {
    jest.clearAllMocks();
});


// emailTaken(email, id) ignores the educator's own row, so an educator can
// save the form without changing their email.
describe('EducatorModel.emailTaken', () => {

    test('returns true when a different educator already uses that email', async () => {
        pool.query.mockResolvedValue([[{educatorId: 7}]]);

        const taken = await EducatorModel.emailTaken('taken@das.org', 2);

        expect(taken).toBe(true);
    });

    test('returns false when nobody else uses that email', async () => {
        pool.query.mockResolvedValue([[]]);

        const taken = await EducatorModel.emailTaken('free@das.org', 2);

        expect(taken).toBe(false);
    });

    test('excludes the educator being edited from the check', async () => {
        pool.query.mockResolvedValue([[]]);

        await EducatorModel.emailTaken('own@das.org', 2);

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('educatorId != ?'), ['own@das.org', 2]
        );
    });

});


describe('EducatorModel.updateEducator', () => {

    test('returns true when the educator record was updated', async () => {
        pool.query.mockResolvedValue([{affectedRows: 1}]);

        const updated = await EducatorModel.updateEducator(2, 'John', 'Tan', 'john.tan@das.org');

        expect(updated).toBe(true);
    });

    test('returns false when no educator matches that id (negative case)', async () => {
        pool.query.mockResolvedValue([{affectedRows: 0}]);

        const updated = await EducatorModel.updateEducator(9999, 'John', 'Tan', 'john.tan@das.org');

        expect(updated).toBe(false);
    });

    test('saves the first and last name joined into one educatorName', async () => {
        pool.query.mockResolvedValue([{affectedRows: 1}]);

        await EducatorModel.updateEducator(2, 'John', 'Tan', 'john.tan@das.org');

        const [, values] = pool.query.mock.calls[0];
        expect(values[0]).toBe('John Tan');
    });

});


describe('EducatorModel.updatePassword', () => {

    test('stores a bcrypt hash, never the plain password', async () => {
        pool.query.mockResolvedValue([{affectedRows: 1}]);

        await EducatorModel.updatePassword(2, 'NewPassword123');

        const [, values] = pool.query.mock.calls[0];
        const storedHash = values[0];

        expect(storedHash).not.toBe('NewPassword123');
        expect(await bcrypt.compare('NewPassword123', storedHash)).toBe(true);
    });

});
