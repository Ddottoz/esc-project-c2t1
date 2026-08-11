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

module.exports = {getEducatorById, splitName, joinName, checkForm, emailTaken, updateEducator, updatePassword};
