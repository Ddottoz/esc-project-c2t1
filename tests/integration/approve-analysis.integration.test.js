const request = require("supertest");
const express = require("express");

const viewAnalysisRouter = require("../../routes/viewAnalysisRoutes");
const pool = require("../../models/db");

const app = express();

app.use(express.json());
app.use("/viewanalysis", viewAnalysisRouter);

jest.setTimeout(15000);

let submissionId;
let originalIsAccepted;
let originalScore;
let originalStatus;

beforeAll(async () => {
  const [rows] = await pool.execute(`
    SELECT
      aa.submissionId,
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
  originalIsAccepted = rows[0].isAccepted;
  originalScore = rows[0].score;
  originalStatus = rows[0].status;

  await pool.execute(
    `UPDATE assessment_analysis
     SET isAccepted = 0
     WHERE submissionId = ?`,
    [submissionId]
  );

  await pool.execute(
    `UPDATE studentAssessment
     SET status = 'Assigned'
     WHERE studentAssessmentId = ?`,
    [submissionId]
  );
});

afterAll(async () => {
  await pool.execute(
    `UPDATE assessment_analysis
     SET isAccepted = ?
     WHERE submissionId = ?`,
    [originalIsAccepted, submissionId]
  );

  await pool.execute(
    `UPDATE studentAssessment
     SET score = ?, status = ?
     WHERE studentAssessmentId = ?`,
    [originalScore, originalStatus, submissionId]
  );

  await pool.end();
});

describe("Approve Analysis Integration Test", () => {
  test("invalid mark is rejected and analysis remains unapproved", async () => {
    const response = await request(app)
      .patch(`/viewanalysis/${submissionId}/approve`)
      .send({
        mark: "abc"
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      message: "Enter a valid mark before approving."
    });

    const [analysisRows] = await pool.execute(
      `SELECT isAccepted
       FROM assessment_analysis
       WHERE submissionId = ?`,
      [submissionId]
    );

    expect(Number(analysisRows[0].isAccepted)).toBe(0);

    const [studentRows] = await pool.execute(
      `SELECT status
       FROM studentAssessment
       WHERE studentAssessmentId = ?`,
      [submissionId]
    );

    expect(studentRows[0].status).toBe("Assigned");
  });

  test("approving analysis saves the mark and changes status to Graded", async () => {
    const response = await request(app)
      .patch(`/viewanalysis/${submissionId}/approve`)
      .send({
        mark: "17.5"
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      isAccepted: true
    });

    const [analysisRows] = await pool.execute(
      `SELECT isAccepted
       FROM assessment_analysis
       WHERE submissionId = ?`,
      [submissionId]
    );

    expect(Number(analysisRows[0].isAccepted)).toBe(1);

    const [studentRows] = await pool.execute(
      `SELECT score, status
       FROM studentAssessment
       WHERE studentAssessmentId = ?`,
      [submissionId]
    );

    expect(Number(studentRows[0].score)).toBe(17.5);
    expect(studentRows[0].status).toBe("Graded");
  });
});