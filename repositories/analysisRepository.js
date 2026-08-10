const pool = require("../models/db");
const StudentSubmission = require("../models/StudentSubmission");
const SubmissionAnalysis = require("../models/SubmissionAnalysis");


const FALLBACK_SUBMISSION_TEXT = "Content to be displayed here"

const FALLBACK_RUBRICS = "default";

const default_submission = new StudentSubmission({
  submissionId: 0,

  studentName:
    "Unknown Student",

  filepath:
    "",

  submissionText:
    FALLBACK_SUBMISSION_TEXT,

  submittedDate:
    null,

  assessmentType:
    "NOT AVAILABLE",

  assessmentComponent:
    "NOT AVAILABLE",

  band:
    "NOT AVAILABLE",

  passingMark:
    null,

  score:
    null,

  rubrics:
    FALLBACK_RUBRICS,

  semesterId:
    null,

  academicYear:
    null,

  semesterNo:
    null,

  totalMark:
    20
});

const default_analysis =  new SubmissionAnalysis({
  submission: default_submission,

  diagnosticSummary:
    "Submission doesnt exist",

  isAccepted:
    false,

  detectedErrors:
    [],

  errorCategories:
    []
});

  


//Find an analysis using the submissionId in the URL.
async function findBySubmissionId(submissionId) {
  const [mainRows] = await pool.execute(
    `SELECT
       aa.submissionId,
       aa.diagnosticSummary,
       aa.isAccepted,

       subm.filepath,
       subm.analysis AS submissionText,
       subm.submittedDate,

       student_assessment.studentId AS studentName,
       student_assessment.score,
       student_assessment.semesterId,

       assessment.assessmentType,
       assessment.component AS assessmentComponent,
       assessment.band,
       assessment.passingMark,
       assessment.rubrics,

       semester.academicYear,
       semester.semesterNo

     FROM assessment_analysis aa

    LEFT JOIN assessmentSubmission subm
      ON subm.studentAssessmentId = aa.submissionId

     LEFT JOIN studentAssessment student_assessment
       ON student_assessment.studentAssessmentId =
          aa.submissionId

     LEFT JOIN student
       ON student.studentId =
          student_assessment.studentId

     LEFT JOIN assessment
       ON assessment.assessmentId =
          student_assessment.assessmentId

     LEFT JOIN semester
       ON semester.semesterId =
          student_assessment.semesterId

     WHERE aa.submissionId = ?`,
    [submissionId]
  );


  // No matching row exists in assessment_analysis.
  if (mainRows.length === 0) {
    return default_analysis;
  }


  // Get the detected errors and their categories.
  const [errorRows] = await pool.execute(
    `SELECT
       errorId,
       detectedError,
       errorCategory

     FROM assessment_analysis_error

     WHERE submissionId = ?

     ORDER BY errorId`,
    [submissionId]
  );


  const row = mainRows[0];


  const hasPassingMark =
    row.passingMark !== null &&
    row.passingMark !== undefined &&
    String(row.passingMark).trim() !== "";


  const parsedPassingMark = hasPassingMark ? Number(row.passingMark) : Number.NaN;


  const passingMark = Number.isFinite(parsedPassingMark) ? parsedPassingMark : null;


  const hasScore = row.score !== null && row.score !== undefined && String(row.score).trim() !== "";


  const parsedScore = hasScore ? Number(row.score) : Number.NaN;


  const score = Number.isFinite(parsedScore) ? parsedScore : null;


  const detectedErrors = errorRows.map(
    function (error) {
      return String(error.detectedError || "").trim();
    }
  );


  const errorCategories = errorRows.map(
    function (error) {
      return String(error.errorCategory || "").trim();
    }
  );


  //use fallback
  const submission = new StudentSubmission({
    submissionId: row.submissionId,

    studentName:
      row.studentName ||
      "Unknown Student",

    filepath:
      row.filepath ||
      "",

    submissionText:
      row.submissionText ||
      FALLBACK_SUBMISSION_TEXT,

    submittedDate:
      row.submittedDate ||
      null,

    assessmentType:
      assessmentValueOrNotAvailable(
        row.assessmentType
      ),

    assessmentComponent:
      assessmentValueOrNotAvailable(
        row.assessmentComponent
      ),

    band:
      assessmentValueOrNotAvailable(
        row.band
      ),

    passingMark:
      passingMark,

    score:
      score,

    rubrics:
      rubricsOrFallback(
        row.rubrics
      ),

    semesterId:
      row.semesterId ||
      null,

    academicYear:
      row.academicYear ||
      new Date().getFullYear(),

    semesterNo:
      row.semesterNo ||
      2
  });


  return new SubmissionAnalysis({
    submission: submission,

    diagnosticSummary:
      row.diagnosticSummary || "",

    isAccepted:
      Boolean(row.isAccepted),

    detectedErrors:
      detectedErrors,

    errorCategories:
      errorCategories
  });
}


