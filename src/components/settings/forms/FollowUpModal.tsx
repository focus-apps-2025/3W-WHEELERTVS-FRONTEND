import React, { useState } from "react";
import { X, Save } from "lucide-react";
import type { Question } from "../../../types";
import { questionsApi } from "../../../api/storage";
import QuestionDescription from "../../QuestionDescription";
import QuestionsList from "../../QuestionsList";
import ImageUpload from "../../ImageUpload";
import { useNotification } from "../../../context/NotificationContext";

interface FollowUpModalProps {
  question: Question;
  onClose: () => void;
  onSave: (question: Question) => void;
}

export default function FollowUpModal({
  question,
  onClose,
  onSave,
}: FollowUpModalProps) {
  const [followUpForm, setFollowUpForm] = useState<Question>({
    id: crypto.randomUUID(),
    title: "",
    description: "",
    imageUrl: "",
    logoUrl: "",
    followUpQuestions: [],
    parentFormId: question.id,
  });
  const { showError, showSuccess } = useNotification();

  const handleImageUpload = (file: File, type: "logo" | "header") => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === "logo") {
        setFollowUpForm({ ...followUpForm, logoUrl: reader.result as string });
      } else {
        setFollowUpForm({ ...followUpForm, imageUrl: reader.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!followUpForm.title.trim()) {
      showError("Please enter a form title", "Validation Error");
      return;
    }
    try {
      questionsApi.save(followUpForm);
      showSuccess("Follow-up form created successfully", "Success");
      onSave(followUpForm);
    } catch (error: any) {
      showError(error.message || "Failed to create follow-up form", "Error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create Follow-up Form
            </h3>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Parent Form: {question.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <ImageUpload
              imageUrl={followUpForm.logoUrl}
              type="logo"
              onUpload={(file) => handleImageUpload(file, "logo")}
            />
            <ImageUpload
              imageUrl={followUpForm.imageUrl}
              type="header"
              onUpload={(file) => handleImageUpload(file, "header")}
            />
          </div>

          <QuestionDescription
            title={followUpForm.title}
            description={followUpForm.description}
            onTitleChange={(title) =>
              setFollowUpForm({ ...followUpForm, title })
            }
            onDescriptionChange={(description) =>
              setFollowUpForm({ ...followUpForm, description })
            }
          />

          <QuestionsList
            questions={followUpForm.followUpQuestions}
            onQuestionsChange={(followUpQuestions) =>
              setFollowUpForm({ ...followUpForm, followUpQuestions })
            }
          />

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Create Follow-up Form
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
