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

  const fileTypeOptions = [
    { value: "any", label: "Any file type" },
    { value: "image", label: "Images (JPG, PNG, GIF)" },
    { value: "pdf", label: "PDF" },
    { value: "excel", label: "Excel (XLS, XLSX)" },
  ];

  const MAX_IMAGE_BYTES = 50 * 1024;

  const compressImageFile = async (file: File): Promise<string> => {
    const readDataUrl = () =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });

    const loadImageElement = (dataUrl: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const imageElement = new Image();
        imageElement.onload = () => resolve(imageElement);
        imageElement.onerror = () => reject(new Error("Failed to load image"));
        imageElement.src = dataUrl;
      });

    const dataUrl = await readDataUrl();
    const imageElement = await loadImageElement(dataUrl);
    const canvas = document.createElement("canvas");

    if (typeof canvas.toBlob !== "function") {
      if (file.size <= MAX_IMAGE_BYTES) {
        return dataUrl;
      }
      throw new Error("Unable to process image. Please upload a smaller file under 50KB.");
    }

    if (!canvas.getContext("2d")) {
      if (file.size <= MAX_IMAGE_BYTES) {
        return dataUrl;
      }
      throw new Error("Unable to process image. Please upload a smaller file under 50KB.");
    }

    const drawImage = (width: number, height: number) => {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas not supported");
      }
      context.drawImage(imageElement, 0, 0, width, height);
    };

    const createBlob = async (quality: number) =>
      new Promise<Blob | null>((resolve) =>
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality)
      );

    const maxDimension = 1024;
    const initialScale = Math.min(
      1,
      maxDimension / imageElement.width,
      maxDimension / imageElement.height
    );

    let width = Math.max(1, Math.round(imageElement.width * initialScale));
    let height = Math.max(1, Math.round(imageElement.height * initialScale));
    drawImage(width, height);

    let quality = 0.9;
    let blob = await createBlob(quality);
    if (!blob) {
      if (file.size <= MAX_IMAGE_BYTES) {
        return dataUrl;
      }
      throw new Error("Unable to process image");
    }

    const minQuality = 0.2;

    while (blob.size > MAX_IMAGE_BYTES && quality > minQuality) {
      quality = Math.max(minQuality, quality - 0.1);
      const nextBlob = await createBlob(quality);
      if (!nextBlob) {
        break;
      }
      blob = nextBlob;
    }

    while (blob.size > MAX_IMAGE_BYTES && (width > 120 || height > 120)) {
      width = Math.max(120, Math.floor(width * 0.85));
      height = Math.max(120, Math.floor(height * 0.85));
      drawImage(width, height);
      quality = 0.9;
      let nextBlob = await createBlob(quality);
      if (!nextBlob) {
        break;
      }
      blob = nextBlob;
      while (blob.size > MAX_IMAGE_BYTES && quality > minQuality) {
        quality = Math.max(minQuality, quality - 0.1);
        const smallerBlob = await createBlob(quality);
        if (!smallerBlob) {
          break;
        }
        blob = smallerBlob;
      }
    }

    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error("Unable to compress image below 50KB. Try a smaller image.");
    }

    return await new Promise<string>((resolve, reject) => {
      const resultReader = new FileReader();
      resultReader.onload = () => resolve(resultReader.result as string);
      resultReader.onerror = () => reject(new Error("Failed to read compressed image"));
      resultReader.readAsDataURL(blob);
    });
  };

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
      imageUrl: "",
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
    if (!file) {
      return;
    }

    try {
      const compressed = await compressImageFile(file);
      updateQuestion(id, { imageUrl: compressed });
    } catch (error) {
      console.error("Image compression failed:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Failed to process image. Please try a smaller file."
      );
    } finally {
      e.target.value = "";
    }
  };

  const removeImage = (id: string) => {
    updateQuestion(id, { imageUrl: undefined });
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
    const selectedFileType = q.allowedFileTypes?.[0] ?? "any";
    const selectedFileTypeOption = fileTypeOptions.find(
      (option) => option.value === selectedFileType
    );

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
                onChange={(e) => {
                  void handleImageUpload(q.id, e);
                }}
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
          {q.imageUrl ? (
            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-4 bg-neutral-100 border border-neutral-200 rounded-lg p-3">
              <img
                src={q.imageUrl}
                alt="Question"
                className="h-24 w-24 object-contain rounded-md border border-neutral-200 bg-white"
              />
              <button
                type="button"
                onClick={() => removeImage(q.id)}
                className="px-3 py-2 text-sm font-semibold text-red-600 hover:text-white hover:bg-red-500 border border-red-200 rounded-lg transition-colors"
              >
                Remove Image
              </button>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <label className="inline-flex items-center justify-center px-3 py-2 border-2 border-dashed border-primary-200 rounded-lg cursor-pointer text-sm font-medium text-primary-600 hover:border-primary-400 hover:text-primary-700 transition-colors">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void handleImageUpload(q.id, e);
                }}
              />
              Upload Image
            </label>
            <p className="text-xs text-primary-500">JPEG or PNG up to 50KB.</p>
          </div>

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
                const updates: Partial<FollowUpQuestion> = {
                  type,
                  options: needsOptions(type) ? [""] : undefined,
                };
                if (type === "file") {
                  updates.allowedFileTypes =
                    q.allowedFileTypes && q.allowedFileTypes.length > 0
                      ? q.allowedFileTypes
                      : ["image", "pdf", "excel"];
                } else if (q.allowedFileTypes) {
                  updates.allowedFileTypes = undefined;
                }
                updateQuestion(q.id, updates);
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

          {q.type === "file" ? (
            <div className="mt-4">
              <label className="block text-sm font-medium text-primary-600 mb-2">
                Allowed file type
              </label>
              <select
                value={selectedFileType}
                onChange={(e) => {
                  const value = e.target.value;
                  updateQuestion(q.id, {
                    allowedFileTypes: value === "any" ? undefined : [value],
                  });
                }}
                className="input-field"
              >
                {fileTypeOptions.map((option) => (
                  <option key={`${q.id}-file-type-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-primary-500 mt-1">
                {selectedFileType === "any"
                  ? "Respondents can upload any file type."
                  : `Respondents must upload files matching ${selectedFileTypeOption?.label}.`}
              </p>
            </div>
          ) : null}

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
