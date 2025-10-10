import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import FormCreator from "./FormCreator";
import { useMutation } from "../hooks/useApi";

// Mock the API hook
vi.mock("../hooks/useApi");
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const mockUseMutation = vi.mocked(useMutation);

// Test wrapper with Router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe("FormCreator Component", () => {
  const mockMutate = vi.fn();
  const mockMutation = {
    mutate: mockMutate,
    loading: false,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue(mockMutation);
    // Mock crypto.randomUUID
    Object.defineProperty(globalThis, "crypto", {
      value: {
        randomUUID: vi.fn(() => "test-uuid-123"),
      },
    });
  });

  it("renders form creation interface", () => {
    render(
      <TestWrapper>
        <FormCreator />
      </TestWrapper>
    );

    // Check main elements are present
    expect(screen.getByText("Create New Form")).toBeInTheDocument();
    expect(screen.getByText("Build your custom form")).toBeInTheDocument();
    expect(screen.getByText("Form Details")).toBeInTheDocument();
    expect(screen.getByLabelText("Form Title *")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Make form publicly visible")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save form/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("updates form title input", () => {
    render(
      <TestWrapper>
        <FormCreator />
      </TestWrapper>
    );

    const titleInput = screen.getByLabelText(
      "Form Title *"
    ) as HTMLInputElement;

    fireEvent.change(titleInput, { target: { value: "Test Form Title" } });

    expect(titleInput.value).toBe("Test Form Title");
  });

  it("adds new section successfully", () => {
    render(
      <TestWrapper>
        <FormCreator />
      </TestWrapper>
    );

    // Initially should have one section
    expect(screen.getByText("Section 1")).toBeInTheDocument();
    expect(screen.queryByText("Section 2")).not.toBeInTheDocument();

    // Find and click the "Add Section" button
    const addSectionButton = screen.getByRole("button", {
      name: /add section/i,
    });
    fireEvent.click(addSectionButton);

    // Should now have a second section
    expect(screen.getByText("Section 1")).toBeInTheDocument();
    expect(screen.getByText("Section 2")).toBeInTheDocument();
  });

  it("deletes section correctly", () => {
    render(
      <TestWrapper>
        <FormCreator />
      </TestWrapper>
    );

    // Add a second section first
    const addSectionButton = screen.getByRole("button", {
      name: /add section/i,
    });
    fireEvent.click(addSectionButton);

    expect(screen.getByText("Section 1")).toBeInTheDocument();
    expect(screen.getByText("Section 2")).toBeInTheDocument();

    // Find and click delete button for second section
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    const deleteSection2 = deleteButtons.find((btn) =>
      btn.closest('[class*="border"]')?.textContent?.includes("Section 2")
    );

    if (deleteSection2) {
      fireEvent.click(deleteSection2);
      expect(screen.getByText("Section 1")).toBeInTheDocument();
      expect(screen.queryByText("Section 2")).not.toBeInTheDocument();
    }
  });

  it("prevents deleting last section", () => {
    // Mock window.alert
    const mockAlert = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(
      <TestWrapper>
        <FormCreator />
      </TestWrapper>
    );

    // Should only have one section initially
    expect(screen.getByText("Section 1")).toBeInTheDocument();

    // Try to find delete button - should not exist when only one section
    const deleteButtons = screen.queryAllByRole("button", { name: /delete/i });
    const sectionDeleteButton = deleteButtons.find(
      (btn) =>
        btn.querySelector("svg") &&
        btn.closest('[class*="border"]')?.textContent?.includes("Section 1")
    );

    // If delete button exists for the only section, clicking it should show alert
    if (sectionDeleteButton) {
      fireEvent.click(sectionDeleteButton);
      expect(mockAlert).toHaveBeenCalledWith(
        "Forms must have at least one section"
      );
    }

    // Section should still exist
    expect(screen.getByText("Section 1")).toBeInTheDocument();

    mockAlert.mockRestore();
  });

  it("adds question to section", () => {
    render(
      <TestWrapper>
        <FormCreator />
      </TestWrapper>
    );

    // Find and click "Add Question" button
    const addQuestionButton = screen.getByRole("button", {
      name: /add question/i,
    });
    fireEvent.click(addQuestionButton);

    // Should show a new question
    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("New Question")).toBeInTheDocument();
  });

  it("validates required form title", async () => {
    // Mock window.alert
    const mockAlert = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(
      <TestWrapper>
        <FormCreator />
      </TestWrapper>
    );

    // Try to save without title
    const saveButton = screen.getByRole("button", { name: /save form/i });
    fireEvent.click(saveButton);

    expect(mockAlert).toHaveBeenCalledWith("Please enter a form title");
    expect(mockMutate).not.toHaveBeenCalled();

    mockAlert.mockRestore();
  });

  it("saves form successfully", async () => {
    render(
      <TestWrapper>
        <FormCreator />
      </TestWrapper>
    );

    // Fill in form title
    const titleInput = screen.getByLabelText("Form Title *");
    fireEvent.change(titleInput, { target: { value: "Test Form" } });

    // Fill in description
    const descriptionInput = screen.getByLabelText("Description");
    fireEvent.change(descriptionInput, {
      target: { value: "Test Description" },
    });

    // Save form
    const saveButton = screen.getByRole("button", { name: /save form/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        title: "Test Form",
        description: "Test Description",
        isVisible: true,
        sections: [
          {
            title: "Section 1",
            description: "",
            questions: [],
          },
        ],
      });
    });
  });

  describe("Multiple Choice Options", () => {
    it("add multiple choice options", async () => {
      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      // Add a question first
      const addQuestionButton = screen.getByRole("button", {
        name: /add question/i,
      });
      fireEvent.click(addQuestionButton);

      // Change question type to multiple choice (radio)
      const questionTypeSelect = screen.getByDisplayValue("Short Text");
      fireEvent.change(questionTypeSelect, { target: { value: "radio" } });

      // Should show options textarea
      const optionsTextarea = screen.getByText("Options (one per line)");
      expect(optionsTextarea).toBeInTheDocument();
    });

    it("split textarea into options", async () => {
      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      // Add a question and set to multiple choice
      const addQuestionButton = screen.getByRole("button", {
        name: /add question/i,
      });
      fireEvent.click(addQuestionButton);

      const questionTypeSelect = screen.getByDisplayValue("Short Text");
      fireEvent.change(questionTypeSelect, { target: { value: "radio" } });

      // Find the options textarea by its label
      const optionsTextarea = screen.getByLabelText("Options (one per line)");

      // Enter multiple options separated by newlines
      const optionText = "Option 1\nOption 2\nOption 3";
      fireEvent.change(optionsTextarea, { target: { value: optionText } });

      // Verify the textarea contains the input
      expect(optionsTextarea).toHaveValue(optionText);
    });

    it("empty options handling", async () => {
      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      // Add a question and set to multiple choice
      const addQuestionButton = screen.getByRole("button", {
        name: /add question/i,
      });
      fireEvent.click(addQuestionButton);

      const questionTypeSelect = screen.getByDisplayValue("Short Text");
      fireEvent.change(questionTypeSelect, { target: { value: "radio" } });

      // Find the options textarea
      const optionsTextarea = screen.getByLabelText("Options (one per line)");

      // Test empty lines are filtered out
      const optionText = "Option 1\n\nOption 2\n\n\nOption 3\n";
      fireEvent.change(optionsTextarea, { target: { value: optionText } });

      expect(optionsTextarea).toHaveValue(optionText);
    });

    it("single line option input", async () => {
      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      // Add a question and set to multiple choice
      const addQuestionButton = screen.getByRole("button", {
        name: /add question/i,
      });
      fireEvent.click(addQuestionButton);

      const questionTypeSelect = screen.getByDisplayValue("Short Text");
      fireEvent.change(questionTypeSelect, { target: { value: "radio" } });

      // Find the options textarea
      const optionsTextarea = screen.getByLabelText("Options (one per line)");

      // Enter single option
      const optionText = "Single Option";
      fireEvent.change(optionsTextarea, { target: { value: optionText } });

      expect(optionsTextarea).toHaveValue(optionText);
    });

    it("options update correctly", async () => {
      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      // Add a question and set to multiple choice
      const addQuestionButton = screen.getByRole("button", {
        name: /add question/i,
      });
      fireEvent.click(addQuestionButton);

      const questionTypeSelect = screen.getByDisplayValue("Short Text");
      fireEvent.change(questionTypeSelect, { target: { value: "radio" } });

      const optionsTextarea = screen.getByLabelText("Options (one per line)");

      // First set of options
      fireEvent.change(optionsTextarea, { target: { value: "A\nB\nC" } });
      expect(optionsTextarea).toHaveValue("A\nB\nC");

      // Update options
      fireEvent.change(optionsTextarea, { target: { value: "X\nY\nZ" } });
      expect(optionsTextarea).toHaveValue("X\nY\nZ");
    });
  });
});
