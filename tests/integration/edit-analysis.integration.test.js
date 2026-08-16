const request = require("supertest");
const express = require("express");

const viewAnalysisRouter = require("../../routes/viewAnalysisRoutes");
const pool = require("../../models/db");

const app = express();

app.use(express.json());
app.use("/viewanalysis", viewAnalysisRouter);

jest.setTimeout(15000);

let submissionId;
let originalAnalysis;
let originalStudentAssessment;
let originalErrors;

beforeAll(async () => {
  const [rows] = await pool.execute(`
    SELECT
      aa.submissionId,
      aa.diagnosticSummary,
      aa.isAccepted,
      sa.score,
      sa.status
    FROM assessment_analysis aa
    JOIN studentAssessment sa
      ON sa.studentAssessmentId = aa.submissionId
    LIMIT 1
  `);

  if (rows.length === 0) {
    throw new Error("Test database needs at least one assessment analysis.");
  }

  submissionId = rows[0].submissionId;

  originalAnalysis = {
    diagnosticSummary: rows[0].diagnosticSummary,
    isAccepted: rows[0].isAccepted
  };

  originalStudentAssessment = {
    score: rows[0].score,
    status: rows[0].status
  };

  const [errorRows] = await pool.execute(
    `SELECT detectedError, errorCategory
     FROM assessment_analysis_error
     WHERE submissionId = ?
     ORDER BY errorId`,
    [submissionId]
  );

  originalErrors = errorRows;
});

afterAll(async () => {
  await pool.execute(
    `UPDATE assessment_analysis
     SET diagnosticSummary = ?, isAccepted = ?
     WHERE submissionId = ?`,
    [
      originalAnalysis.diagnosticSummary,
      originalAnalysis.isAccepted,
      submissionId
    ]
  );

  await pool.execute(
    `UPDATE studentAssessment
     SET score = ?, status = ?
     WHERE studentAssessmentId = ?`,
    [
      originalStudentAssessment.score,
      originalStudentAssessment.status,
      submissionId
    ]
  );

  await pool.execute(
    `DELETE FROM assessment_analysis_error
     WHERE submissionId = ?`,
    [submissionId]
  );

  for (const error of originalErrors) {
    await pool.execute(
      `INSERT INTO assessment_analysis_error
       (submissionId, detectedError, errorCategory)
       VALUES (?, ?, ?)`,
      [submissionId, error.detectedError, error.errorCategory]
    );
  }

  await pool.end();
});

describe("Edit Analysis Integration Test", () => {
  test("invalid analysis is rejected and database remains unchanged", async () => {
    const [beforeRows] = await pool.execute(
      `SELECT diagnosticSummary, isAccepted
       FROM assessment_analysis
       WHERE submissionId = ?`,
      [submissionId]
    );

    const response = await request(app)
      .put(`/viewanalysis/${submissionId}`)
      .send({
        diagnosticSummary: "",
        detectedErrors: ["teh"],
        errorCategories: ["Spelling"],
        mark: "15"
      });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.errors).toContain(
      "Diagnostic summary is required."
    );

    const [afterRows] = await pool.execute(
      `SELECT diagnosticSummary, isAccepted
       FROM assessment_analysis
       WHERE submissionId = ?`,
      [submissionId]
    );

    expect(afterRows).toEqual(beforeRows);
  });

  test("editing analysis updates the analysis and resets it to Assigned", async () => {
    const response = await request(app)
      .put(`/viewanalysis/${submissionId}`)
      .send({
        diagnosticSummary: "Spelling and calculation errors.",
        detectedErrors: ["teh", "3 + 2 = 6"],
        errorCategories: ["Spelling", "Calculation"],
        mark: "15"
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);

    const [analysisRows] = await pool.execute(
      `SELECT diagnosticSummary, isAccepted
       FROM assessment_analysis
       WHERE submissionId = ?`,
      [submissionId]
    );

    expect(analysisRows[0].diagnosticSummary).toBe(
      "Spelling and calculation errors."
    );
    expect(Number(analysisRows[0].isAccepted)).toBe(0);

    const [studentRows] = await pool.execute(
      `SELECT status
       FROM studentAssessment
       WHERE studentAssessmentId = ?`,
      [submissionId]
    );

    expect(studentRows[0].status).toBe("Assigned");

    const [errorRows] = await pool.execute(
      `SELECT detectedError, errorCategory
       FROM assessment_analysis_error
       WHERE submissionId = ?
       ORDER BY errorId`,
      [submissionId]
    );

    expect(errorRows).toEqual([
      {
        detectedError: "teh",
        errorCategory: "Spelling"
      },
      {
        detectedError: "3 + 2 = 6",
        errorCategory: "Calculation"
      }
    ]);
  });
});