const pool = require("../models/db");

async function findBySemesterBandAndAssessmentType(semesterId, band, assessmentType) {
  const [semesterRows] =
    await pool.execute(
       `SELECT
         semester.semesterId,
         semester.academicYear,
         semester.semesterNo,
         semesterBand.semesterBandId

       FROM semester

       LEFT JOIN semesterBand
         ON semesterBand.semesterId = semester.semesterId
        AND semesterBand.band = ?

       WHERE semester.semesterId = ?

       LIMIT 1`,
      [
        band,
        semesterId
      ]
    );


  const [submissionRows] =
    await pool.execute(
      `SELECT
         student_assessment.studentAssessmentId,
         student_assessment.studentId,
         TRIM(CONCAT(
           COALESCE(student.firstName, ''),
           ' ',
           COALESCE(student.lastName, '')
         )) AS studentName,
         student_assessment.score,
         student_assessment.status,
         assessment.assessmentType,

         DATE_FORMAT(
           student_assessment.dueDate,
           '%Y-%m-%d'
         ) AS dueDateSort,

         DATE_FORMAT(
           student_assessment.dueDate,
           '%b %e'
         ) AS dueDate,

         CASE
           WHEN assessment_analysis.submissionId
                IS NULL
             THEN 0
           ELSE 1
         END AS hasAnalysis

       FROM studentAssessment
            student_assessment

       INNER JOIN assessment
         ON assessment.assessmentId =
            student_assessment.assessmentId

       INNER JOIN student
         ON student.studentId =
            student_assessment.studentId

       LEFT JOIN assessment_analysis
         ON assessment_analysis.submissionId =
            student_assessment.studentAssessmentId

       WHERE student_assessment.semesterId = ?
         AND LOWER(assessment.band) =
             LOWER(?)
         AND LOWER(assessment.assessmentType) =
             LOWER(?)

       ORDER BY
         student_assessment.studentId,
         student_assessment.studentAssessmentId`,
      [
        semesterId,
        band,
        assessmentType
      ]
    );


  const semesterRow =
    semesterRows[0] ||
    {};


  const semester = {
    semesterId:
      valueOrNA(
        semesterRow.semesterId
      ),

    academicYear:
      valueOrNA(
        semesterRow.academicYear
      ),

    semesterNo:
      valueOrNA(
        semesterRow.semesterNo
      ),

    semesterBandId:
      valueOrNA(
        semesterRow.semesterBandId
      )
  };


  const submissions =
    submissionRows.map(
      function (row) {
        const status = normaliseStatus(row.status);


        return {
          studentAssessmentId:
            row.studentAssessmentId,

          studentId:
            valueOrNA(
              row.studentId
            ),

          studentName:
            valueOrNA(
              row.studentName
            ),

          score:
            status.value === "Graded" &&
            hasValue(row.score)
              ? row.score
              : "--",

          status:
            status.value,

          statusClass:
            status.className,

          dueDate:
            valueOrNA(
              row.dueDate
            ),

          dueDateSort:
            hasValue(row.dueDateSort)
              ? row.dueDateSort
              : "",

          hasAnalysis:
            Boolean(
              row.hasAnalysis
            )
        };
      }
    );


  return {
    band:
      valueOrNA(band),

    assessmentType:
      submissionRows.length > 0
        ? valueOrNA(
            submissionRows[0]
              .assessmentType
          )
        : valueOrNA(
            assessmentType
          ),

    semester:
      semester,

    submissions:
      submissions
  };
}


function normaliseStatus(status) {
  const cleanStatus = String(status || "").trim().toLowerCase();


  if (cleanStatus === "graded") {
    return {
      value: "Graded",
      className: "graded"
    };
  }


  if (cleanStatus === "assigned") {
    return {
      value: "Assigned",
      className: "assigned"
    };
  }


  return {
    value: "NA",
    className: "unavailable"
  };
}


function hasValue(value) {
  return (value !== null && value !== undefined && String(value).trim() !== "");
}


function valueOrNA(value) {
  return hasValue(value)
    ? value
    : "NA";
}


module.exports = {
  findBySemesterBandAndAssessmentType
};
