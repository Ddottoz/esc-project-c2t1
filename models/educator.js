const pool = require('./db');
const bcrypt = require('bcrypt');

async function getEducatorById(id) {
    const [rows] = await pool.query(
        `SELECT e.educatorId, e.educatorName, e.email, e.centreId, c.centreName
         FROM educator e LEFT JOIN centre c ON e.centreId = c.centreId
         WHERE e.educatorId = ?`, [id]
    );
    if (rows.length === 0) return null;
    return rows[0];
}

// Creates a new educator account and returns its new id.
async function createEducator(name, email, password) {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
        `INSERT INTO educator (educatorName, email, passwordHash, isAuthenticated) VALUES (?, ?, ?, 1)`,
        [name, email, hash]
    );
    return result.insertId;
}

// Checks the sign up form.
// Returns an error message, or an empty string when the form is fine.
function checkSignUpForm(name, email, password, confirmPassword) {
    if (!name || !email || !password) {
        return 'Name, email and password are required';
    }
    if (password.length < 8) {
        return 'Password must be at least 8 characters';
    }
    if (password !== confirmPassword) {
        return 'Passwords do not match';
    }
    return '';
}

// Checks an email and password against the database.
// Returns the matching educator (without the password) when they are correct,
// or null when the email is not found or the password is wrong.
async function authenticate(email, password) {
    const [rows] = await pool.query(
        `SELECT educatorId, educatorName, email, passwordHash FROM educator WHERE email = ?`, [email]
    );
    if (rows.length === 0) return null;

    const educator = rows[0];
    const passwordMatches = await bcrypt.compare(password, educator.passwordHash);
    if (!passwordMatches) return null;

    return {educatorId: educator.educatorId, educatorName: educator.educatorName, email: educator.email};
}

// The table stores one educatorName, but the form shows First Name and Last Name.
// Everything before the first space is the first name, the rest is the last name.
function splitName(educatorName) {
    const parts = educatorName.trim().split(' ');
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ')
    };
}

function joinName(firstName, lastName) {
    return (firstName.trim() + ' ' + lastName.trim()).trim();
}

// Checks the form before we save it.
// Returns an error message, or an empty string when the form is fine.
// The password fields are optional, so they are only checked when one is filled in.
function checkForm(firstName, email, newPassword, confirmPassword) {
    if (!firstName || !email) {
        return 'First name and email are required';
    }
    if (newPassword && newPassword.length < 8) {
        return 'Password must be at least 8 characters';
    }
    if (newPassword !== confirmPassword) {
        return 'Passwords do not match';
    }
    return '';
}

// Checks if any educator already uses this email (used when signing up)
async function emailExists(email) {
    const [rows] = await pool.query(`SELECT educatorId FROM educator WHERE email = ?`, [email]);
    return rows.length > 0;
}

// Finds an educator by email. Returns null when there is no account.
async function getEducatorByEmail(email) {
    const [rows] = await pool.query(
        `SELECT educatorId, educatorName, email FROM educator WHERE email = ?`, [email]
    );
    if (rows.length === 0) return null;
    return rows[0];
}

// The bands this educator teaches, for the DAS Programme Information table.
// semesterBandEducator stores the educator's name as text, so we match on name.
async function getProgrammes(educatorName) {
    const [rows] = await pool.query(
        `SELECT sem.academicYear AS year, sem.semesterNo AS semester,
                sb.band, sbe.role, sbe.centre
         FROM semesterBandEducator sbe
         JOIN semesterBand sb ON sb.semesterBandId = sbe.semesterBandId
         JOIN semester sem ON sem.semesterId = sb.semesterId
         WHERE sbe.educatorName = ?
         ORDER BY sem.academicYear DESC, sem.semesterNo DESC, sb.band`,
        [educatorName]
    );
    return rows;
}

// Checks if another educator is already using this email
async function emailTaken(email, id) {
    const [rows] = await pool.query(
        `SELECT educatorId FROM educator WHERE email = ? AND educatorId != ?`, [email, id]
    );
    return rows.length > 0;
}

async function updateEducator(id, firstName, lastName, email) {
    const [result] = await pool.query(
        `UPDATE educator SET educatorName = ?, email = ? WHERE educatorId = ?`,
        [joinName(firstName, lastName), email, id]
    );
    return result.affectedRows > 0;
}

async function updatePassword(id, newPassword) {
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE educator SET passwordHash = ? WHERE educatorId = ?`, [hash, id]);
}

module.exports = {
    getEducatorById, getEducatorByEmail, authenticate,
    createEducator, checkSignUpForm, emailExists, getProgrammes,
    splitName, joinName, checkForm, emailTaken, updateEducator, updatePassword
};
