// Handles all data access for students/schools/cantres/teachers
// No DOM code here - other scripts call these functions and work with what they return

async function getAllStudents() {
    const res = await fetch(`/api/students`);
    return res.json();
}

// Finds 1 student by id/undefined if no match
async function getStudent(id) {
    const res = await fetch(`/api/students/${id}`);
    if (!res.ok) return null;
    return res.json();
}

// Adds a new student 
async function addStudent(studentData) {
    const res = await fetch(`/api/students`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(studentData)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add student');
    }

    return res.json();
}

// Overwrite existing student data (keeps same id)
// Throws if server rejects the update
async function updateStudent(id, studentData) {
    const res = await fetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(studentData)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update student');
    }

    return res.json();
}

async function getSchools() {
    const res = await fetch(`/api/schools`);
    return res.json();
}

async function getCentres() {
    const res = await fetch(`/api/centres`);
    return res.json();
}

async function getTeachers() {
    const res = await fetch(`/api/teachers`);
    return res.json();
}