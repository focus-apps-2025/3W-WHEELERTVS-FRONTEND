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
import { FormWithFollowUpCreator } from "./FormWithFollowUpCreator";

// Mock the API service
jest.mock("../../api/formWithFollowUpService", () => ({
  formWithFollowUpService: {
    createFormWithFollowUp: jest.fn(),
    validateFormData: jest.fn(),
    getFollowUpSummary: jest.fn(),
  },
}));

describe("FormWithFollowUpCreator", () => {
  const mockOnFormCreated = jest.fn();
  const mockOnPreview = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage
    Storage.prototype.getItem = jest.fn(() => "mock-token");

    // Mock fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <FormWithFollowUpCreator
        onFormCreated={mockOnFormCreated}
        onPreview={mockOnPreview}
        {...props}
      />
    );
  };

  describe("Initial Render", () => {
    it("should render form creator with default values", () => {
      renderComponent();

      expect(
        screen.getByText("Create Form with Follow-up Questions")
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/form title/i)).toHaveValue("");
      expect(screen.getByLabelText(/form description/i)).toHaveValue("");

      // Check default options
      expect(screen.getByDisplayValue("Option A")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Option B")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Option C")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Option D")).toBeInTheDocument();
    });

    it("should render with initial data when provided", () => {
      const initialData = {
        title: "Test Form",
        description: "Test Description",
        options: ["Custom A", "Custom B"],
      };

      renderComponent({ initialData });

      expect(screen.getByDisplayValue("Test Form")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Test Description")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Custom A")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Custom B")).toBeInTheDocument();
    });
  });

  describe("Form Input Validation", () => {
    it("should show error when title is empty", async () => {
      renderComponent();

      const submitButton = screen.getByRole("button", { name: /create form/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Form title is required")).toBeInTheDocument();
      });
    });

    it("should show error when description is empty", async () => {
      renderComponent();

      const titleInput = screen.getByLabelText(/form title/i);
      fireEvent.change(titleInput, { target: { value: "Test Title" } });

      const submitButton = screen.getByRole("button", { name: /create form/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Form description is required")
        ).toBeInTheDocument();
      });
    });

    it("should show error when options are empty", async () => {
      renderComponent();

      const titleInput = screen.getByLabelText(/form title/i);
      const descInput = screen.getByLabelText(/form description/i);

      fireEvent.change(titleInput, { target: { value: "Test Title" } });
      fireEvent.change(descInput, { target: { value: "Test Description" } });

      // Clear all options
      const optionInputs = screen.getAllByDisplayValue(/Option [A-D]/);
      optionInputs.forEach((input) => {
        fireEvent.change(input, { target: { value: "" } });
      });

      const submitButton = screen.getByRole("button", { name: /create form/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("All options must have text")
        ).toBeInTheDocument();
      });
    });

    it("should show error for duplicate options", async () => {
      renderComponent();

      const titleInput = screen.getByLabelText(/form title/i);
      const descInput = screen.getByLabelText(/form description/i);

      fireEvent.change(titleInput, { target: { value: "Test Title" } });
      fireEvent.change(descInput, { target: { value: "Test Description" } });

      // Set duplicate options
      const optionInputs = screen.getAllByDisplayValue(/Option [A-D]/);
      fireEvent.change(optionInputs[0], { target: { value: "Same Option" } });
      fireEvent.change(optionInputs[1], { target: { value: "Same Option" } });

      const submitButton = screen.getByRole("button", { name: /create form/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("All options must be unique")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Options Management", () => {
    it("should add new option when add button is clicked", async () => {
      renderComponent();

      const addButton = screen.getByRole("button", { name: /add option/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Option E")).toBeInTheDocument();
      });
    });

    it("should remove option when delete button is clicked", async () => {
      renderComponent();

      // Add an option first to have more than 2
      const addButton = screen.getByRole("button", { name: /add option/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole("button", {
          name: /delete/i,
        });
        expect(deleteButtons).toHaveLength(3); // Should have 3 delete buttons now (for 5 options)
      });

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.queryByDisplayValue("Option A")).not.toBeInTheDocument();
      });
    });

    it("should prevent removing options when only 2 remain", async () => {
      renderComponent();

      // Try to remove an option (should show error since we start with 4)
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]); // Remove Option A
      fireEvent.click(deleteButtons[1]); // Remove Option B

      // Now try to remove another (should fail)
      await waitFor(() => {
        const remainingDeleteButtons = screen.getAllByRole("button", {
          name: /delete/i,
        });
        fireEvent.click(remainingDeleteButtons[0]);
      });

      await waitFor(() => {
        expect(
          screen.getByText("Form must have at least 2 options")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Follow-up Configuration", () => {
    it("should toggle follow-up questions for options", async () => {
      renderComponent();

      const followUpCheckboxes = screen.getAllByLabelText(
        /has follow-up question/i
      );

      // Option A should be checked by default (from DEFAULT_FOLLOW_UP_CONFIG)
      expect(followUpCheckboxes[0]).toBeChecked();

      // Toggle Option B
      fireEvent.click(followUpCheckboxes[1]);

      await waitFor(() => {
        expect(followUpCheckboxes[1]).toBeChecked();
        // Should show required follow-up checkbox for Option B
        expect(screen.getAllByLabelText(/required follow-up/i)).toHaveLength(2);
      });
    });

    it("should toggle required status for follow-up questions", async () => {
      renderComponent();

      // Option A has follow-up by default, make it not required
      const requiredCheckboxes =
        screen.getAllByLabelText(/required follow-up/i);
      fireEvent.click(requiredCheckboxes[0]); // Option A is required by default, toggle it off

      await waitFor(() => {
        expect(requiredCheckboxes[0]).not.toBeChecked();
      });
    });

    it("should update follow-up summary", async () => {
      renderComponent();

      // Check that summary is displayed
      expect(screen.getByText(/Follow-up questions for:/)).toBeInTheDocument();
      expect(screen.getByText(/Option A \(Required\)/)).toBeInTheDocument();
      expect(screen.getByText(/Option D \(Required\)/)).toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("should submit form successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: "Form created successfully",
          data: {
            form: { id: "test-form-id", title: "Test Form" },
          },
        }),
      });

      renderComponent();

      const titleInput = screen.getByLabelText(/form title/i);
      const descInput = screen.getByLabelText(/form description/i);

      fireEvent.change(titleInput, { target: { value: "Test Title" } });
      fireEvent.change(descInput, { target: { value: "Test Description" } });

      const submitButton = screen.getByRole("button", { name: /create form/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/forms/with-followup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
          body: JSON.stringify(
            expect.objectContaining({
              title: "Test Title",
              description: "Test Description",
            })
          ),
        });
      });

      await waitFor(() => {
        expect(
          screen.getByText(
            "Form created successfully with follow-up questions!"
          )
        ).toBeInTheDocument();
        expect(mockOnFormCreated).toHaveBeenCalled();
      });
    });

    it("should handle form submission error", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          message: "Server error",
        }),
      });

      renderComponent();

      const titleInput = screen.getByLabelText(/form title/i);
      const descInput = screen.getByLabelText(/form description/i);

      fireEvent.change(titleInput, { target: { value: "Test Title" } });
      fireEvent.change(descInput, { target: { value: "Test Description" } });

      const submitButton = screen.getByRole("button", { name: /create form/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Server error")).toBeInTheDocument();
      });
    });

    it("should show loading state during submission", async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderComponent();

      const titleInput = screen.getByLabelText(/form title/i);
      const descInput = screen.getByLabelText(/form description/i);

      fireEvent.change(titleInput, { target: { value: "Test Title" } });
      fireEvent.change(descInput, { target: { value: "Test Description" } });

      const submitButton = screen.getByRole("button", { name: /create form/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Creating...")).toBeInTheDocument();
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe("Preview Functionality", () => {
    it("should open preview modal when preview button is clicked", async () => {
      renderComponent();

      const titleInput = screen.getByLabelText(/form title/i);
      const descInput = screen.getByLabelText(/form description/i);

      fireEvent.change(titleInput, { target: { value: "Preview Test" } });
      fireEvent.change(descInput, { target: { value: "Preview Description" } });

      const previewButton = screen.getByRole("button", {
        name: /preview form/i,
      });
      fireEvent.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText("Form Preview")).toBeInTheDocument();
        expect(screen.getByText("Preview Test")).toBeInTheDocument();
        expect(screen.getByText("Preview Description")).toBeInTheDocument();
        expect(mockOnPreview).toHaveBeenCalled();
      });
    });

    it("should show follow-up questions in preview when option is selected", async () => {
      renderComponent();

      const titleInput = screen.getByLabelText(/form title/i);
      const descInput = screen.getByLabelText(/form description/i);

      fireEvent.change(titleInput, { target: { value: "Preview Test" } });
      fireEvent.change(descInput, { target: { value: "Preview Description" } });

      const previewButton = screen.getByRole("button", {
        name: /preview form/i,
      });
      fireEvent.click(previewButton);

      await waitFor(() => {
        // Select Option A (which has follow-up)
        const optionARadio = screen.getByLabelText("Option A");
        fireEvent.click(optionARadio);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Please provide additional details for Option A/)
        ).toBeInTheDocument();
        expect(screen.getByText(/Required Follow-up/)).toBeInTheDocument();
      });
    });

    it("should close preview modal when close button is clicked", async () => {
      renderComponent();

      const titleInput = screen.getByLabelText(/form title/i);
      const descInput = screen.getByLabelText(/form description/i);

      fireEvent.change(titleInput, { target: { value: "Preview Test" } });
      fireEvent.change(descInput, { target: { value: "Preview Description" } });

      const previewButton = screen.getByRole("button", {
        name: /preview form/i,
      });
      fireEvent.click(previewButton);

      await waitFor(() => {
        const closeButton = screen.getByText("Close Preview");
        fireEvent.click(closeButton);
      });

      await waitFor(() => {
        expect(screen.queryByText("Form Preview")).not.toBeInTheDocument();
      });
    });
  });

  describe("URL Validation", () => {
    it("should accept valid URLs for logo and image", async () => {
      renderComponent();

      const logoInput = screen.getByLabelText(/logo url/i);
      const imageInput = screen.getByLabelText(/image url/i);

      fireEvent.change(logoInput, {
        target: { value: "https://example.com/logo.png" },
      });
      fireEvent.change(imageInput, {
        target: { value: "https://example.com/image.jpg" },
      });

      const titleInput = screen.getByLabelText(/form title/i);
      const descInput = screen.getByLabelText(/form description/i);

      fireEvent.change(titleInput, { target: { value: "Test Title" } });
      fireEvent.change(descInput, { target: { value: "Test Description" } });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { form: { id: "test" } },
        }),
      });

      const submitButton = screen.getByRole("button", { name: /create form/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
        expect(
          screen.queryByText(/must be a valid URL/)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      renderComponent();

      expect(screen.getByLabelText(/form title/i)).toHaveAttribute("required");
      expect(screen.getByLabelText(/form description/i)).toHaveAttribute(
        "required"
      );

      const followUpCheckboxes = screen.getAllByLabelText(
        /has follow-up question/i
      );
      expect(followUpCheckboxes[0]).toBeInTheDocument();
    });

    it("should be keyboard navigable", async () => {
      const user = userEvent.setup();
      renderComponent();

      const titleInput = screen.getByLabelText(/form title/i);
      await user.click(titleInput);
      await user.type(titleInput, "Test Title");

      expect(titleInput).toHaveValue("Test Title");

      // Tab to next field
      await user.tab();
      const logoInput = screen.getByLabelText(/logo url/i);
      expect(logoInput).toHaveFocus();
    });

    it("should announce errors to screen readers", async () => {
      renderComponent();

      const submitButton = screen.getByRole("button", { name: /create form/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByText("Form title is required");
        expect(errorMessage).toBeInTheDocument();
        // Error should be associated with an icon for screen readers
        expect(errorMessage.parentElement).toContainElement(
          screen.getByRole("img", { hidden: true }) // Lucide icons have hidden role
        );
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long form data", async () => {
      renderComponent();

      const longTitle = "A".repeat(1000);
      const longDescription = "B".repeat(5000);

      const titleInput = screen.getByLabelText(/form title/i);
      const descInput = screen.getByLabelText(/form description/i);

      fireEvent.change(titleInput, { target: { value: longTitle } });
      fireEvent.change(descInput, { target: { value: longDescription } });

      expect(titleInput).toHaveValue(longTitle);
      expect(descInput).toHaveValue(longDescription);
    });

    it("should handle special characters in option names", async () => {
      renderComponent();

      const optionInputs = screen.getAllByDisplayValue(/Option [A-D]/);
      fireEvent.change(optionInputs[0], {
        target: { value: 'Option & "Special" <Characters>' },
      });

      expect(optionInputs[0]).toHaveValue('Option & "Special" <Characters>');
    });

    it("should reset form after successful submission", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { form: { id: "test" } },
        }),
      });

      renderComponent();

      const titleInput = screen.getByLabelText(/form title/i);
      const descInput = screen.getByLabelText(/form description/i);

      fireEvent.change(titleInput, { target: { value: "Test Title" } });
      fireEvent.change(descInput, { target: { value: "Test Description" } });

      const submitButton = screen.getByRole("button", { name: /create form/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Form created successfully with follow-up questions!"
          )
        ).toBeInTheDocument();
      });

      // Wait for form reset
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2100)); // Wait for timeout
      });

      await waitFor(() => {
        expect(titleInput).toHaveValue("");
        expect(descInput).toHaveValue("");
      });
    });
  });
});
