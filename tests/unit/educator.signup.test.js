/**
 * Unit tests for UC5: Create Educator Account.
 * Tests the sign up form check, the duplicate email check, and the account
 * insert in models/educator.js. The DB pool (models/db.js) is mocked; bcrypt
 * is real, so we can confirm what actually gets stored is a genuine hash.
 *
 * Report mapping:
 *   Unit 1 (EducatorController.validateInput) -> checkSignUpForm()
 *   Unit 2 (EducatorService.createAccount)    -> emailExists() + createEducator()
 *   Unit 3 (EducatorService.hashPassword)     -> the bcrypt hash inside createEducator()
 *
 * Note: sign up (routes/register.js) uses checkSignUpForm, where a password is
 * required. The similarly named checkForm() covered by educator.checkForm.test.js
 * belongs to the edit profile page, where the password is optional.
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


// checkSignUpForm(name, email, password, confirmPassword)
// Gives back an error message, or an empty string when the form is fine.
describe('EducatorModel.checkSignUpForm', () => {

    test('name is required', () => {
        expect(EducatorModel.checkSignUpForm('', 'john.tan@das.org', 'Password123', 'Password123'))
            .toBe('Name, email and password are required');
    });

    test('email is required', () => {
        expect(EducatorModel.checkSignUpForm('John Tan', '', 'Password123', 'Password123'))
            .toBe('Name, email and password are required');
    });

    test('password is required', () => {
        expect(EducatorModel.checkSignUpForm('John Tan', 'john.tan@das.org', '', ''))
            .toBe('Name, email and password are required');
    });

    test('the password must be at least 8 characters (boundary case)', () => {
        expect(EducatorModel.checkSignUpForm('John Tan', 'john.tan@das.org', 'Pass1', 'Pass1'))
            .toBe('Password must be at least 8 characters');
    });

    test('the two password fields must match', () => {
        expect(EducatorModel.checkSignUpForm('John Tan', 'john.tan@das.org', 'Password123', 'Password456'))
            .toBe('Passwords do not match');
    });

    test('a completely valid form gives no error', () => {
        expect(EducatorModel.checkSignUpForm('John Tan', 'john.tan@das.org', 'Password123', 'Password123'))
            .toBe('');
    });

});


describe('EducatorModel.emailExists', () => {

    test('returns true when an account already uses that email', async () => {
        pool.query.mockResolvedValue([[{educatorId: 1}]]);

        const exists = await EducatorModel.emailExists('existing@das.org');

        expect(exists).toBe(true);
    });

    test('returns false when the email is still free', async () => {
        pool.query.mockResolvedValue([[]]);

        const exists = await EducatorModel.emailExists('new@das.org');

        expect(exists).toBe(false);
    });

});


describe('EducatorModel.createEducator', () => {

    test('returns the id of the newly created educator', async () => {
        pool.query.mockResolvedValue([{insertId: 12}]);

        const educatorId = await EducatorModel.createEducator('John Tan', 'john.tan@das.org', 'Password123');

        expect(educatorId).toBe(12);
    });

    test('stores a bcrypt hash, never the plain password', async () => {
        pool.query.mockResolvedValue([{insertId: 12}]);

        await EducatorModel.createEducator('John Tan', 'john.tan@das.org', 'Password123');

        // the INSERT is called as (sql, [name, email, passwordHash])
        const [, values] = pool.query.mock.calls[0];
        const storedHash = values[2];

        expect(storedHash).not.toBe('Password123');
        expect(await bcrypt.compare('Password123', storedHash)).toBe(true);
    });

});
