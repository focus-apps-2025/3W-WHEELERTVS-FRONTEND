import { describe, it, expect } from "vitest";
import { useQuestionLogic } from "./useQuestionLogic";
import type { FollowUpQuestion } from "../types/forms";

const sampleQuestions: FollowUpQuestion[] = [
  {
    id: "main-eligibility",
    text: "Are you 18 years or older?",
    type: "radio",
  },
  {
    id: "id-verification",
    text: "Do you have valid identification documents?",
    type: "radio",
    showWhen: {
      questionId: "main-eligibility",
      value: "Yes",
    },
  },
  {
    id: "id-followup-details",
    text: "What specific improvements would you suggest?",
    type: "paragraph",
    showWhen: {
      questionId: "id-verification",
      value: "No",
    },
  },
  {
    id: "goal-completion",
    text: "Did you complete your desired goal with our help?",
    type: "radio",
  },
  {
    id: "support-details",
    text: "What type of support do you need?",
    type: "paragraph",
    showWhen: {
      questionId: "goal-completion",
      value: "Yes",
    },
  },
];

describe("useQuestionLogic", () => {
  const { getOrderedVisibleQuestions, getFollowUpQuestions, evaluateCondition } =
    useQuestionLogic();

  describe("getOrderedVisibleQuestions", () => {
    it("returns main questions followed by matching nested follow-ups", () => {
      const answers = {
        "main-eligibility": "Yes",
        "id-verification": "No",
        "goal-completion": "Yes",
      } as Record<string, any>;

      const ordered = getOrderedVisibleQuestions(sampleQuestions, answers);

      expect(ordered.map((question) => question.id)).toEqual([
        "main-eligibility",
        "id-verification",
        "id-followup-details",
        "goal-completion",
        "support-details",
      ]);
    });

    it("skips follow-ups when parent answers do not satisfy their conditions", () => {
      const answers = {
        "main-eligibility": "No",
        "goal-completion": "No",
      } as Record<string, any>;

      const ordered = getOrderedVisibleQuestions(sampleQuestions, answers);

      expect(ordered.map((question) => question.id)).toEqual([
        "main-eligibility",
        "goal-completion",
      ]);
    });
  });

  describe("evaluateCondition", () => {
    it("supports matching conditions against array and object answers", () => {
      expect(evaluateCondition(["Yes", "Later"], "Yes")).toBe(true);
      expect(evaluateCondition(["Later"], "Yes")).toBe(false);
      expect(
        evaluateCondition(
          {
            immediate: "Yes",
            deferred: "No",
          },
          "Yes"
        )
      ).toBe(true);
      expect(
        evaluateCondition(
          {
            immediate: "Maybe",
          },
          "Yes"
        )
      ).toBe(false);
    });
  });

  describe("getFollowUpQuestions", () => {
    it("returns only follow-ups linked to the specified parent", () => {
      const followUps = getFollowUpQuestions(sampleQuestions, "main-eligibility");

      expect(followUps.map((question) => question.id)).toEqual([
        "id-verification",
      ]);
    });
  });
});
