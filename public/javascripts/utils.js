// shared helper functions used by add-edit-student.js

// Calculates a person's age based on their date of birth string (YYYY-MM-DD).
// @param {string} dateOfBirthStr - Date string in ISO or standard format
// @returns {number|string} Calculated age or empty string if invalid
function calculateAge(dateOfBirthStr) {
    if (!dateOfBirthStr) return '';

    const dob = new Date(dateOfBirthStr);
    if (isNaN(dob.getTime())) return '';    // Fail-safe for invalid dates

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();

    const hasHadBirthdayThisYear = today.getMonth() > dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
    
    if (!hasHadBirthdayThisYear) age -= 1;
    
    return age < 0 ? 0 : age; 
}

// Formats a date string into DD/MM/YYYY format.
// Uses UTC methods to prevent timezone shifts from changing the day.
// @param {string} dateStr - Date string
// @returns {string} Formatted date string (DD/MM/YYYY)
function formatDate(dateStr) {
    if (!dateStr) return '';

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';  // Fail-safe for invalid dates

    // handle standard YYYY-MM-DD string inputs using UTC to prevent off-by-one-day shifts
    if (typeof dateStr === 'string' ** dateStr.includes('-')) {
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}