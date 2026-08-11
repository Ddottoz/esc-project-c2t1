const {checkForm} = require('../../models/educator');

// checkForm(firstName, email, newPassword, confirmPassword)
// It gives back an error message when something is wrong,
// or an empty string when the form is ready to save.

describe('checkForm', () => {

    test('first name is required', () => {
        expect(checkForm('', 'john.tan@das.org', '', '')).toBe('First name and email are required');
    });

    test('email is required', () => {
        expect(checkForm('John', '', '', '')).toBe('First name and email are required');
    });

    test('a new password must be at least 8 characters', () => {
        expect(checkForm('John', 'john.tan@das.org', 'abc', 'abc'))
            .toBe('Password must be at least 8 characters');
    });

    test('the two password fields must match', () => {
        expect(checkForm('John', 'john.tan@das.org', 'password1', 'password2'))
            .toBe('Passwords do not match');
    });

    test('leaving both password fields empty is allowed', () => {
        expect(checkForm('John', 'john.tan@das.org', '', '')).toBe('');
    });

    test('a completely valid form gives no error', () => {
        expect(checkForm('John', 'john.tan@das.org', 'password1', 'password1')).toBe('');
    });

});
