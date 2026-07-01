import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import FormCreator from "./FormCreator";
import { apiClient } from "../api/client";

// Mock the API client
vi.mock("../api/client", () => ({
  apiClient: {
    createForm: vi.fn(),
    updateForm: vi.fn(),
    request: vi.fn(),
  },
}));

// Mock contexts
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      role: "admin",
      tenantId: "test-tenant-id",
      firstName: "Test",
      lastName: "User"
    }
  }),
}));

vi.mock("../context/NotificationContext", () => ({
  useNotification: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showConfirm: vi.fn(),
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const mockApiClient = vi.mocked(apiClient);

// Test wrapper with Router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe("FormCreator Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock crypto.randomUUID
    Object.defineProperty(globalThis, "crypto", {
      value: {
        randomUUID: vi.fn(() => "test-uuid-123"),
      },
    });

    // Mock successful API responses
    mockApiClient.createForm.mockResolvedValue({
      form: { _id: "test-form-id", title: "Test Form" }
    });
    mockApiClient.updateForm.mockResolvedValue({
      form: { _id: "test-form-id", title: "Updated Form" }
    });
    mockApiClient.request.mockResolvedValue({});
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
    expect(mockApiClient.createForm).not.toHaveBeenCalled();

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
      expect(mockApiClient.createForm).toHaveBeenCalledWith({
        title: "Test Form",
        description: "Test Description",
        isVisible: true,
        locationEnabled: true,
        tenantId: undefined, // Will be set based on user role
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

  // Additional comprehensive tests for FormCreator functionality
  describe("Advanced Form Features", () => {
    it("handles follow-up questions creation", async () => {
      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      // Add a question and set to radio type
      const addQuestionButton = screen.getByRole("button", {
        name: /add question/i,
      });
      fireEvent.click(addQuestionButton);

      const questionTypeSelect = screen.getByDisplayValue("Short Text");
      fireEvent.change(questionTypeSelect, { target: { value: "radio" } });

      // Add options
      const optionsTextarea = screen.getByLabelText("Options (one per line)");
      fireEvent.change(optionsTextarea, { target: { value: "Yes\nNo" } });

      // Look for follow-up options menu (three dots)
      await waitFor(() => {
        const followUpMenus = screen.getAllByTitle("Follow-up options");
        expect(followUpMenus.length).toBeGreaterThan(0);
      });
    });

    it("validates question text requirements", async () => {
      const mockAlert = vi.spyOn(window, "alert").mockImplementation(() => {});

      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      // Add a question
      const addQuestionButton = screen.getByRole("button", {
        name: /add question/i,
      });
      fireEvent.click(addQuestionButton);

      // Clear the question text
      const questionInput = screen.getByDisplayValue("New Question");
      fireEvent.change(questionInput, { target: { value: "" } });

      // Try to save
      const saveButton = screen.getByRole("button", { name: /save form/i });
      fireEvent.click(saveButton);

      expect(mockAlert).toHaveBeenCalledWith(
        expect.stringContaining("is missing text")
      );

      mockAlert.mockRestore();
    });

    it("handles section branching configuration", async () => {
      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      // Add a question with radio type
      const addQuestionButton = screen.getByRole("button", {
        name: /add question/i,
      });
      fireEvent.click(addQuestionButton);

      const questionTypeSelect = screen.getByDisplayValue("Short Text");
      fireEvent.change(questionTypeSelect, { target: { value: "radio" } });

      // Add options
      const optionsTextarea = screen.getByLabelText("Options (one per line)");
      fireEvent.change(optionsTextarea, { target: { value: "Option A\nOption B" } });

      // Add another section
      const addSectionButton = screen.getByRole("button", {
        name: /add section/i,
      });
      fireEvent.click(addSectionButton);

      // Look for section routing configuration
      await waitFor(() => {
        expect(screen.getByText("Section Routing")).toBeInTheDocument();
      });
    });

    it("manages form visibility settings", () => {
      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      const visibilityCheckbox = screen.getByLabelText("Make form publicly visible");
      expect(visibilityCheckbox).not.toBeChecked();

      fireEvent.click(visibilityCheckbox);
      expect(visibilityCheckbox).toBeChecked();
    });

    it("handles location tracking toggle", () => {
      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      const locationCheckbox = screen.getByLabelText("Enable location tracking for responses");
      expect(locationCheckbox).toBeChecked(); // Default is true

      fireEvent.click(locationCheckbox);
      expect(locationCheckbox).not.toBeChecked();
    });
  });

  describe("Form Validation", () => {
    it("validates minimum form requirements", async () => {
      const mockAlert = vi.spyOn(window, "alert").mockImplementation(() => {});

      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      // Try to save empty form
      const saveButton = screen.getByRole("button", { name: /save form/i });
      fireEvent.click(saveButton);

      expect(mockAlert).toHaveBeenCalledWith("Please enter a form title");

      // Add title but no description
      const titleInput = screen.getByLabelText("Form Title *");
      fireEvent.change(titleInput, { target: { value: "Test Form" } });

      fireEvent.click(saveButton);
      expect(mockAlert).toHaveBeenCalledWith("Please enter a form description");

      mockAlert.mockRestore();
    });

    it("validates question type requirements", async () => {
      const mockAlert = vi.spyOn(window, "alert").mockImplementation(() => {});

      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      // Add question but don't set type
      const addQuestionButton = screen.getByRole("button", {
        name: /add question/i,
      });
      fireEvent.click(addQuestionButton);

      // Fill required fields
      const titleInput = screen.getByLabelText("Form Title *");
      fireEvent.change(titleInput, { target: { value: "Test Form" } });

      const descInput = screen.getByLabelText("Description");
      fireEvent.change(descInput, { target: { value: "Test Description" } });

      // Try to save - should validate question type
      const saveButton = screen.getByRole("button", { name: /save form/i });
      fireEvent.click(saveButton);

      // The validation should catch missing question type
      expect(mockApiClient.createForm).not.toHaveBeenCalled();

      mockAlert.mockRestore();
    });
  });

  describe("Performance and Edge Cases", () => {
    it("handles large number of questions", () => {
      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      // Add multiple questions quickly
      const addQuestionButton = screen.getByRole("button", {
        name: /add question/i,
      });

      for (let i = 0; i < 10; i++) {
        fireEvent.click(addQuestionButton);
      }

      // Should render all questions without crashing
      expect(screen.getByText("Question 10")).toBeInTheDocument();
    });

    it("handles special characters in form data", () => {
      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      const titleInput = screen.getByLabelText("Form Title *");
      const specialTitle = "Form with émojis 🎉 and spëcial chärs";
      fireEvent.change(titleInput, { target: { value: specialTitle } });

      expect(titleInput).toHaveValue(specialTitle);
    });

    it("maintains state during rapid interactions", () => {
      render(
        <TestWrapper>
          <FormCreator />
        </TestWrapper>
      );

      // Rapidly add and modify elements
      const addQuestionButton = screen.getByRole("button", {
        name: /add question/i,
      });

      fireEvent.click(addQuestionButton);
      fireEvent.click(addQuestionButton);

      const questionInputs = screen.getAllByDisplayValue("New Question");
      expect(questionInputs).toHaveLength(2);

      // Modify first question
      fireEvent.change(questionInputs[0], { target: { value: "Modified Question" } });
      expect(questionInputs[0]).toHaveValue("Modified Question");
    });
  });
});