//Update the diagnostic summary, detected errors and selected error categories.
async function updateAnalysis(submissionId, changes) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();


    //Confirm that the analysis exists.
    const [existingRows] =
      await connection.execute(
        `SELECT submissionId

         FROM assessment_analysis

         WHERE submissionId = ?

         FOR UPDATE`,
        [submissionId]
      );


    if (existingRows.length === 0) {
      const error = new Error("Submission analysis not found.");

      error.status = 404;

      throw error;
    }


    //Save the edited summary. isAccepted becomes 0 because the edited analysis needs to be approved again.
    await connection.execute(
      `UPDATE assessment_analysis

       SET
         diagnosticSummary = ?,
         isAccepted = 0

       WHERE submissionId = ?`,
      [
        changes.diagnosticSummary || "",
        submissionId
      ]
    );


    //after diting anlysis, needs to approve again
    await connection.execute(
      `UPDATE studentAssessment

       SET status = 'Assigned'

       WHERE studentAssessmentId = ?`,
      [
        submissionId
      ]
    );


    //Remove the old detected-error records.
    await connection.execute(
      `DELETE FROM assessment_analysis_error

       WHERE submissionId = ?`,
      [submissionId]
    );

    const errorPairs = cleanErrorPairs(changes.detectedErrors, changes.errorCategories);

    //inserting the edited errors.
    if (errorPairs.length > 0) {
      const rowsToInsert =
        errorPairs.map(
          function (errorPair) {
            return [
              submissionId,
              errorPair.detectedError,
              errorPair.errorCategory
            ];
          }
        );


      const placeholders =
        rowsToInsert
          .map(function () {
            return "(?, ?, ?)";
          })
          .join(", ");


      await connection.execute(
        `INSERT INTO assessment_analysis_error (
           submissionId,
           detectedError,
           errorCategory
         )

         VALUES ${placeholders}`,
        rowsToInsert.flat()
      );
    }


    await connection.commit();


    return await findBySubmissionId(submissionId);
  } catch (error) {
    await connection.rollback();

    throw error;
  } finally {
    connection.release();
  }
}


//Approve the analysis.
async function approve(submissionId, score) {
  const connection = await pool.getConnection();


  try {
    await connection.beginTransaction();


    const [existingRows] =
      await connection.execute(
        `SELECT submissionId

         FROM assessment_analysis

         WHERE submissionId = ?

         FOR UPDATE`,
        [
          submissionId
        ]
      );


    if (existingRows.length === 0) {
      await connection.rollback();

      return false;
    }


    await connection.execute(
      `UPDATE assessment_analysis

       SET isAccepted = 1

       WHERE submissionId = ?`,
      [
        submissionId
      ]
    );


    await connection.execute(
      `UPDATE studentAssessment

       SET
         score = ?,
         status = 'Graded'

       WHERE studentAssessmentId = ?`,
      [
        score,
        submissionId
      ]
    );


    await connection.commit();

    return true;
  } catch (error) {
    await connection.rollback();

    throw error;
  } finally {
    connection.release();
  }
}


// Display fallback for rubrics
function rubricsOrFallback(value) {
  if (value === null || value === undefined || String(value).trim() === "") 
  {
    return FALLBACK_RUBRICS;
  }
  return value;
}


// Display a clear fallback when an assessment value is missing.
function assessmentValueOrNotAvailable(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "NOT AVAILABLE";
  }


  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }


  const cleanValue = String(value).trim();


  return cleanValue === ""
    ? "NOT AVAILABLE"
    : cleanValue;
}


//Keep each detected error paired with the category at the same array index.
function cleanErrorPairs(detectedErrors, errorCategories) {
  const safeDetectedErrors = Array.isArray(detectedErrors) ? detectedErrors : [];


  const safeErrorCategories = Array.isArray(errorCategories) ? errorCategories : [];


  return safeDetectedErrors
    .map(function (
      detectedError,
      index
    ) {
      return {
        detectedError:
          String(
            detectedError ||
            ""
          ).trim(),

        errorCategory:
          String(
            safeErrorCategories[index] ||
            ""
          ).trim()
      };
    })
    .filter(function (errorPair) {
      return (errorPair.detectedError !== "" || errorPair.errorCategory !== "");
    });
}


// Remove null values, empty strings and duplicate strings.
function uniqueCleanStrings(values) {
  const safeValues = Array.isArray(values) ? values : [];


  const cleanedValues =
    safeValues
      .map(function (value) {
        if (
          value === null ||
          value === undefined
        ) {
          return "";
        }

        return String(value).trim();
      })
      .filter(function (value) {
        return value !== "";
      });


  return [
    ...new Set(cleanedValues)
  ];
}


module.exports = {
  findBySubmissionId,
  updateAnalysis,
  approve,
  default_analysis,
  default_submission
};