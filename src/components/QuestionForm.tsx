import React, { useState, useEffect } from "react";
import { Save, ArrowLeft } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import type { Question } from "../types";
import PreviewButton from "./PreviewButton";
import ImageUpload from "./ImageUpload";
import QuestionDescription from "./QuestionDescription";
import SectionsList from "./sections/SectionsList";
import { questionsApi } from "../api/storage";
import { sectionsApi } from "../api/sections";

interface QuestionFormProps {
  onSubmit: (data: Question) => void;
}

export default function QuestionForm({ onSubmit }: QuestionFormProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [question, setQuestion] = useState<Question>({
    id: id || crypto.randomUUID(),
    title: "",
    imageUrl: "",
    description: "",
    sections: [],
    followUpQuestions: [],
  });

  useEffect(() => {
    if (id) {
      const existingQuestion = questionsApi.getById(id);
      if (existingQuestion) {
        // Load sections from sectionsApi
        const sections = sectionsApi.getByFormId(id);
        setQuestion({
          ...existingQuestion,
          sections: sections.length > 0 ? sections : existingQuestion.sections,
        });
      }
    }
  }, [id]);

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setQuestion({ ...question, imageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const parentFormId = urlParams.get("parentId");

    const questionToSave = parentFormId
      ? {
          ...question,
          parentFormId,
          parentFormTitle: questionsApi.getById(parentFormId)?.title || "",
        }
      : question;

    // Save sections separately
    if (question.sections.length > 0) {
      sectionsApi.save(questionToSave.id, question.sections);
    }

    questionsApi.save(questionToSave);
    onSubmit(questionToSave);
    navigate("/forms/management");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-medium text-primary-600 mb-3">
            {id ? "Edit Form" : "Create New Form"}
          </h1>
          <p className="text-primary-500 text-lg">
            {id
              ? "Modify your form structure and content"
              : "Design your form with custom sections and questions"}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          {id && <PreviewButton questionId={id} />}
        </div>
      </div>

      <div className="space-y-8">
        <ImageUpload
          imageUrl={question.imageUrl}
          type="header"
          onUpload={handleImageUpload}
        />

        <QuestionDescription
          title={question.title}
          description={question.description}
          onTitleChange={(title) => setQuestion({ ...question, title })}
          onDescriptionChange={(description) =>
            setQuestion({ ...question, description })
          }
        />

        <SectionsList
          sections={question.sections}
          onSectionsChange={(sections) =>
            setQuestion({ ...question, sections })
          }
        />

        <div className="flex justify-end pt-6">
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-primary flex items-center px-6 py-3 text-base"
          >
            <Save className="w-5 h-5 mr-2" />
            Save Form
          </button>
        </div>
      </div>
    </div>
  );
}
