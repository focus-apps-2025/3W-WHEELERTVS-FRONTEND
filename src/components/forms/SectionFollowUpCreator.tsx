import React, { useState } from "react";
import {
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Link2,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Option {
  id: string;
  label: string;
  followUpSectionId?: string;
}

interface FormSection {
  id: string;
  title: string;
  question: string;
  options: Option[];
  parentSectionId?: string;
  description?: string;
}

interface SectionFollowUpFormData {
  formTitle: string;
  formDescription: string;
  sections: FormSection[];
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const SectionFollowUpCreator: React.FC = () => {
  const [formData, setFormData] = useState<SectionFollowUpFormData>({
    formTitle: "",
    formDescription: "",
    sections: [
      {
        id: generateId(),
        title: "Section 1",
        question: "",
        options: [
          { id: generateId(), label: "" },
          { id: generateId(), label: "" },
          { id: generateId(), label: "" },
          { id: generateId(), label: "" },
        ],
      },
    ],
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(formData.sections.map((s) => s.id))
  );
  const [showSectionSelector, setShowSectionSelector] = useState<string | null>(
    null
  );
  const [selectedOptionForLink, setSelectedOptionForLink] = useState<string | null>(
    null
  );

  const toggleSectionExpanded = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, title } : s
      ),
    }));
  };

  const updateSectionQuestion = (sectionId: string, question: string) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, question } : s
      ),
    }));
  };

  const updateSectionDescription = (sectionId: string, description: string) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, description } : s
      ),
    }));
  };

  const updateOption = (
    sectionId: string,
    optionId: string,
    label: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              options: s.options.map((o) =>
                o.id === optionId ? { ...o, label } : o
              ),
            }
          : s
      ),
    }));
  };

  const linkOptionToSection = (
    sectionId: string,
    optionId: string,
    followUpSectionId: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              options: s.options.map((o) =>
                o.id === optionId
                  ? { ...o, followUpSectionId }
                  : o
              ),
            }
          : s
      ),
    }));
    setShowSectionSelector(null);
    setSelectedOptionForLink(null);
  };

  const unlinkOption = (sectionId: string, optionId: string) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              options: s.options.map((o) =>
                o.id === optionId
                  ? { ...o, followUpSectionId: undefined }
                  : o
              ),
            }
          : s
      ),
    }));
  };

  const addSection = () => {
    const newSection: FormSection = {
      id: generateId(),
      title: `Section ${formData.sections.length + 1}`,
      question: "",
      options: [
        { id: generateId(), label: "" },
        { id: generateId(), label: "" },
        { id: generateId(), label: "" },
        { id: generateId(), label: "" },
      ],
    };
    setFormData((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setExpandedSections((prev) => new Set([...prev, newSection.id]));
  };

  const removeSection = (sectionId: string) => {
    if (formData.sections.length === 1) {
      setError("Form must have at least one section");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      sections: prev.sections
        .filter((s) => s.id !== sectionId)
        .map((s) => ({
          ...s,
          options: s.options.map((o) =>
            o.followUpSectionId === sectionId
              ? { ...o, followUpSectionId: undefined }
              : o
          ),
        })),
    }));
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });
  };

  const getFollowUpSectionLabel = (sectionId: string) => {
    const section = formData.sections.find((s) => s.id === sectionId);
    return section ? section.title : "Unknown Section";
  };

  const validateForm = (): boolean => {
    if (!formData.formTitle.trim()) {
      setError("Form title is required");
      return false;
    }

    if (!formData.formDescription.trim()) {
      setError("Form description is required");
      return false;
    }

    for (const section of formData.sections) {
      if (!section.title.trim()) {
        setError(`Section title is required`);
        return false;
      }

      if (!section.question.trim()) {
        setError(`Question is required in ${section.title}`);
        return false;
      }

      const filledOptions = section.options.filter((o) => o.label.trim());
      if (filledOptions.length < 2) {
        setError(`${section.title} must have at least 2 options`);
        return false;
      }

      const uniqueOptions = new Set(filledOptions.map((o) => o.label.toLowerCase()));
      if (uniqueOptions.size !== filledOptions.length) {
        setError(`All options in ${section.title} must be unique`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      const payload = {
        title: formData.formTitle,
        description: formData.formDescription,
        sections: formData.sections.map((s) => ({
          title: s.title,
          description: s.description,
          question: s.question,
          options: s.options
            .filter((o) => o.label.trim())
            .map((o) => ({
              label: o.label,
              followUpSectionId: o.followUpSectionId,
            })),
          parentSectionId: s.parentSectionId,
        })),
      };

      const response = await fetch("/api/forms/with-sections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create form");
      }

      setSuccess("Form with follow-up sections created successfully!");
      setTimeout(() => {
        setFormData({
          formTitle: "",
          formDescription: "",
          sections: [
            {
              id: generateId(),
              title: "Section 1",
              question: "",
              options: [
                { id: generateId(), label: "" },
                { id: generateId(), label: "" },
                { id: generateId(), label: "" },
                { id: generateId(), label: "" },
              ],
            },
          ],
        });
        setSuccess(null);
      }, 2000);
    } catch (error) {
      console.error("Error creating form:", error);
      setError(error instanceof Error ? error.message : "Failed to create form");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
          Create Form with Follow-up Sections
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Create a multi-section form where each option can link to follow-up sections
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Form Information
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Form Title *
              </label>
              <input
                type="text"
                value={formData.formTitle}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    formTitle: e.target.value,
                  }))
                }
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter form title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Form Description *
              </label>
              <textarea
                value={formData.formDescription}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    formDescription: e.target.value,
                  }))
                }
                rows={3}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe what this form is for"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Sections</h3>
            <button
              type="button"
              onClick={addSection}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </button>
          </div>

          {formData.sections.map((section, sectionIndex) => (
            <div
              key={section.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900"
            >
              <div className="bg-gray-50 dark:bg-gray-800 p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700"
                onClick={() => toggleSectionExpanded(section.id)}>
                <div className="flex items-center space-x-3">
                  {expandedSections.has(section.id) ? (
                    <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  )}
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                      {section.title || `Section ${sectionIndex + 1}`}
                    </h4>
                    {section.parentSectionId && (
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Parent: {getFollowUpSectionLabel(section.parentSectionId)}
                      </p>
                    )}
                  </div>
                </div>
                {formData.sections.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSection(section.id);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {expandedSections.has(section.id) && (
                <div className="p-6 space-y-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Section Title *
                    </label>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) =>
                        updateSectionTitle(section.id, e.target.value)
                      }
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Section 1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Section Description (Optional)
                    </label>
                    <textarea
                      value={section.description || ""}
                      onChange={(e) =>
                        updateSectionDescription(section.id, e.target.value)
                      }
                      rows={2}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Add a description for this section"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Question (Single Choice) *
                    </label>
                    <input
                      type="text"
                      value={section.question}
                      onChange={(e) =>
                        updateSectionQuestion(section.id, e.target.value)
                      }
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., What is your preference?"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Options (4 Options - Select Only 1)
                    </label>
                    <div className="space-y-3">
                      {section.options.map((option, optionIndex) => (
                        <div
                          key={option.id}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3 flex-1">
                              <input
                                type="radio"
                                disabled
                                className="h-4 w-4 text-blue-600 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={option.label}
                                onChange={(e) =>
                                  updateOption(
                                    section.id,
                                    option.id,
                                    e.target.value
                                  )
                                }
                                className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder={`Option ${optionIndex + 1}`}
                              />
                            </div>
                          </div>

                          {option.followUpSectionId ? (
                            <div className="ml-7 flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
                              <div className="flex items-center space-x-2 text-blue-700">
                                <Link2 className="h-4 w-4" />
                                <span className="text-sm font-medium">
                                  Links to: {getFollowUpSectionLabel(option.followUpSectionId)}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  unlinkOption(section.id, option.id)
                                }
                                className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="ml-7">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowSectionSelector(option.id);
                                  setSelectedOptionForLink(option.id);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
                              >
                                <Link2 className="h-3 w-3" />
                                <span>Link to Follow-up Section</span>
                              </button>
                            </div>
                          )}

                          {showSectionSelector === option.id && (
                            <div className="ml-7 mt-2 bg-white dark:bg-gray-900 border border-blue-300 rounded-lg p-3">
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                Select section to link to:
                              </p>
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {formData.sections
                                  .filter((s) => s.id !== section.id)
                                  .map((s) => (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => {
                                        linkOptionToSection(
                                          section.id,
                                          option.id,
                                          s.id
                                        );
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-100 rounded transition-colors"
                                    >
                                      {s.title}
                                    </button>
                                  ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowSectionSelector(null)}
                                className="w-full mt-2 px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "Creating..." : "Create Form"}
          </button>
        </div>
      </form>
    </div>
  );
};
