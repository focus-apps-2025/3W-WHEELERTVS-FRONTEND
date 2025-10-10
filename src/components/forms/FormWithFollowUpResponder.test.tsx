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
import { FormWithFollowUpResponder } from "./FormWithFollowUpResponder";

// Mock form data
const mockForm = {
  id: "test-form-123",
  title: "Test Survey Form",
  description: "A test form with follow-up questions",
  logoUrl: "https://example.com/logo.png",
  imageUrl: "https://example.com/image.jpg",
  sections: [
    {
      id: "section-1",
      title: "Main Section",
      description: "Please select one option",
      questions: [
        {
          id: "main-question",
          text: "Which option do you choose?",
          type: "radio",
          required: true,
          options: ["Option A", "Option B", "Option C", "Option D"],
          description: "Select the option that best describes your situation",
        },
      ],
    },
  ],
  followUpQuestions: [
    {
      id: "followup-option-a",
      text: "Please provide additional details for Option A:",
      type: "paragraph",
      required: true,
      showWhen: {
        questionId: "main-question",
        value: "Option A",
      },
      parentId: "main-question",
      description: "This follow-up question is mandatory for Option A",
    },
    {
      id: "followup-option-d",
      text: "Please provide additional details for Option D:",
      type: "paragraph",
      required: false,
      showWhen: {
        questionId: "main-question",
        value: "Option D",
      },
      parentId: "main-question",
      description: "This follow-up question is optional for Option D",
    },
  ],
};

