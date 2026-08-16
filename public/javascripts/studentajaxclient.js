// Handles all data access for students/schools/cantres/teachers
// No DOM code here - other scripts call these functions and work with what they return

// helper to safely extract backend err msg or fallback to default msg
async function parseErrorMessage(res, defaultMsg) {
    try {
        const errData = await res.json();
        return errData.error || errData.message || defaultMsg;
    } catch {
        return defaultMsg;
    }
}

// retrieves list of all students
async function getAllStudents() {
    const res = await fetch(`/api/students`);
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to fetch students.'))
    return res.json();
}

// retrieves students assigned to a specific educator
async function getStudentsByEducator(educatorId) {
    const res = await fetch(`/api/educators/${educatorId}/students`);
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to fetch educator students.'))
    return res.json();
}

// retrieves single student by id (returns null if not found)
async function getStudent(studentId) {
    const res = await fetch(`/api/students/${studentId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to fetch student.'));
    return res.json();
}

// creates new student record
async function addStudent(studentData) {
    const res = await fetch(`/api/students`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(studentData)
    });
    if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'Failed to add student'));
    }
    return res.json();
}

// updates existing student record
async function updateStudent(studentId, studentData) {
    const res = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(studentData)
    });
    if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'Failed to update student'));
    }
    return res.json();
}

// deletes student record by id
async function deleteStudent(studentId) {
    const res = await fetch(`/api/students/${studentId}`, {method: 'DELETE'});
    if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'Failed to delete student.'));
    }
    return res.json();
}

// retrieves full progress report data for a student
async function getStudentProgress(studentId) {
    const res = await fetch(`/api/students/${studentId}/progress`);
    if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'Failed to fetch student progress.'));
    }
    return res.json();
}

// retrieves reference lists for form dropdowns
async function getSchools() {
    const res = await fetch(`/api/schools`);
    if (!res.ok) return [];
    return res.json();
}

async function getCentres() {
    const res = await fetch(`/api/centres`);
    if (!res.ok) return [];
    return res.json();
}

async function getEducators(centreId) {
    const url = centreId ? `/api/educators?centreId=${centreId}` : `/api/educators`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
}

async function getSemesters() {
    const res = await fetch(`/api/semesters`);
    if (!res.ok) return [];
    return res.json();
}

async function getBands() {
    const res = await fetch(`/api/bands`);
    if (!res.ok) return [];
    return res.json();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getAllStudents,
        getStudentsByEducator,
        getStudent,
        addStudent,
        updateStudent,
        deleteStudent,
        getStudentProgress,
        getSchools,
        getCentres,
        getEducators,
        getSemesters,
        getBands
    };
}