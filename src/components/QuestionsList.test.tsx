import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuestionsList from "./QuestionsList";
import type { FollowUpQuestion } from "../types";

const renderQuestionsList = (overrides?: Partial<FollowUpQuestion>) => {
  const baseQuestion: FollowUpQuestion = {
    id: "question-1",
    text: "Question 1",
    type: "text",
    required: false,
    options: [],
    imageUrl: "",
    description: "",
  };

  const Wrapper = () => {
    const [questions, setQuestions] = React.useState<FollowUpQuestion[]>([
      { ...baseQuestion, ...overrides },
    ]);

    return (
      <>
        <QuestionsList questions={questions} onQuestionsChange={setQuestions} />
        {questions.map(
          (question) =>
            question.imageUrl && (
              <img
                key={question.id}
                src={question.imageUrl}
                alt="Question"
                data-testid={`question-image-${question.id}`}
              />
            )
        )}
      </>
    );
  };

  render(<Wrapper />);
};

describe("QuestionsList question content", () => {
  it("supports text-only questions", () => {
    renderQuestionsList();

    const textInput = screen.getByPlaceholderText("Question text") as HTMLInputElement;
    expect(textInput.value).toBe("Question 1");
    expect(screen.queryByTestId("question-image-question-1")).toBeNull();
  });

  it("supports image-only questions", async () => {
    renderQuestionsList({ text: "" });

    const user = userEvent.setup();
    const textInput = screen.getByPlaceholderText("Question text") as HTMLInputElement;
    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;

    await user.upload(
      fileInput,
      new File(["image"], "question.png", { type: "image/png" })
    );

    const preview = await screen.findByTestId("question-image-question-1");

    expect(textInput.value).toBe("");
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute("src", "data:image/jpeg;base64,mock-image-data");
  });

  it("supports questions with both text and image", async () => {
    renderQuestionsList();

    const user = userEvent.setup();
    const textInput = screen.getByPlaceholderText("Question text") as HTMLInputElement;
    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;

    await user.upload(
      fileInput,
      new File(["image"], "question.png", { type: "image/png" })
    );

    const preview = await screen.findByTestId("question-image-question-1");

    expect(textInput.value).toBe("Question 1");
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute("src", "data:image/jpeg;base64,mock-image-data");
  });
});