describe("FormWithFollowUpResponder", () => {
  const mockOnSubmitted = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock localStorage
    Storage.prototype.getItem = jest.fn(() => "mock-token");

    // Mock successful form fetch
    global.fetch = jest.fn().mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { form: mockForm },
          }),
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <FormWithFollowUpResponder
        formId="test-form-123"
        onSubmitted={mockOnSubmitted}
        onError={mockOnError}
        {...props}
      />
    );
  };

  describe("Form Loading", () => {
    it("should show loading state initially", async () => {
      renderComponent();

      expect(screen.getByText("Loading form...")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText("Loading form...")).not.toBeInTheDocument();
      });
    });

    it("should load and display form successfully", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Test Survey Form")).toBeInTheDocument();
        expect(
          screen.getByText("A test form with follow-up questions")
        ).toBeInTheDocument();
        expect(
          screen.getByText("Which option do you choose?")
        ).toBeInTheDocument();
      });

      // Check that all options are present
      expect(screen.getByLabelText("Option A")).toBeInTheDocument();
      expect(screen.getByLabelText("Option B")).toBeInTheDocument();
      expect(screen.getByLabelText("Option C")).toBeInTheDocument();
      expect(screen.getByLabelText("Option D")).toBeInTheDocument();
    });

    it("should handle form loading error", async () => {
      global.fetch = jest.fn().mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: "Form not found" }),
        })
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Form not found")).toBeInTheDocument();
        expect(mockOnError).toHaveBeenCalledWith("Form not found");
      });
    });

    it("should show form not found when form is null", async () => {
      global.fetch = jest.fn().mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { form: null },
            }),
        })
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Form not found")).toBeInTheDocument();
        expect(
          screen.getByText("The requested form could not be loaded.")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Form Rendering", () => {
    it("should display form header with logo and image", async () => {
      renderComponent();

      await waitFor(() => {
        const logo = screen.getByAltText("Logo");
        expect(logo).toHaveAttribute("src", "https://example.com/logo.png");

        const image = screen.getByAltText("Form");
        expect(image).toHaveAttribute("src", "https://example.com/image.jpg");
      });
    });

    it("should show step-by-step navigation for multiple questions", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Step 1 of 1")).toBeInTheDocument();
        expect(screen.getByText("100% Complete")).toBeInTheDocument();
      });
    });

    it("should handle form without logo and image", async () => {
      const formWithoutImages = {
        ...mockForm,
        logoUrl: undefined,
        imageUrl: undefined,
      };

      global.fetch = jest.fn().mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { form: formWithoutImages },
            }),
        })
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByAltText("Logo")).not.toBeInTheDocument();
        expect(screen.queryByAltText("Form")).not.toBeInTheDocument();
        expect(screen.getByText("Test Survey Form")).toBeInTheDocument();
      });
    });
  });

  describe("Question Interaction", () => {
    it("should allow selecting radio options", async () => {
      renderComponent();

      await waitFor(() => {
        const optionA = screen.getByLabelText("Option A");
        fireEvent.click(optionA);
        expect(optionA).toBeChecked();
      });
    });

    it("should show follow-up question when Option A is selected", async () => {
      renderComponent();

      await waitFor(() => {
        const optionA = screen.getByLabelText("Option A");
        fireEvent.click(optionA);
      });

      // Should now show the follow-up question in next step
      await waitFor(() => {
        const nextButton = screen.getByRole("button", { name: /next/i });
        fireEvent.click(nextButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText("Please provide additional details for Option A:")
        ).toBeInTheDocument();
        expect(screen.getByText(/Follow-up Question/)).toBeInTheDocument();
        expect(
          screen.getByText(
            /This question appears because you selected "Option A"/
          )
        ).toBeInTheDocument();
      });
    });

    it("should not show follow-up question when Option B is selected", async () => {
      renderComponent();

      await waitFor(() => {
        const optionB = screen.getByLabelText("Option B");
        fireEvent.click(optionB);
      });

      // Should go directly to submit since Option B has no follow-up
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /submit form/i })
        ).toBeInTheDocument();
      });
    });

    it("should show optional follow-up question for Option D", async () => {
      renderComponent();

      await waitFor(() => {
        const optionD = screen.getByLabelText("Option D");
        fireEvent.click(optionD);
      });

      // Navigate to follow-up question
      await waitFor(() => {
        const nextButton = screen.getByRole("button", { name: /next/i });
        fireEvent.click(nextButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText("Please provide additional details for Option D:")
        ).toBeInTheDocument();
        // Should not show required asterisk for optional question
        expect(screen.queryByText("*")).not.toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    it("should navigate between steps correctly", async () => {
      renderComponent();

      await waitFor(() => {
        const optionA = screen.getByLabelText("Option A");
        fireEvent.click(optionA);
      });

      // Go to next step
      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /previous/i })
        ).toBeInTheDocument();
      });

      // Go back to previous step
      const prevButton = screen.getByRole("button", { name: /previous/i });
      fireEvent.click(prevButton);

      await waitFor(() => {
        expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
        expect(
          screen.getByText("Which option do you choose?")
        ).toBeInTheDocument();
      });
    });

    it("should not show previous button on first step", async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /previous/i })
        ).not.toBeInTheDocument();
      });
    });

    it("should show submit button on last step", async () => {
      renderComponent();

      await waitFor(() => {
        const optionB = screen.getByLabelText("Option B"); // No follow-up
        fireEvent.click(optionB);
      });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /submit form/i })
        ).toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: /next/i })
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Validation", () => {
    it("should validate required main question", async () => {
      renderComponent();

      await waitFor(() => {
        const nextButton = screen.getByRole("button", { name: /next/i });
        fireEvent.click(nextButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Which option do you choose\? is required/)
        ).toBeInTheDocument();
      });
    });

    it("should validate required follow-up question", async () => {
      renderComponent();

      await waitFor(() => {
        const optionA = screen.getByLabelText("Option A");
        fireEvent.click(optionA);
      });

      // Go to follow-up question
      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        const submitButton = screen.getByRole("button", {
          name: /submit form/i,
        });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText(
            /Please provide additional details for Option A: is required/
          )
        ).toBeInTheDocument();
      });
    });

    it("should not validate optional follow-up question if empty", async () => {
      renderComponent();

      await waitFor(() => {
        const optionD = screen.getByLabelText("Option D");
        fireEvent.click(optionD);
      });

      // Go to follow-up question
      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);

      // Submit without filling optional follow-up
      await waitFor(() => {
        const submitButton = screen.getByRole("button", {
          name: /submit form/i,
        });
        fireEvent.click(submitButton);
      });

      // Should not show validation error for optional field
      expect(screen.queryByText(/is required/)).not.toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    beforeEach(() => {
      // Mock successful submission
      global.fetch = jest
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: { form: mockForm },
              }),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: { response: { id: "response-123" } },
              }),
          })
        );
    });

    it("should submit form successfully without follow-up", async () => {
      renderComponent();

      await waitFor(() => {
        const optionB = screen.getByLabelText("Option B");
        fireEvent.click(optionB);
      });

      const submitButton = screen.getByRole("button", { name: /submit form/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
          body: JSON.stringify({
            questionId: "test-form-123",
            answers: { "main-question": "Option B" },
            timestamp: expect.any(String),
          }),
        });
      });

      await waitFor(() => {
        expect(
          screen.getByText("Form submitted successfully!")
        ).toBeInTheDocument();
        expect(mockOnSubmitted).toHaveBeenCalled();
      });
    });

    it("should submit form successfully with required follow-up", async () => {
      renderComponent();

      await waitFor(() => {
        const optionA = screen.getByLabelText("Option A");
        fireEvent.click(optionA);
      });

      // Go to follow-up question
      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        const followUpTextarea = screen.getByPlaceholderText(
          "Enter your detailed response"
        );
        fireEvent.change(followUpTextarea, {
          target: { value: "My follow-up response" },
        });
      });

      const submitButton = screen.getByRole("button", { name: /submit form/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenLastCalledWith("/api/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
          body: JSON.stringify({
            questionId: "test-form-123",
            answers: {
              "main-question": "Option A",
              "followup-option-a": "My follow-up response",
            },
            timestamp: expect.any(String),
          }),
        });
      });
    });

    it("should handle submission error", async () => {
      // Mock error response for submission
      global.fetch = jest
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: { form: mockForm },
              }),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            json: () =>
              Promise.resolve({
                success: false,
                message: "Submission failed",
              }),
          })
        );

      renderComponent();

      await waitFor(() => {
        const optionB = screen.getByLabelText("Option B");
        fireEvent.click(optionB);
      });

      const submitButton = screen.getByRole("button", { name: /submit form/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Submission failed")).toBeInTheDocument();
        expect(mockOnError).toHaveBeenCalledWith("Submission failed");
      });
    });

    it("should show loading state during submission", async () => {
      // Mock slow submission
      global.fetch = jest
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: { form: mockForm },
              }),
          })
        )
        .mockImplementationOnce(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );

      renderComponent();

      await waitFor(() => {
        const optionB = screen.getByLabelText("Option B");
        fireEvent.click(optionB);
      });

      const submitButton = screen.getByRole("button", { name: /submit form/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Submitting...")).toBeInTheDocument();
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe("Review Summary", () => {
    it("should show review summary on last step with multiple questions", async () => {
      renderComponent();

      await waitFor(() => {
        const optionA = screen.getByLabelText("Option A");
        fireEvent.click(optionA);
      });

      // Go to follow-up question
      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        const followUpTextarea = screen.getByPlaceholderText(
          "Enter your detailed response"
        );
        fireEvent.change(followUpTextarea, {
          target: { value: "My follow-up response" },
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Review Your Responses")).toBeInTheDocument();
        expect(
          screen.getByText("Which option do you choose?")
        ).toBeInTheDocument();
        expect(screen.getByText("Option A")).toBeInTheDocument();
        expect(screen.getByText("My follow-up response")).toBeInTheDocument();
      });
    });

    it("should not show review summary for single question forms", async () => {
      // Mock form with only one question
      const singleQuestionForm = {
        ...mockForm,
        followUpQuestions: [],
      };

      global.fetch = jest.fn().mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { form: singleQuestionForm },
            }),
        })
      );

      renderComponent();

      await waitFor(() => {
        const optionB = screen.getByLabelText("Option B");
        fireEvent.click(optionB);
      });

      expect(
        screen.queryByText("Review Your Responses")
      ).not.toBeInTheDocument();
    });
  });

  describe("Question Types", () => {
    it("should handle text input questions", async () => {
      const formWithTextInput = {
        ...mockForm,
        sections: [
          {
            ...mockForm.sections[0],
            questions: [
              {
                id: "text-question",
                text: "What is your name?",
                type: "text",
                required: true,
              },
            ],
          },
        ],
        followUpQuestions: [],
      };

      global.fetch = jest.fn().mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { form: formWithTextInput },
            }),
        })
      );

      renderComponent();

      await waitFor(() => {
        const textInput = screen.getByPlaceholderText("Enter your answer");
        fireEvent.change(textInput, { target: { value: "John Doe" } });
        expect(textInput).toHaveValue("John Doe");
      });
    });

    it("should handle email input questions", async () => {
      const formWithEmailInput = {
        ...mockForm,
        sections: [
          {
            ...mockForm.sections[0],
            questions: [
              {
                id: "email-question",
                text: "What is your email?",
                type: "email",
                required: true,
              },
            ],
          },
        ],
        followUpQuestions: [],
      };

      global.fetch = jest.fn().mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { form: formWithEmailInput },
            }),
        })
      );

      renderComponent();

      await waitFor(() => {
        const emailInput = screen.getByPlaceholderText(
          "Enter your email address"
        );
        fireEvent.change(emailInput, { target: { value: "john@example.com" } });
        expect(emailInput).toHaveValue("john@example.com");
      });
    });

    it("should handle checkbox questions", async () => {
      const formWithCheckbox = {
        ...mockForm,
        sections: [
          {
            ...mockForm.sections[0],
            questions: [
              {
                id: "checkbox-question",
                text: "Select all that apply:",
                type: "checkbox",
                required: false,
                options: ["Option 1", "Option 2", "Option 3"],
              },
            ],
          },
        ],
        followUpQuestions: [],
      };

      global.fetch = jest.fn().mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { form: formWithCheckbox },
            }),
        })
      );

      renderComponent();

      await waitFor(() => {
        const checkbox1 = screen.getByLabelText("Option 1");
        const checkbox2 = screen.getByLabelText("Option 2");

        fireEvent.click(checkbox1);
        fireEvent.click(checkbox2);

        expect(checkbox1).toBeChecked();
        expect(checkbox2).toBeChecked();
      });
    });

    it("should handle date input questions", async () => {
      const formWithDateInput = {
        ...mockForm,
        sections: [
          {
            ...mockForm.sections[0],
            questions: [
              {
                id: "date-question",
                text: "Select a date:",
                type: "date",
                required: true,
              },
            ],
          },
        ],
        followUpQuestions: [],
      };

      global.fetch = jest.fn().mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { form: formWithDateInput },
            }),
        })
      );

      renderComponent();

      await waitFor(() => {
        const dateInput = screen.getByDisplayValue("");
        fireEvent.change(dateInput, { target: { value: "2024-01-15" } });
        expect(dateInput).toHaveValue("2024-01-15");
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels and roles", async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /Test Survey Form/i })
        ).toBeInTheDocument();
        expect(screen.getByRole("group")).toBeInTheDocument(); // Radio group

        const requiredQuestion = screen.getByText(
          /Which option do you choose?/
        );
        expect(requiredQuestion.textContent).toMatch(/\*/); // Required indicator
      });
    });

    it("should be keyboard navigable", async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        const optionA = screen.getByLabelText("Option A");
        user.click(optionA);
        expect(optionA).toBeChecked();
      });

      // Tab navigation
      await user.tab();
      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).toHaveFocus();
    });

    it("should announce progress to screen readers", async () => {
      renderComponent();

      await waitFor(() => {
        const progressText = screen.getByText("Step 1 of 1");
        expect(progressText).toBeInTheDocument();

        const progressBar = screen.getByRole("progressbar", { hidden: true });
        expect(progressBar).toHaveAttribute(
          "style",
          expect.stringContaining("width: 100%")
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("should clear validation errors when user provides input", async () => {
      renderComponent();

      // Try to proceed without selecting anything
      await waitFor(() => {
        const nextButton = screen.getByRole("button", { name: /next/i });
        fireEvent.click(nextButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/is required/)).toBeInTheDocument();
      });

      // Select an option
      const optionA = screen.getByLabelText("Option A");
      fireEvent.click(optionA);

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText(/is required/)).not.toBeInTheDocument();
      });
    });

    it("should handle network errors gracefully", async () => {
      global.fetch = jest
        .fn()
        .mockImplementationOnce(() =>
          Promise.reject(new Error("Network error"))
        );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
        expect(mockOnError).toHaveBeenCalledWith("Network error");
      });
    });
  });
});
