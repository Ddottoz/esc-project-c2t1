const test = require('node:test');
const assert = require('node:assert');
const {checkForm} = require('../models/educator');

// checkForm(firstName, email, newPassword, confirmPassword)
// It gives back an error message when something is wrong,
// or an empty string when the form is ready to save.

test('first name is required', () => {
    const error = checkForm('', 'john.tan@das.org', '', '');
    assert.strictEqual(error, 'First name and email are required');
});

test('email is required', () => {
    const error = checkForm('John', '', '', '');
    assert.strictEqual(error, 'First name and email are required');
});

test('a new password must be at least 8 characters', () => {
    const error = checkForm('John', 'john.tan@das.org', 'abc', 'abc');
    assert.strictEqual(error, 'Password must be at least 8 characters');
});

test('the two password fields must match', () => {
    const error = checkForm('John', 'john.tan@das.org', 'password1', 'password2');
    assert.strictEqual(error, 'Passwords do not match');
});

test('leaving both password fields empty is allowed', () => {
    const error = checkForm('John', 'john.tan@das.org', '', '');
    assert.strictEqual(error, '');
});

test('a completely valid form gives no error', () => {
    const error = checkForm('John', 'john.tan@das.org', 'password1', 'password1');
    assert.strictEqual(error, '');
});
