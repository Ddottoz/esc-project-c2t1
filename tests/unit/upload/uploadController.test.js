const uploadService = require("../../../services/uploadService");
const uploadController = require("../../../controllers/uploadController");

jest.mock("../../../services/uploadService");

describe("UploadController", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });


    describe("uploadPdf", () => {

        test("should return 400 when no PDF is uploaded", async () => {

            const req = {
                file: null,
                params: {
                    studentAssessmentId: "10"
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn(),
                redirect: jest.fn()
            };

            await uploadController.uploadPdf(req, res);

            expect(res.status)
                .toHaveBeenCalledWith(400);

            expect(res.send)
                .toHaveBeenCalledWith("No PDF uploaded");

            expect(uploadService.createAssessmentSubmission)
                .not.toHaveBeenCalled();
        });


        test("should process uploaded PDF and redirect", async () => {

            const req = {
                file: {
                    filename: "test.pdf",
                    path: "/uploads/test.pdf"
                },
                params: {
                    studentAssessmentId: "10"
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn(),
                redirect: jest.fn()
            };

            uploadService.createAssessmentSubmission
                .mockResolvedValue({
                    insertId: 123
                });

            await uploadController.uploadPdf(req, res);

            expect(
                uploadService.createAssessmentSubmission
            ).toHaveBeenCalledWith(
                "10",
                req.file,
                1
            );

            expect(res.redirect)
                .toHaveBeenCalledWith(
                    "/viewanalysis/10"
                );
        });


        test("should return 500 when upload service fails", async () => {

            const req = {
                file: {
                    filename: "test.pdf",
                    path: "/uploads/test.pdf"
                },
                params: {
                    studentAssessmentId: "10"
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn(),
                redirect: jest.fn()
            };

            uploadService.createAssessmentSubmission
                .mockRejectedValue(
                    new Error("Analysis failed")
                );

            await uploadController.uploadPdf(req, res);

            expect(res.status)
                .toHaveBeenCalledWith(500);

            expect(res.send)
                .toHaveBeenCalledWith(
                    "PDF uploaded, but analysis failed"
                );
        });
    });


    describe("showAllUploads", () => {

        test("should render uploads page", async () => {

            const files = [
                {
                    id: 1,
                    date: "2026-08-13",
                    filepath: "/uploads/test.pdf"
                }
            ];

            const assessment = {
                studentAssessmentId: 10,
                assessmentType: "Writing",
                band: 3
            };

            uploadService.getAllUploads
                .mockResolvedValue(files);

            uploadService.getAssessmentInfoFromId
                .mockResolvedValue(assessment);

            const req = {
                params: {
                    studentAssessmentId: "10"
                },
                query: {
                    message: ""
                }
            };

            const res = {
                render: jest.fn(),
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            await uploadController.showAllUploads(req, res);

            expect(uploadService.getAllUploads)
                .toHaveBeenCalledWith("10");

            expect(uploadService.getAssessmentInfoFromId)
                .toHaveBeenCalledWith("10");

            expect(res.render)
                .toHaveBeenCalledWith(
                    "upload",
                    {
                        studentAssessmentId: "10",
                        files: files,
                        assessment: assessment,
                        message: ""
                    }
                );
        });


        test("should return 500 when loading uploads fails", async () => {

            uploadService.getAllUploads
                .mockRejectedValue(
                    new Error("Database error")
                );

            const req = {
                params: {
                    studentAssessmentId: "10"
                },
                query: {}
            };

            const res = {
                render: jest.fn(),
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            await uploadController.showAllUploads(req, res);

            expect(res.status)
                .toHaveBeenCalledWith(500);

            expect(res.send)
                .toHaveBeenCalledWith(
                    "Failed to load uploads"
                );
        });
    });
});