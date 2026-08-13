jest.mock("fs", () => ({
    createReadStream: jest.fn()
}));

const mockCreateFile = jest.fn();
const mockCreateResponse = jest.fn();

jest.mock("openai", () => {
    return jest.fn().mockImplementation(() => ({
        files: {
            create: mockCreateFile
        },
        responses: {
            create: mockCreateResponse
        }
    }));
});

const fs = require("fs");
const { analyzePdf } = require("../../../models/llmAdapter");

describe("LLMAdapter", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });


    test("should upload PDF and return parsed analysis", async () => {

        const analysis = {
            transcription: "He ran.",
            errors: [
                {
                    type: "Capitalization",
                    original: "he ran.",
                    correction: "He ran.",
                    explanation: "Sentence should start with a capital letter.",
                    confidence: 0.98
                }
            ],
            diagnosticSummary: "Minor capitalization error."
        };

        fs.createReadStream.mockReturnValue("mock-stream");

        mockCreateFile.mockResolvedValue({
            id: "file-123"
        });

        mockCreateResponse.mockResolvedValue({
            output_text: JSON.stringify(analysis)
        });

        const result =
            await analyzePdf("/uploads/test.pdf");

        expect(fs.createReadStream)
            .toHaveBeenCalledWith("/uploads/test.pdf");

        expect(mockCreateFile)
            .toHaveBeenCalledWith({
                file: "mock-stream",
                purpose: "user_data"
            });

        expect(mockCreateResponse)
            .toHaveBeenCalledWith(
                expect.objectContaining({
                    model: "gpt-5.5"
                })
            );

        expect(result).toEqual(analysis);
    });


    test("should throw error when OpenAI file upload fails", async () => {

        fs.createReadStream.mockReturnValue("mock-stream");

        mockCreateFile.mockRejectedValue(
            new Error("File upload failed")
        );

        await expect(
            analyzePdf("/uploads/test.pdf")
        ).rejects.toThrow("File upload failed");
    });


    test("should throw error when OpenAI response fails", async () => {

        fs.createReadStream.mockReturnValue("mock-stream");

        mockCreateFile.mockResolvedValue({
            id: "file-123"
        });

        mockCreateResponse.mockRejectedValue(
            new Error("OpenAI request failed")
        );

        await expect(
            analyzePdf("/uploads/test.pdf")
        ).rejects.toThrow("OpenAI request failed");
    });


    test("should throw error when response is invalid JSON", async () => {

        fs.createReadStream.mockReturnValue("mock-stream");

        mockCreateFile.mockResolvedValue({
            id: "file-123"
        });

        mockCreateResponse.mockResolvedValue({
            output_text: "This is not JSON"
        });

        await expect(
            analyzePdf("/uploads/test.pdf")
        ).rejects.toThrow();
    });
});