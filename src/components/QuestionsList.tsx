import React from "react";
import {
  MessageSquarePlus,
  ImagePlus,
  FileText,
  PlusSquare,
  Trash2,
  Copy,
} from "lucide-react";
import type { FollowUpQuestion, QuestionType } from "../types";
import OptionsInput from "./QuestionTypes/OptionsInput";
import GridOptionsInput from "./QuestionTypes/GridOptionsInput";

interface QuestionsListProps {
  questions: FollowUpQuestion[];
  onQuestionsChange: (questions: FollowUpQuestion[]) => void;
}

export default function QuestionsList({
  questions,
  onQuestionsChange,
}: QuestionsListProps) {
  const questionTypes: { value: QuestionType; label: string }[] = [
    { value: "text", label: "Text" },
    { value: "paragraph", label: "Paragraph" },
    { value: "radio", label: "Multiple Choice" },
    { value: "checkbox", label: "Checkboxes" },
    { value: "search-select", label: "Search/Filter Dropdown" },
    { value: "email", label: "Email" },
    { value: "url", label: "URL" },
    { value: "tel", label: "Phone Number" },
    { value: "date", label: "Date" },
    { value: "time", label: "Time" },
    { value: "file", label: "File Upload" },
    { value: "range", label: "Range" },
    { value: "rating", label: "Rating" },
    { value: "scale", label: "Linear Scale" },
    { value: "radio-image", label: "Image Choice" },
  ];

  const addQuestion = (parentId?: string) => {
    const newQuestion: FollowUpQuestion = {
      id: crypto.randomUUID(),
      text: "",
      type: "text",
      required: false,
      parentId,
      imageUrl: "",
      description: "",
      options: [],
    };
    onQuestionsChange([...questions, newQuestion]);
  };

  const copyQuestion = (question: FollowUpQuestion) => {
    const newQuestion: FollowUpQuestion = {
      ...question,
      id: crypto.randomUUID(),
      text: `${question.text} (Copy)`,
    };

    const currentIndex = questions.findIndex((q) => q.id === question.id);
    const updatedQuestions = [
      ...questions.slice(0, currentIndex + 1),
      newQuestion,
      ...questions.slice(currentIndex + 1),
    ];

    onQuestionsChange(updatedQuestions);
  };

  const addMiddleQuestion = (currentQuestion: FollowUpQuestion) => {
    const newQuestion: FollowUpQuestion = {
      id: crypto.randomUUID(),
      text: "",
      type: "text",
      required: false,
      imageUrl: "",
      description: "",
      options: [],
    };

    const currentIndex = questions.findIndex(
      (q) => q.id === currentQuestion.id
    );
    const updatedQuestions = [
      ...questions.slice(0, currentIndex + 1),
      newQuestion,
      ...questions.slice(currentIndex + 1),
    ];

    onQuestionsChange(updatedQuestions);
  };

  const addFollowUpQuestion = (parentQuestion: FollowUpQuestion) => {
    const newQuestion: FollowUpQuestion = {
      id: crypto.randomUUID(),
      text: "",
      type: "text",
      required: false,
      showWhen: {
        questionId: parentQuestion.id,
        value: parentQuestion.options?.[0] || "",
      },
      options: [],
    };
    onQuestionsChange([...questions, newQuestion]);
  };

  const removeQuestion = (id: string) => {
    onQuestionsChange(
      questions.filter((q) => q.id !== id && q.showWhen?.questionId !== id)
    );
  };

  const updateQuestion = (id: string, updates: Partial<FollowUpQuestion>) => {
    onQuestionsChange(
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  const handleImageUpload = async (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageData = reader.result as string;
        updateQuestion(id, { imageUrl: imageData });
      };
      reader.readAsDataURL(file);
    }
  };

  const needsOptions = (type: QuestionType) => {
    return ["radio", "checkbox", "radio-image", "search-select"].includes(type);
  };

  const mainQuestions = questions.filter((q) => !q.showWhen);
  const getFollowUpQuestions = (questionId: string) =>
    questions.filter((q) => q.showWhen?.questionId === questionId);

  const renderQuestion = (
    q: FollowUpQuestion,
    index: number,
    isFollowUp = false
  ) => {
    const followUpQuestions = getFollowUpQuestions(q.id);

    return (
      <div
        key={q.id}
        className={`card p-6 bg-neutral-50 ${isFollowUp ? "ml-8 mt-4" : ""}`}
      >
        <div className="flex justify-between items-start mb-4">
          <h4 className="font-medium text-primary-600">
            {isFollowUp ? "Follow-up Question" : `Question ${index + 1}`}
          </h4>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => copyQuestion(q)}
              className="p-2 text-primary-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
              title="Copy Question"
            >
              <Copy className="w-5 h-5" />
            </button>
            {needsOptions(q.type) && (
              <button
                type="button"
                onClick={() => addFollowUpQuestion(q)}
                className="p-2 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                title="Add Follow-up Question"
              >
                <MessageSquarePlus className="w-5 h-5" />
              </button>
            )}
            <label
              className="flex items-center p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
              title="Add Image"
            >
              <ImagePlus className="w-5 h-5" />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(q.id, e)}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const description = prompt(
                  "Enter question description:",
                  q.description
                );
                if (description !== null) {
                  updateQuestion(q.id, { description });
                }
              }}
              className="p-2 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
              title="Add Description"
            >
              <FileText className="w-5 h-5" />
            </button>
            {!isFollowUp && (
              <button
                type="button"
                onClick={() => addMiddleQuestion(q)}
                className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Add Question After"
              >
                <PlusSquare className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => removeQuestion(q.id)}
              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove Question"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {q.imageUrl && (
            <div className="mt-2">
              <img
                src={q.imageUrl}
                alt="Question"
                className="max-h-48 rounded-lg object-contain"
              />
            </div>
          )}

          {q.description && (
            <div className="mt-2 text-sm text-primary-500 bg-primary-50 p-3 rounded-lg">
              {q.description}
            </div>
          )}

          <input
            type="text"
            value={q.text}
            onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
            placeholder="Question text"
            className="input-field"
          />

          <div className="flex space-x-4">
            <select
              value={q.type}
              onChange={(e) => {
                const type = e.target.value as QuestionType;
                updateQuestion(q.id, {
                  type,
                  options: needsOptions(type) ? [""] : undefined,
                });
              }}
              className="flex-1 input-field"
            >
              {questionTypes.map((type) => (
                <option key={`${q.id}-${type.value}`} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={q.required}
                onChange={(e) =>
                  updateQuestion(q.id, { required: e.target.checked })
                }
                className="text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
              />
              <span className="text-sm text-primary-600">Required</span>
            </label>
          </div>

          {needsOptions(q.type) && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-primary-600 mb-2">
                Options
              </label>
              <OptionsInput
                options={q.options || []}
                onChange={(options) => updateQuestion(q.id, { options })}
              />

              {/* Correct Answer Selection for Quiz Questions */}
              {q.options && q.options.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-primary-600 mb-2">
                    Correct Answer (Optional - for quiz mode)
                  </label>
                  <select
                    value={q.correctAnswer || ""}
                    onChange={(e) => {
                      console.log("Correct answer changed:", {
                        questionId: q.id,
                        questionText: q.text,
                        oldValue: q.correctAnswer,
                        newValue: e.target.value,
                        options: q.options,
                      });
                      updateQuestion(q.id, {
                        correctAnswer: e.target.value || undefined,
                      });
                    }}
                    className="input-field"
                  >
                    <option value="">-- No correct answer --</option>
                    {q.options
                      .filter((opt) => opt && opt.trim() !== "")
                      .map((option) => (
                        <option
                          key={`${q.id}-correct-${option}`}
                          value={option}
                        >
                          {option}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select the correct answer if this is a quiz question. Leave
                    empty for regular questions.
                  </p>
                  {/* Debug info */}
                  <p className="text-xs text-blue-600 mt-1">
                    Current value: "{q.correctAnswer || "(empty)"}"
                  </p>
                </div>
              )}
            </div>
          )}

          {["range", "scale"].includes(q.type) && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-600 mb-1">
                  Min
                </label>
                <input
                  type="number"
                  value={q.min || 0}
                  onChange={(e) =>
                    updateQuestion(q.id, { min: parseInt(e.target.value) })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-600 mb-1">
                  Max
                </label>
                <input
                  type="number"
                  value={q.max || 10}
                  onChange={(e) =>
                    updateQuestion(q.id, { max: parseInt(e.target.value) })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-600 mb-1">
                  Step
                </label>
                <input
                  type="number"
                  value={q.step || 1}
                  onChange={(e) =>
                    updateQuestion(q.id, { step: parseInt(e.target.value) })
                  }
                  className="input-field"
                />
              </div>
            </div>
          )}
        </div>

        {isFollowUp &&
          q.showWhen &&
          needsOptions(
            questions.find((pq) => pq.id === q.showWhen?.questionId)?.type ||
              "text"
          ) && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-primary-600 mb-2">
                Show when parent answer is
              </label>
              <select
                value={q.showWhen.value as string}
                onChange={(e) =>
                  updateQuestion(q.id, {
                    showWhen: { ...q.showWhen, value: e.target.value },
                  })
                }
                className="input-field"
              >
                {questions
                  .find((pq) => pq.id === q.showWhen?.questionId)
                  ?.options?.map((option) => (
                    <option key={`${q.id}-option-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
              </select>
            </div>
          )}

        {followUpQuestions.map((followUp, i) =>
          renderQuestion(followUp, i, true)
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-primary-600">Questions</h3>
        <button
          type="button"
          onClick={() => addQuestion()}
          className="btn-primary flex items-center"
        >
          <PlusSquare className="w-4 h-4 mr-2" />
          Add Question
        </button>
      </div>

      <div className="space-y-4">
        {mainQuestions.map((q, index) => renderQuestion(q, index))}
      </div>
    </div>
  );
}
