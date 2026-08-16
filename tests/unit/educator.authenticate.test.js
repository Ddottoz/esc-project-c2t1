/**
 * Unit tests for UC6: Login to Educator Account.
 * Tests EducatorModel.authenticate() (models/educator.js) with the DB pool
 * (models/db.js) mocked. bcrypt is deliberately NOT mocked, so a real hash is
 * compared against a real password — that is what proves the password check
 * actually works rather than just that a function was called.
 *
 * Report mapping:
 *   Unit 1 (EducatorService.verifyPassword) -> the bcrypt compare inside authenticate()
 *   Unit 2 (EducatorService.authenticate)   -> authenticate()
 */

jest.mock('../../models/db', () => ({
    query: jest.fn()
}));

const bcrypt = require('bcrypt');
const pool = require('../../models/db');
const EducatorModel = require('../../models/educator');

const EMAIL = 'john.tan@das.org';
const PASSWORD = 'Password123';

let passwordHash;

// hash the password once so every test compares against a real bcrypt hash
beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 10);
});

afterEach(() => {
    jest.clearAllMocks();
});

// makes pool.query return one educator row, the way the real query would
function mockEducatorFound() {
    pool.query.mockResolvedValue([[{
        educatorId: 2,
        educatorName: 'John Tan',
        email: EMAIL,
        passwordHash: passwordHash
    }]]);
}

// makes pool.query return no rows, the way it would for an unknown email
function mockEducatorNotFound() {
    pool.query.mockResolvedValue([[]]);
}


describe('EducatorModel.authenticate', () => {

    test('returns the educator when the email and password are correct', async () => {
        mockEducatorFound();

        const educator = await EducatorModel.authenticate(EMAIL, PASSWORD);

        expect(educator).toEqual({
            educatorId: 2,
            educatorName: 'John Tan',
            email: EMAIL
        });
    });

    test('looks the educator up by their email', async () => {
        mockEducatorFound();

        await EducatorModel.authenticate(EMAIL, PASSWORD);

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('FROM educator WHERE email'), [EMAIL]
        );
    });

    test('returns null when the password is wrong (negative case)', async () => {
        mockEducatorFound();

        const educator = await EducatorModel.authenticate(EMAIL, 'WrongPassword');

        expect(educator).toBeNull();
    });

    test('returns null when no account exists for that email (negative case)', async () => {
        mockEducatorNotFound();

        const educator = await EducatorModel.authenticate('nobody@das.org', PASSWORD);

        expect(educator).toBeNull();
    });

    test('returns null when the password is empty (boundary case)', async () => {
        mockEducatorFound();

        const educator = await EducatorModel.authenticate(EMAIL, '');

        expect(educator).toBeNull();
    });

    test('never hands back the password hash', async () => {
        mockEducatorFound();

        const educator = await EducatorModel.authenticate(EMAIL, PASSWORD);

        expect(educator.passwordHash).toBeUndefined();
    });

});
