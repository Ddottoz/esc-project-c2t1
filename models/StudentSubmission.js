class StudentSubmission {
  constructor({
    submissionId,
    studentName,
    filepath,
    submissionText,
    submittedDate,
    assessmentType,
    assessmentComponent,
    band,
    passingMark,
    score,
    rubrics,
    semesterId,
    academicYear,
    semesterNo,
    totalMark
  }) {
    this.submissionId = submissionId;
    this.studentName = studentName;
    this.filepath = filepath;
    this.submissionText = submissionText;
    this.submittedDate = submittedDate;
    this.assessmentType = assessmentType;
    this.assessmentComponent = assessmentComponent;
    this.band = band;
    this.passingMark = passingMark;
    this.score = score;
    this.rubrics = rubrics;
    this.semesterId = semesterId;
    this.academicYear = academicYear;
    this.semesterNo = semesterNo;
    this.totalMark = totalMark;
  }
}

module.exports = StudentSubmission;