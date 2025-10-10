import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import PreviewFormWrapper from "./PreviewFormWrapper";
import { apiClient } from "../api/client";

// Mock the PreviewForm component
vi.mock("./PreviewForm", () => ({
  default: ({ questions, onSubmit }: any) => (
    <div data-testid="preview-form">
      <div data-testid="form-title">{questions?.[0]?.title || "No title"}</div>
      <button
        data-testid="submit-button"
        onClick={() =>
          onSubmit({ questionId: "test", answers: {}, timestamp: new Date() })
        }
      >
        Submit
      </button>
    </div>
  ),
}));

// Mock the API client
vi.mock("../api/client", () => ({
  apiClient: {
    getForm: vi.fn(),
    createResponse: vi.fn(),
  },
}));

// Mock react-router-dom useParams
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn(),
  };
});

const renderWithRouter = (component: React.ReactElement, route = "/") => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("PreviewFormWrapper", () => {
  const mockForm = {
    _id: "test-form-id",
    title: "Test Form",
    description: "Test Description",
    sections: [
      {
        id: "section1",
        title: "Section 1",
        questions: [
          {
            id: "q1",
            type: "text",
            title: "Question 1",
            required: true,
          },
        ],
      },
    ],
    questions: [
      {
        id: "q2",
        type: "multiple-choice",
        title: "Question 2",
        options: ["Option 1", "Option 2"],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default successful API response
    (apiClient.getForm as Mock).mockResolvedValue({ form: mockForm });
    (apiClient.createResponse as Mock).mockResolvedValue({ success: true });
  });

  describe("Happy Path", () => {
    it("should preview form with valid data", async () => {
      // Mock useParams to return a valid form ID
      const { useParams } = await import("react-router-dom");
      (useParams as Mock).mockReturnValue({ id: "test-form-id" });

      renderWithRouter(<PreviewFormWrapper />);

      // Should show loading initially
      expect(screen.getByText("Loading form...")).toBeInTheDocument();

      // Wait for form to load and render
      await waitFor(() => {
        expect(screen.getByTestId("preview-form")).toBeInTheDocument();
      });

      // Check that the form data is correctly passed to PreviewForm
      expect(screen.getByTestId("form-title")).toHaveTextContent("Test Form");
      expect(apiClient.getForm).toHaveBeenCalledWith("test-form-id");
      expect(apiClient.getForm).toHaveBeenCalledTimes(1);
    });
  });

  describe("Input Verification", () => {
    it("should handle missing form ID", async () => {
      // Mock useParams to return undefined id
      const { useParams } = await import("react-router-dom");
      (useParams as Mock).mockReturnValue({ id: undefined });

      renderWithRouter(<PreviewFormWrapper />);

      // Should show loading but not make API call
      expect(screen.getByText("Loading form...")).toBeInTheDocument();
      expect(apiClient.getForm).not.toHaveBeenCalled();

      // Should eventually show form not found
      await waitFor(() => {
        expect(screen.getByText("Form not found")).toBeInTheDocument();
      });
    });
  });

  describe("Exception Handling", () => {
    it("should handle API fetch error", async () => {
      // Mock useParams to return a valid form ID
      const { useParams } = await import("react-router-dom");
      (useParams as Mock).mockReturnValue({ id: "test-form-id" });

      // Mock API to reject
      (apiClient.getForm as Mock).mockRejectedValue(new Error("API Error"));

      renderWithRouter(<PreviewFormWrapper />);

      // Should show loading initially
      expect(screen.getByText("Loading form...")).toBeInTheDocument();

      // Wait for error to be displayed
      await waitFor(() => {
        expect(screen.getByText("Failed to load form")).toBeInTheDocument();
      });

      expect(apiClient.getForm).toHaveBeenCalledWith("test-form-id");
    });

    it("should handle form submission error", async () => {
      // Mock useParams to return a valid form ID
      const { useParams } = await import("react-router-dom");
      (useParams as Mock).mockReturnValue({ id: "test-form-id" });

      // Mock createResponse to reject
      (apiClient.createResponse as Mock).mockRejectedValue(
        new Error("Submission Error")
      );

      // Mock console.error to avoid test output noise
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      renderWithRouter(<PreviewFormWrapper />);

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId("preview-form")).toBeInTheDocument();
      });

      // Simulate form submission
      const submitButton = screen.getByTestId("submit-button");
      submitButton.click();

      // Wait for error to be logged
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Error submitting response:",
          expect.any(Error)
        );
      });

      expect(apiClient.createResponse).toHaveBeenCalledWith({
        formId: "test",
        answers: {},
        timestamp: expect.any(Date),
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Branching", () => {
    it("should display loading state", async () => {
      // Mock useParams to return a valid form ID
      const { useParams } = await import("react-router-dom");
      (useParams as Mock).mockReturnValue({ id: "test-form-id" });

      // Mock API to return a promise that doesn't resolve immediately
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      (apiClient.getForm as Mock).mockReturnValue(promise);

      renderWithRouter(<PreviewFormWrapper />);

      // Should show loading state
      expect(screen.getByText("Loading form...")).toBeInTheDocument();
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();

      // Resolve the promise
      resolvePromise!({ form: mockForm });

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId("preview-form")).toBeInTheDocument();
      });
    });

    it("should handle form with empty sections and questions", async () => {
      // Mock useParams to return a valid form ID
      const { useParams } = await import("react-router-dom");
      (useParams as Mock).mockReturnValue({ id: "test-form-id" });

      // Mock form with empty sections and questions
      const emptyForm = {
        _id: "empty-form-id",
        title: "Empty Form",
        description: "Form with no content",
        sections: [],
        questions: [],
      };

      (apiClient.getForm as Mock).mockResolvedValue({ form: emptyForm });

      renderWithRouter(<PreviewFormWrapper />);

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId("preview-form")).toBeInTheDocument();
      });

      // Check that empty arrays are handled correctly
      expect(screen.getByTestId("form-title")).toHaveTextContent("Empty Form");
    });

    it("should handle successful form submission", async () => {
      // Mock useParams to return a valid form ID
      const { useParams } = await import("react-router-dom");
      (useParams as Mock).mockReturnValue({ id: "test-form-id" });

      renderWithRouter(<PreviewFormWrapper />);

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId("preview-form")).toBeInTheDocument();
      });

      // Simulate form submission
      const submitButton = screen.getByTestId("submit-button");
      submitButton.click();

      // Wait for submission to complete
      await waitFor(() => {
        expect(apiClient.createResponse).toHaveBeenCalledWith({
          formId: "test",
          answers: {},
          timestamp: expect.any(Date),
        });
      });
    });
  });

  describe("Data Transformation", () => {
    it("should correctly transform API form data for PreviewForm", async () => {
      // Mock useParams to return a valid form ID
      const { useParams } = await import("react-router-dom");
      (useParams as Mock).mockReturnValue({ id: "test-form-id" });

      renderWithRouter(<PreviewFormWrapper />);

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId("preview-form")).toBeInTheDocument();
      });

      // The PreviewForm should receive the transformed data
      // Check that the form title is displayed correctly
      expect(screen.getByTestId("form-title")).toHaveTextContent("Test Form");
    });
  });
});
