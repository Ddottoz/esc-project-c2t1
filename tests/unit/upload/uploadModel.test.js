const pool = require("../../../models/db");
const uploadModel = require("../../../models/upload");

jest.mock("../../../models/db", () => ({
    query: jest.fn()
}));

describe("UploadModel", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });


    describe("createAssessmentSubmission", () => {

        test("should insert assessment submission", async () => {

            const result = {
                insertId: 123
            };

            pool.query.mockResolvedValue([result]);

            const response =
                await uploadModel.createAssessmentSubmission(
                    10,
                    new Date("2026-08-13"),
                    "/public/uploads/test.pdf"
                );

            expect(response).toEqual(result);

            expect(pool.query).toHaveBeenCalledTimes(1);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining("INSERT INTO assessmentSubmission"),
                [
                    10,
                    expect.any(Date),
                    1,
                    "/public/uploads/test.pdf",
                    0
                ]
            );
        });
    });


    describe("createDiagnosticSummary", () => {

        test("should create diagnostic summary", async () => {

            const result = {
                insertId: 456
            };

            pool.query.mockResolvedValue([result]);

            const response =
                await uploadModel.createDiagnosticSummary(
                    10,
                    "Student demonstrates good literacy skills."
                );

            expect(response).toEqual(result);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining("INSERT INTO assessment_analysis"),
                [
                    10,
                    "Student demonstrates good literacy skills.",
                    0
                ]
            );
        });
    });


    describe("getAllUploads", () => {

        test("should return all uploads", async () => {

            const rows = [
                {
                    id: 1,
                    date: "2026-08-13",
                    filepath: "/uploads/test.pdf"
                }
            ];

            pool.query.mockResolvedValue([rows]);

            const result =
                await uploadModel.getAllUploads(10);

            expect(result).toEqual(rows);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining(
                    "WHERE studentAssessmentId = ?"
                ),
                [10]
            );
        });
    });


    describe("setAssessmentAssigned", () => {

        test("should update assessment status", async () => {

            const dbResult = {
                affectedRows: 1
            };

            pool.query.mockResolvedValue([dbResult]);

            const result =
                await uploadModel.setAssessmentAssigned(10);

            expect(result).toEqual(dbResult);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining(
                    "UPDATE studentAssessment"
                ),
                [10]
            );
        });
    });


    describe("getAssessmentInfoFromId", () => {

        test("should return assessment information", async () => {

            const assessment = {
                studentId: 1,
                studentAssessmentId: 10,
                academicYear: "2026",
                semNo: 1,
                semId: 2,
                assessmentType: "Writing",
                band: 3
            };

            pool.query.mockResolvedValue([
                [assessment]
            ]);

            const result =
                await uploadModel.getAssessmentInfoFromId(10);

            expect(result).toEqual(assessment);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining(
                    "where studentAssessmentId = ?"
                ),
                [10]
            );
        });
    });
});