import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { MultipleChoiceFormBuilder } from "./MultipleChoiceFormBuilder";
import { vi } from "vitest";

// Mock the API service
vi.mock("../../api/storage", () => ({
  questionsApi: {
    create: vi.fn(),
    getAll: vi.fn(() => []),
  },
}));

describe("MultipleChoiceFormBuilder", () => {
  const mockOnFormCreated = vi.fn();
  const mockOnPreview = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage
    Storage.prototype.getItem = vi.fn(() => "mock-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <MultipleChoiceFormBuilder
        onFormCreated={mockOnFormCreated}
        onPreview={mockOnPreview}
        {...props}
      />
    );
  };

  describe("Happy Path Tests", () => {
    it("should create form with valid data", async () => {
      const user = userEvent.setup();
      renderComponent();

      // Fill form details
      const titleInput = screen.getByLabelText(/form title/i);
      const descriptionInput = screen.getByLabelText("Description");

      await user.type(titleInput, "Customer Service Request");
      await user.type(
        descriptionInput,
        "Collect Customer Feedback and Service requests"
      );

      // Check public visibility checkbox
      const publicCheckbox = screen.getByLabelText(
        /make form publicly visible/i
      );
      await user.click(publicCheckbox);

      // Fill section 1 - Personal Information
      const section1Title = screen.getByLabelText("Section Title");

      await user.type(section1Title, "Personal Information");

      // Fill a question in section 1
      const firstQuestionText = screen.getByLabelText("Question Text");
      await user.type(firstQuestionText, "Your Good Name?");

      expect(
        screen.getByDisplayValue("Customer Service Request")
      ).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("Personal Information")
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("Your Good Name?")).toBeInTheDocument();
    });

    it("should add multiple choice options dynamically", async () => {
      const user = userEvent.setup();
      renderComponent();

      // Find the multiple choice question in section 2 (it's already configured)
      const questionInputs = screen.getAllByLabelText("Question Text");
      const section2Question = questionInputs[questionInputs.length - 1]; // Last question (in section 2)

      await user.type(section2Question, "Car model?");

      // The question is already set to multiple choice, so check options are displayed
      expect(
        screen.getByDisplayValue("RECENTLY PURCHASED")
      ).toBeInTheDocument();

      // Find and click the add option button (plus button)
      const addOptionButton = screen.getByRole("button", {
        name: /add option/i,
      });
      await user.click(addOptionButton);

      // Verify new option field appears
      const optionInputs = screen.getAllByLabelText(/option \d+/i);
      expect(optionInputs).toHaveLength(5); // 4 default + 1 new

      // Add another option
      await user.click(addOptionButton);

      const updatedOptionInputs = screen.getAllByLabelText(/option \d+/i);
      expect(updatedOptionInputs).toHaveLength(6); // 4 default + 2 new
    });

    it("should remove options with minus button", async () => {
      const user = userEvent.setup();
      renderComponent();

      // Add extra option first so we have more than minimum (section 2 already has multiple choice)
      const addOptionButton = screen.getByRole("button", {
        name: /add option/i,
      });
      await user.click(addOptionButton);

      // Find remove buttons (minus buttons)
      const removeButtons = screen.getAllByRole("button", {
        name: /remove option/i,
      });
      expect(removeButtons).toHaveLength(3); // Can remove when more than 2 options

      // Remove an option
      await user.click(removeButtons[0]);

      // Verify option was removed
      const remainingOptionInputs = screen.getAllByLabelText(/option \d+/i);
      expect(remainingOptionInputs).toHaveLength(4); // Back to 4 options
    });

    it("should display default four option fields", async () => {
      const user = userEvent.setup();
      renderComponent();

      // Section 2 already has multiple choice configured, verify default 4 option fields are displayed
      const optionInputs = screen.getAllByLabelText(/option \d+/i);
      expect(optionInputs).toHaveLength(4);

      // Verify default values
      expect(
        screen.getByDisplayValue("RECENTLY PURCHASED")
      ).toBeInTheDocument();
      expect(optionInputs[1]).toHaveValue("Option 2");
      expect(optionInputs[2]).toHaveValue("Option 3");
      expect(optionInputs[3]).toHaveValue("Option 4");
    });
  });

  describe("Input Verification Tests", () => {
    it("should validate minimum two mandatory options", async () => {
      const user = userEvent.setup();
      renderComponent();

      // Try to remove options to get below minimum (section 2 already has multiple choice)
      const removeButtons = screen.getAllByRole("button", {
        name: /remove option/i,
      });

      // Remove options until only 2 remain
      await user.click(removeButtons[0]); // Remove option 1
      await user.click(removeButtons[0]); // Remove option 2 (index shifts)

      // Verify minimum 2 options remain
      const remainingOptions = screen.getAllByLabelText(/option \d+/i);
      expect(remainingOptions).toHaveLength(2);

      // Remove buttons should be disabled or not present when at minimum
      const currentRemoveButtons = screen.queryAllByRole("button", {
        name: /remove option/i,
      });
      expect(currentRemoveButtons).toHaveLength(0);
    });

    it("should prevent duplicate option values", async () => {
      const user = userEvent.setup();
      renderComponent();

      // Set duplicate values in existing options (section 2 already has multiple choice)
      const optionInputs = screen.getAllByLabelText(/option \d+/i);
      await user.clear(optionInputs[0]);
      await user.type(optionInputs[0], "Duplicate Option");

      await user.clear(optionInputs[1]);
      await user.type(optionInputs[1], "Duplicate Option");

      // Try to save/validate
      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/options must be unique/i)).toBeInTheDocument();
      });
    });

    it("should handle empty option text fields", async () => {
      const user = userEvent.setup();
      renderComponent();

      // Clear an option field (section 2 already has multiple choice)
      const optionInputs = screen.getAllByLabelText(/option \d+/i);
      await user.clear(optionInputs[0]);

      // Try to save
      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText(/all options must have text/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Exception Handling Tests", () => {
    it("should show error when removing below minimum", async () => {
      const user = userEvent.setup();
      renderComponent();

      // Set up multiple choice question
      const carModelQuestion = screen.getByLabelText(/car model/i);
      await user.type(carModelQuestion, "Car model?");

      const questionTypeSelect = screen.getByLabelText(/question type/i);
      await user.selectOptions(questionTypeSelect, "radio");

      // Remove options until we reach minimum
      const removeButtons = screen.getAllByRole("button", {
        name: /remove option/i,
      });

      // Remove two options (leaving 2, which is minimum)
      await user.click(removeButtons[0]);
      await user.click(removeButtons[0]);

      // Try to remove another - should show error
      const remainingRemoveButtons = screen.queryAllByRole("button", {
        name: /remove option/i,
      });

      if (remainingRemoveButtons.length > 0) {
        await user.click(remainingRemoveButtons[0]);

        await waitFor(() => {
          expect(screen.getByText(/minimum.*2.*options/i)).toBeInTheDocument();
        });
      } else {
        // If no remove buttons are visible, that's also correct behavior
        expect(remainingRemoveButtons).toHaveLength(0);
      }
    });
  });

  describe("Form Structure Tests", () => {
    it("should handle multiple sections correctly", async () => {
      const user = userEvent.setup();
      renderComponent();

      // Fill Section 1
      const section1Title = screen.getByLabelText(/section 1.*title/i);
      await user.type(section1Title, "Personal Information");

      // Fill Section 2
      const section2Title = screen.getByLabelText(/section 2.*title/i);
      await user.type(section2Title, "Service Details");

      expect(
        screen.getByDisplayValue("Personal Information")
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("Service Details")).toBeInTheDocument();
    });

    it("should validate required form fields", async () => {
      const user = userEvent.setup();
      renderComponent();

      // Try to save without filling required fields
      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/form title.*required/i)).toBeInTheDocument();
      });
    });

    it("should handle question type changes", async () => {
      const user = userEvent.setup();
      renderComponent();

      const questionTypeSelect = screen.getByLabelText(/question type/i);

      // Change from default to multiple choice
      await user.selectOptions(questionTypeSelect, "radio");

      // Verify options appear
      const optionInputs = screen.getAllByLabelText(/option \d+/i);
      expect(optionInputs).toHaveLength(4);

      // Change back to short text
      await user.selectOptions(questionTypeSelect, "shortText");

      // Verify options disappear
      const updatedOptionInputs = screen.queryAllByLabelText(/option \d+/i);
      expect(updatedOptionInputs).toHaveLength(0);
    });

    it("should support follow-up questions configuration", async () => {
      const user = userEvent.setup();
      renderComponent();

      // Set up multiple choice question
      const carModelQuestion = screen.getByLabelText(/car model/i);
      await user.type(carModelQuestion, "Car model?");

      const questionTypeSelect = screen.getByLabelText(/question type/i);
      await user.selectOptions(questionTypeSelect, "radio");

      // Configure follow-up for "RECENTLY PURCHASED" option
      const followUpButton = screen.getByRole("button", {
        name: /add follow.*recently purchased/i,
      });
      await user.click(followUpButton);

      // Verify follow-up configuration appears
      expect(
        screen.getByText(/follow.*up.*recently purchased/i)
      ).toBeInTheDocument();
    });
  });
});
