const pool = require("../../models/db");
const uploadModel = require("../../models/upload");

jest.mock("../../models/db");

describe("uploadModel test", () => {

    test("testing uploadModel.uploadPdf()", async () => {

        pool.query.mockResolvedValue([{}]);

        await uploadModel.uploadPdf(
            "report.pdf",
            "123.pdf",
            "/public/uploads/123.pdf"
        );

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO pdf_files"),
            [
                "report.pdf",
                "123.pdf",
                "/public/uploads/123.pdf"
            ]
        );

    });

    test("testing uploadModel.getAllUploads()", async () => {

        const fakeRows = [
            {
                id: 1,
                fileName: "report.pdf",
                filePath: "/public/uploads/report.pdf"
            }
        ];

        pool.query.mockResolvedValue([fakeRows]);

        const result = await uploadModel.getAllUploads();

        expect(result).toEqual(fakeRows);
    });

});