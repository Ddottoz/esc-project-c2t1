const uploadService = require("../../../services/uploadService");

const uploadModel = require("../../../models/upload");
const llmAdapter = require("../../../models/llmAdapter");
const errorsModel = require("../../../models/error");

jest.mock("../../../models/upload");
jest.mock("../../../models/llmAdapter");
jest.mock("../../../models/error");

describe("UploadService", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("createAssessmentSubmission", () => {

        test("should analyze PDF and create submission successfully", async () => {

            const analysis = {
                transcription: "He ran.",
                errors: [
                    {
                        type: "Capitalization",
                        original: "he ran.",
                        correction: "He ran.",
                        explanation: "Sentence should begin with a capital letter.",
                        confidence: 0.98
                    }
                ],
                diagnosticSummary: "The student demonstrates basic writing ability."
            };

            const file = {
                filename: "test.pdf",
                path: "/uploads/test.pdf"
            };

            const submissionResult = {
                insertId: 123
            };

            llmAdapter.analyzePdf.mockResolvedValue(analysis);

            uploadModel.createAssessmentSubmission
                .mockResolvedValue(submissionResult);

            errorsModel.deleteErrors
                .mockResolvedValue({});

            errorsModel.insertError
                .mockResolvedValue({});

            uploadModel.createDiagnosticSummary
                .mockResolvedValue({});

            uploadModel.setAssessmentAssigned
                .mockResolvedValue({});

            const result =
                await uploadService.createAssessmentSubmission(
                    10,
                    file,
                    1
                );

            expect(result).toEqual(submissionResult);

            // LLM was called
            expect(llmAdapter.analyzePdf)
                .toHaveBeenCalledWith("/uploads/test.pdf");

            // Existing errors were deleted
            expect(errorsModel.deleteErrors)
                .toHaveBeenCalledWith(10);

            // Submission was created
            expect(uploadModel.createAssessmentSubmission)
                .toHaveBeenCalledWith(
                    10,
                    expect.any(Date),
                    "/public/uploads/test.pdf"
                );

            // Error was inserted
            expect(errorsModel.insertError)
                .toHaveBeenCalledWith(
                    10,
                    "he ran.",
                    "Capitalization"
                );

            // Diagnostic summary was stored
            expect(uploadModel.createDiagnosticSummary)
                .toHaveBeenCalledWith(
                    10,
                    "The student demonstrates basic writing ability."
                );

            // Assessment status was updated
            expect(uploadModel.setAssessmentAssigned)
                .toHaveBeenCalledWith(10);
        });


        test("should not call LLM when analysis is disabled", async () => {

            const file = {
                filename: "test.pdf",
                path: "/uploads/test.pdf"
            };

            uploadModel.createAssessmentSubmission
                .mockResolvedValue({ insertId: 1 });

            errorsModel.deleteErrors
                .mockResolvedValue({});

            errorsModel.insertError
                .mockResolvedValue({});

            uploadModel.createDiagnosticSummary
                .mockResolvedValue({});

            uploadModel.setAssessmentAssigned
                .mockResolvedValue({});

            const result =
                await uploadService.createAssessmentSubmission(
                    10,
                    file,
                    0
                );

            expect(llmAdapter.analyzePdf)
                .not.toHaveBeenCalled();

            expect(result).toEqual({ insertId: 1 });

            expect(uploadModel.createAssessmentSubmission)
                .toHaveBeenCalled();
        });


        test("should insert multiple errors", async () => {

            const analysis = {
                transcription: "he go school",
                errors: [
                    {
                        type: "Capitalization",
                        original: "he",
                        correction: "He"
                    },
                    {
                        type: "Grammar",
                        original: "he go",
                        correction: "he goes"
                    }
                ],
                diagnosticSummary: "Several errors were identified."
            };

            const file = {
                filename: "test.pdf",
                path: "/uploads/test.pdf"
            };

            llmAdapter.analyzePdf.mockResolvedValue(analysis);

            uploadModel.createAssessmentSubmission
                .mockResolvedValue({ insertId: 1 });

            errorsModel.deleteErrors.mockResolvedValue({});
            errorsModel.insertError.mockResolvedValue({});
            uploadModel.createDiagnosticSummary.mockResolvedValue({});
            uploadModel.setAssessmentAssigned.mockResolvedValue({});

            await uploadService.createAssessmentSubmission(
                10,
                file,
                1
            );

            expect(errorsModel.insertError)
                .toHaveBeenCalledTimes(2);

            expect(errorsModel.insertError)
                .toHaveBeenNthCalledWith(
                    1,
                    10,
                    "he",
                    "Capitalization"
                );

            expect(errorsModel.insertError)
                .toHaveBeenNthCalledWith(
                    2,
                    10,
                    "he go",
                    "Grammar"
                );
        });


        test("should propagate LLM errors", async () => {

            const file = {
                filename: "test.pdf",
                path: "/uploads/test.pdf"
            };

            llmAdapter.analyzePdf
                .mockRejectedValue(
                    new Error("OpenAI API failed")
                );

            await expect(
                uploadService.createAssessmentSubmission(
                    10,
                    file,
                    1
                )
            ).rejects.toThrow("OpenAI API failed");

            expect(uploadModel.createAssessmentSubmission)
                .not.toHaveBeenCalled();
        });
    });


    describe("getAllUploads", () => {

        test("should return uploads from model", async () => {

            const uploads = [
                {
                    id: 1,
                    date: "2026-08-01",
                    filepath: "/uploads/test.pdf"
                }
            ];

            uploadModel.getAllUploads
                .mockResolvedValue(uploads);

            const result =
                await uploadService.getAllUploads(10);

            expect(result).toEqual(uploads);

            expect(uploadModel.getAllUploads)
                .toHaveBeenCalledWith(10);
        });
    });


    describe("getAssessmentInfoFromId", () => {

        test("should return assessment information", async () => {

            const assessment = {
                studentId: 1,
                studentAssessmentId: 10,
                academicYear: "2026",
                semNo: 1,
                assessmentType: "Writing",
                band: 3
            };

            uploadModel.getAssessmentInfoFromId
                .mockResolvedValue(assessment);

            const result =
                await uploadService.getAssessmentInfoFromId(10);

            expect(result).toEqual(assessment);

            expect(uploadModel.getAssessmentInfoFromId)
                .toHaveBeenCalledWith(10);
        });
    });
});