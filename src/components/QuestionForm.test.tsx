import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import QuestionForm from "./QuestionForm";
import { questionsApi } from "../api/storage";
import { sectionsApi } from "../api/sections";

// Mock the APIs
vi.mock("../api/storage", () => ({
  questionsApi: {
    getById: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock("../api/sections", () => ({
  sectionsApi: {
    getByFormId: vi.fn(),
    save: vi.fn(),
  },
}));

// Mock the child components
vi.mock("./PreviewButton", () => ({
  default: ({ questionId }: { questionId: string }) => (
    <button data-testid="preview-button">Preview {questionId}</button>
  ),
}));

vi.mock("./ImageUpload", () => ({
  default: ({ imageUrl, onUpload, type }: any) => (
    <div data-testid="image-upload">
      <span>Image Upload - Type: {type}</span>
      {imageUrl && (
        <img src={imageUrl} alt="uploaded" data-testid="uploaded-image" />
      )}
      <input
        type="file"
        data-testid="file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onUpload) {
            onUpload(file);
          }
        }}
      />
    </div>
  ),
}));

vi.mock("./QuestionDescription", () => ({
  default: ({
    title,
    description,
    onTitleChange,
    onDescriptionChange,
  }: any) => (
    <div data-testid="question-description">
      <input
        data-testid="form-title-input"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Form Title"
      />
      <textarea
        data-testid="form-description-input"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Description"
      />
    </div>
  ),
}));

vi.mock("./sections/SectionsList", () => ({
  default: ({ sections, onSectionsChange }: any) => (
    <div data-testid="sections-list">
      <span>Sections Count: {sections.length}</span>
      <button
        data-testid="add-section-button"
        onClick={() => {
          const newSection = {
            id: "new-section",
            title: "New Section",
            questions: [],
          };
          onSectionsChange([...sections, newSection]);
        }}
      >
        Add Section
      </button>
    </div>
  ),
}));

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
const mockUseParams = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("QuestionForm", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({});
    Object.defineProperty(window, "location", {
      value: { search: "" },
      writable: true,
    });

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("renders form creation view", () => {
    renderWithRouter(<QuestionForm onSubmit={mockOnSubmit} />);

    expect(screen.getByText("Create New Form")).toBeInTheDocument();
    expect(
      screen.getByText("Design your form with custom sections and questions")
    ).toBeInTheDocument();
    expect(screen.getByTestId("image-upload")).toBeInTheDocument();
    expect(screen.getByTestId("question-description")).toBeInTheDocument();
    expect(screen.getByTestId("sections-list")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save form/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("updates form title correctly", async () => {
    const user = userEvent.setup();
    renderWithRouter(<QuestionForm onSubmit={mockOnSubmit} />);

    const titleInput = screen.getByTestId("form-title-input");
    await user.clear(titleInput);
    await user.type(titleInput, "Customer Feedback Form");

    expect(titleInput).toHaveValue("Customer Feedback Form");
  });

  it("updates form description correctly", async () => {
    const user = userEvent.setup();
    renderWithRouter(<QuestionForm onSubmit={mockOnSubmit} />);

    const descriptionInput = screen.getByTestId("form-description-input");
    await user.clear(descriptionInput);
    await user.type(
      descriptionInput,
      "Please provide your feedback about our services"
    );

    expect(descriptionInput).toHaveValue(
      "Please provide your feedback about our services"
    );
  });

  it("handles image upload successfully", async () => {
    const user = userEvent.setup();
    renderWithRouter(<QuestionForm onSubmit={mockOnSubmit} />);

    const fileInput = screen.getByTestId("file-input");
    const file = new File(["dummy content"], "test-image.jpg", {
      type: "image/jpeg",
    });

    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByTestId("uploaded-image")).toBeInTheDocument();
      expect(screen.getByTestId("uploaded-image")).toHaveAttribute(
        "src",
        "data:image/jpeg;base64,mock-image-data"
      );
    });
  });

  it("saves new form correctly", async () => {
    const user = userEvent.setup();
    vi.mocked(sectionsApi.save).mockImplementation(vi.fn());
    vi.mocked(questionsApi.save).mockImplementation(vi.fn());

    renderWithRouter(<QuestionForm onSubmit={mockOnSubmit} />);

    // Fill in form details
    const titleInput = screen.getByTestId("form-title-input");
    await user.type(titleInput, "Test Form");

    const descriptionInput = screen.getByTestId("form-description-input");
    await user.type(descriptionInput, "Test Description");

    // Add a section
    const addSectionButton = screen.getByTestId("add-section-button");
    await user.click(addSectionButton);

    // Save the form
    const saveButton = screen.getByRole("button", { name: /save form/i });
    await user.click(saveButton);

    expect(questionsApi.save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Form",
        description: "Test Description",
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: "new-section",
            title: "New Section",
          }),
        ]),
      })
    );
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/forms/management");
  });

  it("loads existing form data", () => {
    const existingForm = {
      id: "existing-form-id",
      title: "Existing Form",
      description: "Existing Description",
      imageUrl: "existing-image.jpg",
      sections: [{ id: "section-1", title: "Section 1", questions: [] }],
      followUpQuestions: [],
    };

    mockUseParams.mockReturnValue({ id: "existing-form-id" });
    vi.mocked(questionsApi.getById).mockReturnValue(existingForm);
    vi.mocked(sectionsApi.getByFormId).mockReturnValue([
      { id: "section-1", title: "Updated Section 1", questions: [] },
    ]);

    renderWithRouter(<QuestionForm onSubmit={mockOnSubmit} />);

    expect(screen.getByText("Edit Form")).toBeInTheDocument();
    expect(
      screen.getByText("Modify your form structure and content")
    ).toBeInTheDocument();
    expect(screen.getByTestId("preview-button")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Existing Form")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Existing Description")
    ).toBeInTheDocument();
  });

  it("handles missing form ID", () => {
    mockUseParams.mockReturnValue({ id: "non-existent-id" });
    vi.mocked(questionsApi.getById).mockReturnValue(undefined);
    vi.mocked(sectionsApi.getByFormId).mockReturnValue([]);

    renderWithRouter(<QuestionForm onSubmit={mockOnSubmit} />);

    // Should render edit form but with empty data
    expect(screen.getByText("Edit Form")).toBeInTheDocument();
    expect(screen.getByTestId("form-title-input")).toHaveValue("");
    expect(screen.getByTestId("form-description-input")).toHaveValue("");
  });

  it("validates form saving process", async () => {
    const user = userEvent.setup();

    // Mock console.error to avoid error logs in tests
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock localStorage error
    const mockError = new Error("Storage quota exceeded");
    vi.mocked(questionsApi.save).mockImplementation(() => {
      throw mockError;
    });

    renderWithRouter(<QuestionForm onSubmit={mockOnSubmit} />);

    const saveButton = screen.getByRole("button", { name: /save form/i });

    // This should not crash the component
    await user.click(saveButton);

    expect(questionsApi.save).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("handles back navigation correctly", async () => {
    const user = userEvent.setup();
    renderWithRouter(<QuestionForm onSubmit={mockOnSubmit} />);

    const backButton = screen.getByRole("button", { name: /back/i });
    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("handles parent form relationship", async () => {
    const user = userEvent.setup();
    const parentForm = {
      id: "parent-form-id",
      title: "Parent Form",
      description: "Parent Description",
      sections: [],
      followUpQuestions: [],
    };

    // Mock URL params for parent form
    Object.defineProperty(window, "location", {
      value: { search: "?parentId=parent-form-id" },
      writable: true,
    });

    vi.mocked(questionsApi.getById).mockReturnValue(parentForm);
    vi.mocked(questionsApi.save).mockImplementation(vi.fn());

    renderWithRouter(<QuestionForm onSubmit={mockOnSubmit} />);

    const saveButton = screen.getByRole("button", { name: /save form/i });
    await user.click(saveButton);

    expect(questionsApi.save).toHaveBeenCalledWith(
      expect.objectContaining({
        parentFormId: "parent-form-id",
        parentFormTitle: "Parent Form",
      })
    );
  });

  it("manages sections correctly", async () => {
    const user = userEvent.setup();
    renderWithRouter(<QuestionForm onSubmit={mockOnSubmit} />);

    // Initially should show 0 sections
    expect(screen.getByText("Sections Count: 0")).toBeInTheDocument();

    // Add a section
    const addSectionButton = screen.getByTestId("add-section-button");
    await user.click(addSectionButton);

    // Should now show 1 section
    expect(screen.getByText("Sections Count: 1")).toBeInTheDocument();

    // Save form with sections
    vi.mocked(sectionsApi.save).mockImplementation(vi.fn());
    const saveButton = screen.getByRole("button", { name: /save form/i });
    await user.click(saveButton);

    expect(sectionsApi.save).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({
          id: "new-section",
          title: "New Section",
        }),
      ])
    );
  });
});
