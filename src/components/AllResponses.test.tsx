import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AllResponses from "./AllResponses";
import { apiClient } from "../api/client";

vi.mock("../api/client", () => ({
  apiClient: {
    getResponses: vi.fn(),
    getForms: vi.fn(),
    getForm: vi.fn(),
    updateResponse: vi.fn(),
  },
}));

vi.mock("../context/NotificationContext", () => ({
  useNotification: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn(),
  }),
}));

vi.mock("../utils/responseExportUtils", () => ({
  sendResponseExcelViaEmail: vi.fn(),
  generateResponseExcelReport: vi.fn(),
}));

vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  BarElement: {},
  PointElement: {},
  LineElement: {},
  Title: {},
  Tooltip: {},
  Legend: {},
  Filler: {},
}));

vi.mock("react-chartjs-2", () => ({
  Bar: () => null,
  Line: () => null,
}));

const mockApiClient = vi.mocked(apiClient);

const buildMockData = (answerValue: any) => {
  const formId = "form-1";
  const sectionId = "section-1";
  const questionId = "question-1";
  const form = {
    _id: formId,
    id: formId,
    title: "Customer Request",
    sections: [
      {
        id: sectionId,
        title: "Section 1",
        description: "",
        questions: [
          {
            id: questionId,
            text: "Upload Photo",
            type: "fileUpload",
          },
        ],
      },
    ],
  };
  const response = {
    _id: "response-1",
    id: "response-1",
    questionId: formId,
    formTitle: form.title,
    answers: {
      [questionId]: answerValue,
    },
    createdAt: "2025-11-07T10:00:00.000Z",
    updatedAt: "2025-11-07T10:00:00.000Z",
    assignedTo: "user-1",
    status: "pending",
  };
  mockApiClient.getResponses.mockResolvedValue({ responses: [response] });
  mockApiClient.getForms.mockResolvedValue({ forms: [form] });
  mockApiClient.getForm.mockResolvedValue({ form });
};

const openResponseDetails = async () => {
  const user = userEvent.setup();
  const viewDetailsButton = await screen.findByRole("button", {
    name: /view details/i,
  });
  await user.click(viewDetailsButton);
  const responsesTab = await screen.findByRole("button", {
    name: /responses/i,
  });
  await user.click(responsesTab);
};

describe("AllResponses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders uploaded image when answer contains a data URL", async () => {
    const dataUrl = "data:image/png;base64,examplebase64";
    buildMockData(dataUrl);

    render(<AllResponses />);

    await openResponseDetails();

    await waitFor(() => {
      const image = document.querySelector(`img[src="${dataUrl}"]`);
      expect(image).not.toBeNull();
    });
  });

  it("keeps plain text display for non-image answers", async () => {
    const textAnswer = "Customer provided additional details.";
    buildMockData(textAnswer);

    render(<AllResponses />);

    await openResponseDetails();

    expect(
      await screen.findByText("Customer provided additional details.")
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
