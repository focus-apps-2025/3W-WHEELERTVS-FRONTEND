import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  Eye,
  X,
  Edit2,
  BarChart3,
  Copy,
  MoreVertical,
  Users,
  Calendar,
  FileText,
} from "lucide-react";
import { apiClient } from "../api/client";
import { questionsApi } from "../api/storage";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { NestedFollowUpRenderer } from "./NestedFollowUpRenderer";

interface FormSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

interface Question {
  id: string;
  text: string;
  type: string;
  required: boolean;
  options?: string[];
  description?: string;
  followUpQuestions?: FollowUpQuestion[];
  showWhen?: ShowWhen;
  parentId?: string;
}

interface ShowWhen {
  questionId: string;
  value: string | number;
}

interface FollowUpQuestion {
  id: string;
  text: string;
  type: string;
  required: boolean;
  options?: string[];
  description?: string;
  showWhen?: ShowWhen;
  parentId: string;
  followUpQuestions?: FollowUpQuestion[]; // Support nested follow-ups
  requireFollowUp?: boolean; // Make follow-up mandatory for certain question types
}

export default function FormCreator() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const [mode, setMode] = useState<"list" | "create">("list");
  const [forms, setForms] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    isVisible: true,
    sections: [
      {
        id: crypto.randomUUID(),
        title: "Section 1",
        description: "",
        questions: [],
      },
    ] as FormSection[],
  });
  const { showSuccess, showError, showConfirm } = useNotification();

  // Fetch tenants for superadmin
  useEffect(() => {
    const fetchTenants = async () => {
      if (user?.role === "superadmin") {
        try {
          const response = await apiClient.getTenants();
          setTenants(response.tenants || []);
          // Auto-select first tenant if available
          if (response.tenants && response.tenants.length > 0) {
            setSelectedTenantId(response.tenants[0]._id);
          }
        } catch (error) {
          console.error("Failed to fetch tenants:", error);
        }
      }
    };
    fetchTenants();
  }, [user]);

  useEffect(() => {
    setForms(questionsApi.getAll());
    if (id) {
      // Load existing form from API for editing
      const loadForm = async () => {
        try {
          const response = await apiClient.getForm(id);
          const backendForm = response.form;

          // Set the tenant ID from the loaded form
          if (backendForm.tenantId) {
            setSelectedTenantId(backendForm.tenantId);
          }

          // Transform backend form to frontend format
          // Reconstruct nested follow-up questions from flat array
          const sectionsWithNestedFollowUps = (backendForm.sections || []).map(
            (section: any) => {
              const mainQuestions: Question[] = [];
              const followUpMap = new Map<string, FollowUpQuestion[]>();

              // First pass: separate main questions and follow-ups
              section.questions.forEach((q: any) => {
                if (q.showWhen && q.showWhen.questionId) {
                  // This is a follow-up question
                  const parentId = q.showWhen.questionId;
                  if (!followUpMap.has(parentId)) {
                    followUpMap.set(parentId, []);
                  }
                  followUpMap.get(parentId)!.push(q as FollowUpQuestion);
                } else {
                  // This is a main question
                  mainQuestions.push(q as Question);
                }
              });

              // Second pass: attach follow-ups to their parent questions
              const questionsWithFollowUps = mainQuestions.map((q) => ({
                ...q,
                followUpQuestions: followUpMap.get(q.id) || [],
              }));

              return {
                ...section,
                questions: questionsWithFollowUps,
              };
            }
          );

          setForm({
            id: backendForm.id,
            title: backendForm.title,
            description: backendForm.description,
            isVisible: backendForm.isVisible,
            sections: sectionsWithNestedFollowUps,
            followUpQuestions: backendForm.followUpQuestions || [],
          });
        } catch (error) {
          console.error("Failed to load form:", error);
          // Fallback to local storage if API fails
          const existingForm = questionsApi.getById(id);
          if (existingForm) {
            setForm(existingForm);
          }
        }
      };
      loadForm();
      setMode("create");
    } else {
      // Check if we should start in create mode from navigation state
      const state = location.state as { mode?: string };
      if (state?.mode === "create") {
        setMode("create");
        setForm({
          title: "",
          description: "",
          isVisible: true,
          sections: [
            {
              id: crypto.randomUUID(),
              title: "Section 1",
              description: "",
              questions: [],
            },
          ] as FormSection[],
        });
      } else {
        setMode("list");
      }
    }
  }, [id, location.state]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      showError("Please enter a form title", "Validation Error");
      return;
    }

    if (!form.description.trim()) {
      showError("Please enter a form description", "Validation Error");
      return;
    }

    // Validate tenantId for superadmin
    if (user?.role === "superadmin" && !selectedTenantId) {
      showError("Please select a tenant for this form", "Validation Error");
      return;
    }

    // Determine tenantId based on user role
    const tenantId =
      user?.role === "superadmin" ? selectedTenantId : user?.tenantId;

    // Validate tenantId exists
    if (!tenantId) {
      showError(
        "Unable to determine tenant. Please try logging in again.",
        "Validation Error"
      );
      return;
    }

    // Validate sections
    if (!form.sections || form.sections.length === 0) {
      showError("Form must have at least one section", "Validation Error");
      return;
    }

    // Validate each section has required fields
    for (const section of form.sections) {
      if (!section.id) {
        showError("All sections must have an ID", "Validation Error");
        return;
      }
      if (!section.title || !section.title.trim()) {
        showError("All sections must have a title", "Validation Error");
        return;
      }

      // Validate questions in each section
      for (const question of section.questions) {
        if (!question.id) {
          showError(
            `Question in section "${section.title}" is missing an ID`,
            "Validation Error"
          );
          return;
        }
        if (!question.text || !question.text.trim()) {
          showError(
            `Question in section "${section.title}" is missing text`,
            "Validation Error"
          );
          return;
        }
        if (!question.type) {
          showError(
            `Question "${question.text}" in section "${section.title}" is missing a type`,
            "Validation Error"
          );
          return;
        }

        // Validate follow-up questions
        if (
          question.followUpQuestions &&
          question.followUpQuestions.length > 0
        ) {
          for (const followUp of question.followUpQuestions) {
            if (!followUp.id) {
              showError(
                `Follow-up question for "${question.text}" is missing an ID`,
                "Validation Error"
              );
              return;
            }
            if (!followUp.text || !followUp.text.trim()) {
              showError(
                `Follow-up question for "${question.text}" is missing text`,
                "Validation Error"
              );
              return;
            }
            if (!followUp.type) {
              showError(
                `Follow-up question "${followUp.text}" is missing a type`,
                "Validation Error"
              );
              return;
            }
          }
        }
      }
    }

    // Flatten follow-up questions into section questions array (recursively)
    const formToSave = {
      ...form,
      // Include tenantId for form creation
      tenantId: tenantId,
      sections: form.sections.map((section) => {
        const allQuestions: Question[] = [];

        // Recursive function to process a question and all its nested follow-ups
        const processQuestionRecursively = (
          question: Question,
          depth: number = 0
        ) => {
          const indent = "  ".repeat(depth);
          console.log(
            `${indent}Processing question: "${question.text}" (depth: ${depth})`
          );

          // Add the main question (without followUpQuestions to avoid duplication)
          const { followUpQuestions, ...mainQuestion } = question;
          allQuestions.push(mainQuestion as Question);

          // Recursively add its follow-up questions
          if (followUpQuestions && followUpQuestions.length > 0) {
            console.log(
              `${indent}Found ${followUpQuestions.length} follow-up questions`
            );
            followUpQuestions.forEach((followUp) => {
              const followUpWithShowWhen = {
                ...followUp,
                showWhen: followUp.showWhen || {
                  questionId: question.id,
                  value: followUp.showWhen?.value || "",
                },
              };
              console.log(
                `${indent}Adding follow-up: "${followUpWithShowWhen.text}"`
              );

              // Recursively process this follow-up's nested follow-ups
              processQuestionRecursively(
                followUpWithShowWhen as Question,
                depth + 1
              );
            });
          }
        };

        // Process only main questions (those without showWhen)
        section.questions.forEach((question) => {
          if (!question.showWhen) {
            processQuestionRecursively(question);
          }
        });

        return {
          ...section,
          questions: allQuestions,
        };
      }),
    };

    console.log("=== Form Validation Passed ===");
    console.log("TenantId:", tenantId);
    console.log("User role:", user?.role);
    console.log("Form to save:", JSON.stringify(formToSave, null, 2));

    try {
      if (id) {
        // Update existing form
        console.log("Updating form with ID:", id);
        await apiClient.updateForm(id, formToSave);
        showSuccess("Form updated successfully", "Success");
        navigate("/forms/management");
      } else {
        // Create new form
        console.log("Creating new form...");
        const response = await apiClient.createForm(formToSave);
        console.log("Form created successfully:", response);
        showSuccess("Form created successfully", "Success");
        setMode("list");
        // Refresh forms list - could call apiClient.getForms() here instead
        setForms(questionsApi.getAll());
      }
    } catch (error: any) {
      console.error("=== Error saving form ===");
      console.error("Error object:", error);
      console.error("Error message:", error.message);
      console.error("Error status:", error.status);
      console.error("Error response:", error.response);

      // Show detailed error message
      const errorMsg =
        error.message ||
        "Error saving form. Please check the console for details.";
      showError(errorMsg, "Error");
    }
  };

  const handleDelete = (id: string, title: string) => {
    showConfirm(
      `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      () => {
        questionsApi.delete(id);
        setForms(questionsApi.getAll());
        showSuccess("Form deleted successfully", "Success");
      },
      "Delete Form",
      "Delete",
      "Cancel"
    );
  };

  const handleDuplicate = (form: any) => {
    const newForm = {
      ...form,
      id: crypto.randomUUID(),
      title: `${form.title} (Copy)`,
      sections: form.sections.map((section: any) => ({
        ...section,
        id: crypto.randomUUID(),
        questions: section.questions.map((question: any) => ({
          ...question,
          id: crypto.randomUUID(),
        })),
      })),
      followUpQuestions: form.followUpQuestions.map((question: any) => ({
        ...question,
        id: crypto.randomUUID(),
      })),
    };
    questionsApi.save(newForm);
    setForms(questionsApi.getAll());
  };

  const handleToggleVisibility = (id: string, currentVisibility: boolean) => {
    const form = questionsApi.getById(id);
    if (form) {
      questionsApi.save({ ...form, isVisible: !currentVisibility });
      setForms(questionsApi.getAll());
    }
  };

  const handleCreateForm = () => {
    setMode("create");
    setForm({
      title: "",
      description: "",
      isVisible: true,
      sections: [
        {
          id: crypto.randomUUID(),
          title: "Section 1",
          description: "",
          questions: [],
        },
      ] as FormSection[],
    });
  };

  const loadDemoData = () => {
    const q1Id = crypto.randomUUID();
    const q2Id = crypto.randomUUID();
    const q3Id = crypto.randomUUID();
    const q4Id = crypto.randomUUID();

    setForm({
      title: "Student Registration Form - Demo",
      description:
        "This is a demo form with follow-up questions for testing purposes. It includes various question types and conditional logic.",
      isVisible: true,
      sections: [
        {
          id: crypto.randomUUID(),
          title: "Personal Information",
          description: "Please provide your basic information",
          questions: [
            {
              id: q1Id,
              text: "What is your full name?",
              type: "text",
              required: true,
              description: "Enter your first and last name",
            },
            {
              id: q2Id,
              text: "What is your email address?",
              type: "email",
              required: true,
              description: "We'll use this to contact you",
            },
            {
              id: q3Id,
              text: "Are you a new student or returning student?",
              type: "radio",
              required: true,
              options: ["New Student", "Returning Student"],
              followUpQuestions: [
                {
                  id: crypto.randomUUID(),
                  text: "Which program are you interested in?",
                  type: "radio",
                  required: true,
                  options: [
                    "Computer Science",
                    "Business Administration",
                    "Engineering",
                    "Arts",
                  ],
                  description: "Select your preferred program",
                  showWhen: {
                    questionId: q3Id,
                    value: "New Student",
                  },
                  parentId: q3Id,
                },
                {
                  id: crypto.randomUUID(),
                  text: "What is your current year of study?",
                  type: "radio",
                  required: true,
                  options: ["Year 1", "Year 2", "Year 3", "Year 4"],
                  description: "Select your current academic year",
                  showWhen: {
                    questionId: q3Id,
                    value: "Returning Student",
                  },
                  parentId: q3Id,
                },
              ],
            },
          ],
        },
        {
          id: crypto.randomUUID(),
          title: "Academic Background",
          description: "Tell us about your educational history",
          questions: [
            {
              id: q4Id,
              text: "Have you completed high school?",
              type: "radio",
              required: true,
              options: ["Yes", "No", "Currently Enrolled"],
              followUpQuestions: [
                {
                  id: crypto.randomUUID(),
                  text: "What was your graduation year?",
                  type: "text",
                  required: true,
                  description: "Enter the year you graduated",
                  showWhen: {
                    questionId: q4Id,
                    value: "Yes",
                  },
                  parentId: q4Id,
                },
                {
                  id: crypto.randomUUID(),
                  text: "What is your expected graduation date?",
                  type: "date",
                  required: true,
                  description: "Select your expected graduation date",
                  showWhen: {
                    questionId: q4Id,
                    value: "Currently Enrolled",
                  },
                  parentId: q4Id,
                },
              ],
            },
            {
              id: crypto.randomUUID(),
              text: "Rate your proficiency in English",
              type: "rating",
              required: true,
              description: "1 = Beginner, 5 = Native/Fluent",
              min: 1,
              max: 5,
            },
          ],
        },
        {
          id: crypto.randomUUID(),
          title: "Additional Information",
          description: "Optional information to help us serve you better",
          questions: [
            {
              id: crypto.randomUUID(),
              text: "Select all extracurricular activities you're interested in",
              type: "checkbox",
              required: false,
              options: [
                "Sports",
                "Music",
                "Drama",
                "Debate",
                "Volunteering",
                "Student Government",
              ],
              description: "You can select multiple options",
            },
            {
              id: crypto.randomUUID(),
              text: "Any additional comments or questions?",
              type: "paragraph",
              required: false,
              description:
                "Feel free to share anything else you'd like us to know",
            },
          ],
        },
      ] as FormSection[],
    });

    showSuccess(
      "Demo data loaded! You can now save this form.",
      "Demo Data Loaded"
    );
  };

  const handleEditForm = (formId: string) => {
    navigate(`/forms/${formId}/edit`);
  };

  const handleViewResponses = (id: string) => {
    navigate(`/forms/${id}/responses`);
  };

  const handlePreviewForm = (id: string) => {
    navigate(`/forms/${id}/preview`);
  };

  const addSection = () => {
    setForm((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          id: crypto.randomUUID(),
          title: `Section ${prev.sections.length + 1}`,
          description: "",
          questions: [],
        },
      ],
    }));
  };

  const updateSection = (sectionId: string, updates: Partial<FormSection>) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId ? { ...section, ...updates } : section
      ),
    }));
  };

  const deleteSection = (sectionId: string) => {
    if (form.sections.length <= 1) {
      alert("Forms must have at least one section");
      return;
    }

    setForm((prev) => ({
      ...prev,
      sections: prev.sections.filter((section) => section.id !== sectionId),
    }));
  };

  const addQuestion = (sectionId: string) => {
    const newQuestion: Question = {
      id: crypto.randomUUID(),
      text: "New Question",
      type: "text",
      required: false,
      description: "",
    };

    updateSection(sectionId, {
      questions: [
        ...(form.sections.find((s) => s.id === sectionId)?.questions || []),
        newQuestion,
      ],
    });
  };

  const updateQuestion = (
    sectionId: string,
    questionId: string,
    updates: Partial<Question>
  ) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    updateSection(sectionId, {
      questions: section.questions.map((q) =>
        q.id === questionId ? { ...q, ...updates } : q
      ),
    });
  };

  const deleteQuestion = (sectionId: string, questionId: string) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    updateSection(sectionId, {
      questions: section.questions.filter((q) => q.id !== questionId),
    });
  };

  const addFollowUpQuestion = (
    sectionId: string,
    parentQuestionId: string,
    triggerValue: string
  ) => {
    const newFollowUpQuestion: FollowUpQuestion = {
      id: crypto.randomUUID(),
      text: "Follow-up Question",
      type: "text",
      required: false,
      description: "",
      parentId: parentQuestionId,
      showWhen: {
        questionId: parentQuestionId,
        value: triggerValue,
      },
    };

    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const parentQuestion = section.questions.find(
      (q) => q.id === parentQuestionId
    );
    if (!parentQuestion) return;

    const updatedParentQuestion = {
      ...parentQuestion,
      followUpQuestions: [
        ...(parentQuestion.followUpQuestions || []),
        newFollowUpQuestion,
      ],
    };

    updateSection(sectionId, {
      questions: section.questions.map((q) =>
        q.id === parentQuestionId ? updatedParentQuestion : q
      ),
    });
  };

  const updateFollowUpQuestion = (
    sectionId: string,
    parentQuestionId: string,
    followUpQuestionId: string,
    updates: Partial<FollowUpQuestion>
  ) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const parentQuestion = section.questions.find(
      (q) => q.id === parentQuestionId
    );
    if (!parentQuestion) return;

    const updatedParentQuestion = {
      ...parentQuestion,
      followUpQuestions: (parentQuestion.followUpQuestions || []).map((fq) =>
        fq.id === followUpQuestionId ? { ...fq, ...updates } : fq
      ),
    };

    updateSection(sectionId, {
      questions: section.questions.map((q) =>
        q.id === parentQuestionId ? updatedParentQuestion : q
      ),
    });
  };

  const deleteFollowUpQuestion = (
    sectionId: string,
    parentQuestionId: string,
    followUpQuestionId: string
  ) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const parentQuestion = section.questions.find(
      (q) => q.id === parentQuestionId
    );
    if (!parentQuestion) return;

    const updatedParentQuestion = {
      ...parentQuestion,
      followUpQuestions: (parentQuestion.followUpQuestions || []).filter(
        (fq) => fq.id !== followUpQuestionId
      ),
    };

    updateSection(sectionId, {
      questions: section.questions.map((q) =>
        q.id === parentQuestionId ? updatedParentQuestion : q
      ),
    });
  };

  // Recursive function to add nested follow-up question
  const addNestedFollowUpQuestion = (
    sectionId: string,
    parentQuestionId: string,
    triggerValue: string,
    path: string[] = [] // Path to the parent question in the nested structure
  ) => {
    const newFollowUpQuestion: FollowUpQuestion = {
      id: crypto.randomUUID(),
      text: "Follow-up Question",
      type: "text",
      required: false,
      description: "",
      parentId: parentQuestionId,
      showWhen: {
        questionId: parentQuestionId,
        value: triggerValue,
      },
      followUpQuestions: [],
    };

    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) {
      console.error("Section not found:", sectionId);
      return;
    }

    // Helper function to recursively update nested follow-ups
    // The path includes the full path TO the target question (including the target itself)
    const updateNestedFollowUps = (
      questions: (Question | FollowUpQuestion)[],
      pathIndex: number = 0
    ): (Question | FollowUpQuestion)[] => {
      return questions.map((q) => {
        // Check if this is the question we're looking for in the path
        if (pathIndex < path.length && q.id === path[pathIndex]) {
          // Check if this is the last element in the path (the target question)
          if (pathIndex === path.length - 1) {
            // This is the target question, add the follow-up
            console.log(
              "Adding follow-up to question:",
              q.id,
              "at path index:",
              pathIndex
            );
            return {
              ...q,
              followUpQuestions: [
                ...(q.followUpQuestions || []),
                newFollowUpQuestion,
              ],
            };
          } else {
            // Continue traversing the path through follow-ups
            console.log(
              "Traversing through question:",
              q.id,
              "at path index:",
              pathIndex
            );
            return {
              ...q,
              followUpQuestions: updateNestedFollowUps(
                q.followUpQuestions || [],
                pathIndex + 1
              ) as FollowUpQuestion[],
            };
          }
        }

        return q;
      });
    };

    console.log("addNestedFollowUpQuestion called with:", {
      sectionId,
      parentQuestionId,
      triggerValue,
      path,
    });

    const updatedQuestions = updateNestedFollowUps(section.questions, 0);
    console.log("Updated questions:", updatedQuestions);

    updateSection(sectionId, {
      questions: updatedQuestions as Question[],
    });
  };

  // Recursive function to update nested follow-up question
  const updateNestedFollowUpQuestion = (
    sectionId: string,
    followUpQuestionId: string,
    updates: Partial<FollowUpQuestion>,
    path: string[] = [] // Path to the follow-up question
  ) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const updateInQuestions = (
      questions: (Question | FollowUpQuestion)[],
      pathIndex: number = 0
    ): (Question | FollowUpQuestion)[] => {
      return questions.map((q) => {
        if (pathIndex === path.length && q.id === followUpQuestionId) {
          return { ...q, ...updates };
        } else if (pathIndex < path.length && q.id === path[pathIndex]) {
          return {
            ...q,
            followUpQuestions: updateInQuestions(
              q.followUpQuestions || [],
              pathIndex + 1
            ) as FollowUpQuestion[],
          };
        } else if (q.followUpQuestions && q.followUpQuestions.length > 0) {
          // Search in all follow-ups recursively
          const updated = updateInQuestions(q.followUpQuestions, pathIndex);
          if (updated !== q.followUpQuestions) {
            return { ...q, followUpQuestions: updated as FollowUpQuestion[] };
          }
        }
        return q;
      });
    };

    updateSection(sectionId, {
      questions: updateInQuestions(section.questions) as Question[],
    });
  };

  // Recursive function to delete nested follow-up question
  const deleteNestedFollowUpQuestion = (
    sectionId: string,
    followUpQuestionId: string,
    path: string[] = [] // Path to the parent of the follow-up question
  ) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const deleteInQuestions = (
      questions: (Question | FollowUpQuestion)[],
      pathIndex: number = 0
    ): (Question | FollowUpQuestion)[] => {
      return questions.map((q) => {
        if (pathIndex === path.length) {
          // At the parent level, filter out the target follow-up
          return {
            ...q,
            followUpQuestions: (q.followUpQuestions || []).filter(
              (fq) => fq.id !== followUpQuestionId
            ),
          };
        } else if (pathIndex < path.length && q.id === path[pathIndex]) {
          return {
            ...q,
            followUpQuestions: deleteInQuestions(
              q.followUpQuestions || [],
              pathIndex + 1
            ) as FollowUpQuestion[],
          };
        } else if (q.followUpQuestions && q.followUpQuestions.length > 0) {
          const updated = deleteInQuestions(q.followUpQuestions, pathIndex);
          if (updated !== q.followUpQuestions) {
            return { ...q, followUpQuestions: updated as FollowUpQuestion[] };
          }
        }
        return q;
      });
    };

    updateSection(sectionId, {
      questions: deleteInQuestions(section.questions) as Question[],
    });
  };

  const addOption = (sectionId: string, questionId: string) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const question = section.questions.find((q) => q.id === questionId);
    if (!question) return;

    updateQuestion(sectionId, questionId, {
      options: [...(question.options || []), ""],
    });
  };

  const updateOption = (
    sectionId: string,
    questionId: string,
    optionIndex: number,
    value: string
  ) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const question = section.questions.find((q) => q.id === questionId);
    if (!question || !question.options) return;

    const updatedOptions = [...question.options];
    updatedOptions[optionIndex] = value;

    updateQuestion(sectionId, questionId, {
      options: updatedOptions.filter((opt) => opt.trim() !== ""),
    });
  };

  const removeOption = (
    sectionId: string,
    questionId: string,
    optionIndex: number
  ) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const question = section.questions.find((q) => q.id === questionId);
    if (!question || !question.options) return;

    updateQuestion(sectionId, questionId, {
      options: question.options.filter((_, i) => i !== optionIndex),
    });
  };

  const addFollowUpOption = (
    sectionId: string,
    parentQuestionId: string,
    followUpQuestionId: string
  ) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const parentQuestion = section.questions.find(
      (q) => q.id === parentQuestionId
    );
    if (!parentQuestion) return;

    const followUpQ = parentQuestion.followUpQuestions?.find(
      (fq) => fq.id === followUpQuestionId
    );
    if (!followUpQ) return;

    const updatedFollowUpQ = {
      ...followUpQ,
      options: [...(followUpQ.options || []), ""],
    };

    updateFollowUpQuestion(
      sectionId,
      parentQuestionId,
      followUpQuestionId,
      updatedFollowUpQ
    );
  };

  const updateFollowUpOption = (
    sectionId: string,
    parentQuestionId: string,
    followUpQuestionId: string,
    optionIndex: number,
    value: string
  ) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const parentQuestion = section.questions.find(
      (q) => q.id === parentQuestionId
    );
    if (!parentQuestion) return;

    const followUpQ = parentQuestion.followUpQuestions?.find(
      (fq) => fq.id === followUpQuestionId
    );
    if (!followUpQ || !followUpQ.options) return;

    const updatedOptions = [...followUpQ.options];
    updatedOptions[optionIndex] = value;

    updateFollowUpQuestion(sectionId, parentQuestionId, followUpQuestionId, {
      options: updatedOptions.filter((opt) => opt.trim() !== ""),
    });
  };

  const removeFollowUpOption = (
    sectionId: string,
    parentQuestionId: string,
    followUpQuestionId: string,
    optionIndex: number
  ) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const parentQuestion = section.questions.find(
      (q) => q.id === parentQuestionId
    );
    if (!parentQuestion) return;

    const followUpQ = parentQuestion.followUpQuestions?.find(
      (fq) => fq.id === followUpQuestionId
    );
    if (!followUpQ || !followUpQ.options) return;

    updateFollowUpQuestion(sectionId, parentQuestionId, followUpQuestionId, {
      options: followUpQ.options.filter((_, i) => i !== optionIndex),
    });
  };

  // Recursive functions for nested follow-up options
  const addNestedFollowUpOption = (
    sectionId: string,
    followUpQuestionId: string,
    path: string[] = []
  ) => {
    updateNestedFollowUpQuestion(
      sectionId,
      followUpQuestionId,
      {
        options: [
          ...((path.length > 0
            ? findNestedQuestion(sectionId, followUpQuestionId, path)?.options
            : null) || []),
          "",
        ],
      },
      path
    );
  };

  const updateNestedFollowUpOption = (
    sectionId: string,
    followUpQuestionId: string,
    optionIndex: number,
    value: string,
    path: string[] = []
  ) => {
    const question = findNestedQuestion(sectionId, followUpQuestionId, path);
    if (!question || !question.options) return;

    const updatedOptions = [...question.options];
    updatedOptions[optionIndex] = value;

    updateNestedFollowUpQuestion(
      sectionId,
      followUpQuestionId,
      {
        options: updatedOptions.filter((opt) => opt.trim() !== ""),
      },
      path
    );
  };

  const removeNestedFollowUpOption = (
    sectionId: string,
    followUpQuestionId: string,
    optionIndex: number,
    path: string[] = []
  ) => {
    const question = findNestedQuestion(sectionId, followUpQuestionId, path);
    if (!question || !question.options) return;

    updateNestedFollowUpQuestion(
      sectionId,
      followUpQuestionId,
      {
        options: question.options.filter((_, i) => i !== optionIndex),
      },
      path
    );
  };

  // Helper function to find a nested question by path
  const findNestedQuestion = (
    sectionId: string,
    questionId: string,
    path: string[] = []
  ): Question | FollowUpQuestion | null => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return null;

    const searchInQuestions = (
      questions: (Question | FollowUpQuestion)[],
      pathIndex: number = 0
    ): Question | FollowUpQuestion | null => {
      for (const q of questions) {
        if (pathIndex === path.length && q.id === questionId) {
          return q;
        } else if (pathIndex < path.length && q.id === path[pathIndex]) {
          return searchInQuestions(q.followUpQuestions || [], pathIndex + 1);
        } else if (q.followUpQuestions && q.followUpQuestions.length > 0) {
          const found = searchInQuestions(q.followUpQuestions, pathIndex);
          if (found) return found;
        }
      }
      return null;
    };

    return searchInQuestions(section.questions);
  };

  // Helper function to check if a question type requires follow-ups
  const requiresFollowUp = (type: string): boolean => {
    return ["radio", "checkbox", "select", "search-select"].includes(type);
  };

  const questionTypes = [
    {
      value: "text",
      label: "Short Text",
      description: "Single line text input",
    },
    {
      value: "textarea",
      label: "Long Text",
      description: "Multi-line text area",
    },
    {
      value: "radio",
      label: "Multiple Choice",
      description: "Select one option from many",
    },
    {
      value: "checkbox",
      label: "Checkboxes",
      description: "Select multiple options",
    },
    {
      value: "select",
      label: "Dropdown",
      description: "Choose from dropdown list",
    },
    { value: "email", label: "Email", description: "Email address input" },
    { value: "number", label: "Number", description: "Numeric input only" },
    { value: "date", label: "Date", description: "Date picker" },
    {
      value: "file",
      label: "File Upload",
      description: "Upload files/documents",
    },
  ];

  if (mode === "list") {
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary-800">
                Service Request Management
              </h1>
              <p className="text-primary-600">
                Create, edit, and manage service request forms
              </p>
            </div>
            <button
              onClick={handleCreateForm}
              className="btn-primary mt-4 sm:mt-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Service Form
            </button>
          </div>
        </div>

        {forms.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-neutral-200">
            <FileText className="w-12 h-12 text-primary-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-primary-600 mb-2">
              No service forms created yet
            </h3>
            <p className="text-primary-500 mb-6">
              Create your first service form to get started
            </p>
            <button onClick={handleCreateForm} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Form
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forms.map((form: any) => (
              <div
                key={form.id}
                className="bg-white rounded-lg border border-neutral-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-medium text-primary-800 mb-2 line-clamp-2">
                      {form.title}
                    </h3>
                    <p className="text-sm text-primary-600 line-clamp-2">
                      {form.description}
                    </p>
                  </div>
                  <div className="relative ml-2">
                    <button className="p-1 hover:bg-neutral-100 rounded">
                      <MoreVertical className="w-4 h-4 text-primary-400" />
                    </button>
                  </div>
                </div>

                {/* Form Stats */}
                <div className="flex items-center justify-between text-xs text-primary-500 mb-4">
                  <div className="flex items-center">
                    <Users className="w-3 h-3 mr-1" />0 responses
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {new Date().toLocaleDateString()}
                  </div>
                </div>

                {/* Visibility Status */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      form.isVisible
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {form.isVisible ? "Public" : "Private"}
                  </span>
                  <button
                    onClick={() =>
                      handleToggleVisibility(form.id, form.isVisible)
                    }
                    className="text-xs text-primary-600 hover:text-primary-800"
                  >
                    Toggle
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePreviewForm(form.id)}
                      className="px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg transition-colors hover:bg-primary-700"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEditForm(form.id)}
                      className="p-2 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Edit form"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleViewResponses(form.id)}
                      className="p-2 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
                      title="View responses"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDuplicate(form)}
                      className="p-2 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Duplicate form"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(form.id, form.title)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete form"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={() => navigate("/forms/management")}
            className="p-2 hover:bg-neutral-100 rounded-lg mr-4"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-primary-800">
              {id ? "Edit Form" : "Create New Form"}
            </h1>
            <p className="text-primary-600">Build your custom form</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => navigate("/forms/management")}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            <Save className="w-4 h-4 mr-2" />
            Save Form
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Form Details */}
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <h2 className="text-lg font-medium text-primary-800 mb-4">
              Form Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Form Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="input-field"
                  placeholder="Enter form title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-2">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Describe your form purpose"
                />
              </div>

              {/* Tenant Selector for SuperAdmin */}
              {user?.role === "superadmin" && (
                <div>
                  <label className="block text-sm font-medium text-primary-700 mb-2">
                    Tenant *{" "}
                    <span className="text-xs text-primary-500">
                      (SuperAdmin Only)
                    </span>
                  </label>
                  <select
                    value={selectedTenantId}
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="">Select a tenant...</option>
                    {tenants.map((tenant) => (
                      <option key={tenant._id} value={tenant._id}>
                        {tenant.name} ({tenant.companyName})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-primary-500">
                    Select which tenant this form belongs to
                  </p>
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isVisible"
                  checked={form.isVisible}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isVisible: e.target.checked,
                    }))
                  }
                  className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
                <label
                  htmlFor="isVisible"
                  className="ml-2 text-sm text-primary-700"
                >
                  Make form publicly visible
                </label>
              </div>

              {/* Load Demo Data Button */}
              <div className="pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={loadDemoData}
                  className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <FileText className="w-4 h-4" />
                  Load Demo Data (For Testing)
                </button>
                <p className="mt-2 text-xs text-center text-primary-500">
                  Loads a complete form with follow-up questions for testing
                </p>
              </div>
            </div>
          </div>

          {/* Sections */}
          {form.sections.map((section, sectionIndex) => (
            <div
              key={section.id}
              className="bg-white rounded-lg border border-neutral-200 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-primary-800">
                  Section {sectionIndex + 1}
                </h3>
                {form.sections.length > 1 && (
                  <button
                    onClick={() => deleteSection(section.id)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-primary-700 mb-2">
                    Section Title
                  </label>
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) =>
                      updateSection(section.id, { title: e.target.value })
                    }
                    className="input-field"
                    placeholder="Enter section title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-700 mb-2">
                    Section Description
                  </label>
                  <textarea
                    value={section.description}
                    onChange={(e) =>
                      updateSection(section.id, {
                        description: e.target.value,
                      })
                    }
                    className="input-field resize-none"
                    rows={2}
                    placeholder="Brief description of this section"
                  />
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-4">
                <h4 className="font-medium text-primary-700">Questions</h4>

                {section.questions.map((question, questionIndex) => (
                  <div
                    key={question.id}
                    className="border border-neutral-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-primary-600">
                        Question {questionIndex + 1}
                      </span>
                      <button
                        onClick={() => deleteQuestion(section.id, question.id)}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-primary-600 mb-1">
                          Question Title
                        </label>
                        <input
                          type="text"
                          value={question.text}
                          onChange={(e) =>
                            updateQuestion(section.id, question.id, {
                              text: e.target.value,
                            })
                          }
                          className="input-field text-sm"
                          placeholder="Enter question text"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-primary-600 mb-1">
                          Question Type
                        </label>
                        <select
                          value={question.type}
                          onChange={(e) =>
                            updateQuestion(section.id, question.id, {
                              type: e.target.value,
                            })
                          }
                          className="input-field text-sm"
                        >
                          {questionTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={question.required}
                          onChange={(e) =>
                            updateQuestion(section.id, question.id, {
                              required: e.target.checked,
                            })
                          }
                          className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="ml-2 text-xs text-primary-700">
                          Required
                        </span>
                      </label>
                    </div>

                    {(question.type === "radio" ||
                      question.type === "checkbox" ||
                      question.type === "select") && (
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-primary-600 mb-2">
                          Options
                        </label>
                        <div className="space-y-2">
                          {(question.options || []).map((option, index) => (
                            <div
                              key={index}
                              className="flex items-center space-x-2"
                            >
                              <input
                                type="text"
                                value={option}
                                onChange={(e) =>
                                  updateOption(
                                    section.id,
                                    question.id,
                                    index,
                                    e.target.value
                                  )
                                }
                                className="flex-1 p-2 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder={`Option ${index + 1}`}
                              />
                              <button
                                onClick={() =>
                                  removeOption(section.id, question.id, index)
                                }
                                className="p-1 text-red-500 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addOption(section.id, question.id)}
                            className="flex items-center text-primary-600 hover:text-primary-800 text-sm"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Option
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Follow-up Questions Section - Now with Unlimited Nesting */}
                    {requiresFollowUp(question.type) &&
                      question.options &&
                      question.options.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <h5 className="text-xs font-medium text-blue-800 mb-3">
                            Follow-up Questions (Unlimited Nesting)
                          </h5>

                          {/* Render nested follow-up questions using the recursive component */}
                          {question.followUpQuestions &&
                            question.followUpQuestions.length > 0 && (
                              <NestedFollowUpRenderer
                                followUpQuestions={question.followUpQuestions}
                                sectionId={section.id}
                                parentQuestion={{
                                  id: question.id,
                                  options: question.options,
                                }}
                                path={[question.id]}
                                onUpdate={(sId, fqId, updates, path) => {
                                  if (path.length === 1) {
                                    // First level follow-up
                                    updateFollowUpQuestion(
                                      sId,
                                      path[0],
                                      fqId,
                                      updates
                                    );
                                  } else {
                                    // Nested follow-up
                                    updateNestedFollowUpQuestion(
                                      sId,
                                      fqId,
                                      updates,
                                      path
                                    );
                                  }
                                }}
                                onDelete={(sId, fqId, path) => {
                                  if (path.length === 1) {
                                    // First level follow-up
                                    deleteFollowUpQuestion(sId, path[0], fqId);
                                  } else {
                                    // Nested follow-up
                                    deleteNestedFollowUpQuestion(
                                      sId,
                                      fqId,
                                      path
                                    );
                                  }
                                }}
                                onAddNested={addNestedFollowUpQuestion}
                                onAddOption={(sId, fqId, path) => {
                                  if (path.length === 1) {
                                    // First level follow-up
                                    addFollowUpOption(sId, path[0], fqId);
                                  } else {
                                    // Nested follow-up
                                    addNestedFollowUpOption(sId, fqId, path);
                                  }
                                }}
                                onUpdateOption={(
                                  sId,
                                  fqId,
                                  optIndex,
                                  value,
                                  path
                                ) => {
                                  if (path.length === 1) {
                                    // First level follow-up
                                    updateFollowUpOption(
                                      sId,
                                      path[0],
                                      fqId,
                                      optIndex,
                                      value
                                    );
                                  } else {
                                    // Nested follow-up
                                    updateNestedFollowUpOption(
                                      sId,
                                      fqId,
                                      optIndex,
                                      value,
                                      path
                                    );
                                  }
                                }}
                                onRemoveOption={(sId, fqId, optIndex, path) => {
                                  if (path.length === 1) {
                                    // First level follow-up
                                    removeFollowUpOption(
                                      sId,
                                      path[0],
                                      fqId,
                                      optIndex
                                    );
                                  } else {
                                    // Nested follow-up
                                    removeNestedFollowUpOption(
                                      sId,
                                      fqId,
                                      optIndex,
                                      path
                                    );
                                  }
                                }}
                                questionTypes={questionTypes}
                                depth={0}
                              />
                            )}

                          {/* Add first-level follow-up buttons */}
                          <div className="space-y-2 mt-3">
                            {question.options?.map((option, optIndex) => (
                              <button
                                key={optIndex}
                                onClick={() =>
                                  addFollowUpQuestion(
                                    section.id,
                                    question.id,
                                    option
                                  )
                                }
                                className="w-full p-2 text-xs border border-blue-300 rounded text-blue-600 hover:bg-blue-100 transition-colors"
                              >
                                Add follow-up for "{option}"
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ))}

                <button
                  onClick={() => addQuestion(section.id)}
                  className="w-full p-3 border-2 border-dashed border-neutral-300 rounded-lg text-primary-600 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <Plus className="w-4 h-4 mx-auto mb-1" />
                  Add Question
                </button>
              </div>
            </div>
          ))}

          {/* Add Section Button */}
          <button
            onClick={addSection}
            className="w-full p-4 border-2 border-dashed border-neutral-300 rounded-lg text-primary-600 hover:border-primary-300 hover:bg-primary-50 transition-colors"
          >
            <Plus className="w-5 h-5 mx-auto mb-2" />
            Add New Section
          </button>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <h3 className="font-medium text-primary-800 mb-4">Form Preview</h3>
            <p className="text-sm text-primary-600 mb-4">
              See how your form will appear to users
            </p>
            <button
              className="w-full btn-secondary"
              onClick={() => setShowPreview(true)}
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview Form
            </button>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <h3 className="font-medium text-primary-800 mb-4">
              Form Statistics
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-primary-600">Sections:</span>
                <span className="font-medium">{form.sections.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-600">Questions:</span>
                <span className="font-medium">
                  {form.sections.reduce(
                    (total, section) => total + section.questions.length,
                    0
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-600">Follow-ups:</span>
                <span className="font-medium">
                  {form.sections.reduce(
                    (total, section) =>
                      total +
                      section.questions.reduce(
                        (qTotal, q) =>
                          qTotal + (q.followUpQuestions?.length || 0),
                        0
                      ),
                    0
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-600">Visibility:</span>
                <span
                  className={`font-medium ${
                    form.isVisible ? "text-green-600" : "text-yellow-600"
                  }`}
                >
                  {form.isVisible ? "Public" : "Private"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary-800">
                Form Preview
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-neutral-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-primary-800 mb-2">
                  {form.title || "Untitled Form"}
                </h1>
                <p className="text-primary-600">
                  {form.description || "No description provided"}
                </p>
              </div>

              {form.sections.map((section, sectionIndex) => (
                <div key={section.id} className="mb-8">
                  <div className="border-l-4 border-primary-500 pl-4 mb-4">
                    <h2 className="text-xl font-semibold text-primary-700 mb-2">
                      {section.title}
                    </h2>
                    {section.description && (
                      <p className="text-primary-600">{section.description}</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    {section.questions
                      .filter((q) => !q.showWhen)
                      .map((question, questionIndex) => (
                        <div
                          key={question.id}
                          className="bg-neutral-50 p-4 rounded-lg"
                        >
                          <label className="block text-sm font-medium text-primary-700 mb-2">
                            {question.text}
                            {question.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </label>

                          {question.description && (
                            <p className="text-sm text-primary-600 mb-3">
                              {question.description}
                            </p>
                          )}

                          {/* Render different input types */}
                          {question.type === "text" && (
                            <input
                              type="text"
                              className="w-full p-2 border border-neutral-300 rounded-md"
                              placeholder="Your answer"
                              disabled
                            />
                          )}

                          {question.type === "textarea" && (
                            <textarea
                              className="w-full p-2 border border-neutral-300 rounded-md"
                              rows={3}
                              placeholder="Your answer"
                              disabled
                            />
                          )}

                          {question.type === "email" && (
                            <input
                              type="email"
                              className="w-full p-2 border border-neutral-300 rounded-md"
                              placeholder="your.email@example.com"
                              disabled
                            />
                          )}

                          {question.type === "number" && (
                            <input
                              type="number"
                              className="w-full p-2 border border-neutral-300 rounded-md"
                              placeholder="0"
                              disabled
                            />
                          )}

                          {question.type === "date" && (
                            <input
                              type="date"
                              className="w-full p-2 border border-neutral-300 rounded-md"
                              disabled
                            />
                          )}

                          {question.type === "radio" && question.options && (
                            <div className="space-y-2">
                              {question.options.map((option, optionIndex) => (
                                <label
                                  key={optionIndex}
                                  className="flex items-center"
                                >
                                  <input
                                    type="radio"
                                    name={`question-${question.id}`}
                                    className="mr-2"
                                    disabled
                                  />
                                  <span className="text-sm text-primary-700">
                                    {option}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}

                          {question.type === "checkbox" && question.options && (
                            <div className="space-y-2">
                              {question.options.map((option, optionIndex) => (
                                <label
                                  key={optionIndex}
                                  className="flex items-center"
                                >
                                  <input
                                    type="checkbox"
                                    className="mr-2"
                                    disabled
                                  />
                                  <span className="text-sm text-primary-700">
                                    {option}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}

                          {question.type === "select" && question.options && (
                            <select
                              className="w-full p-2 border border-neutral-300 rounded-md"
                              disabled
                            >
                              <option>Select an option</option>
                              {question.options.map((option, optionIndex) => (
                                <option key={optionIndex} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          )}

                          {question.type === "file" && (
                            <input
                              type="file"
                              className="w-full p-2 border border-neutral-300 rounded-md"
                              disabled
                            />
                          )}

                          {/* Show follow-up questions in preview (recursively) */}
                          {(() => {
                            const renderFollowUps = (
                              parentId: string,
                              depth: number = 0
                            ): JSX.Element | null => {
                              const followUps = section.questions.filter(
                                (q) =>
                                  q.showWhen &&
                                  q.showWhen.questionId === parentId
                              );

                              if (followUps.length === 0) return null;

                              return (
                                <div
                                  className={`mt-4 ${
                                    depth === 0 ? "pl-6" : "pl-4"
                                  } border-l-2 border-blue-${Math.min(
                                    200 + depth * 100,
                                    500
                                  )}`}
                                >
                                  {depth === 0 && (
                                    <p className="text-xs text-blue-600 mb-2 font-medium">
                                      Follow-up questions (conditional):
                                    </p>
                                  )}
                                  {followUps.map((followUpQ) => {
                                    const parentQuestion =
                                      section.questions.find(
                                        (q) => q.id === parentId
                                      );
                                    return (
                                      <div
                                        key={followUpQ.id}
                                        className="mb-3 p-2 bg-blue-50 rounded"
                                      >
                                        <p className="text-xs text-blue-500 mb-1">
                                          Shows when "{parentQuestion?.text}" =
                                          "{followUpQ.showWhen?.value}"
                                        </p>
                                        <label className="block text-xs font-medium text-blue-700 mb-1">
                                          {followUpQ.text}
                                          {followUpQ.required && (
                                            <span className="text-red-500 ml-1">
                                              *
                                            </span>
                                          )}
                                        </label>

                                        {followUpQ.type === "text" && (
                                          <input
                                            type="text"
                                            className="w-full p-1 text-xs border border-blue-300 rounded"
                                            placeholder="Follow-up answer"
                                            disabled
                                          />
                                        )}

                                        {followUpQ.type === "textarea" && (
                                          <textarea
                                            className="w-full p-1 text-xs border border-blue-300 rounded"
                                            rows={2}
                                            placeholder="Follow-up answer"
                                            disabled
                                          />
                                        )}

                                        {followUpQ.type === "radio" &&
                                          followUpQ.options && (
                                            <div className="space-y-1">
                                              {followUpQ.options.map(
                                                (option, optIndex) => (
                                                  <label
                                                    key={optIndex}
                                                    className="flex items-center"
                                                  >
                                                    <input
                                                      type="radio"
                                                      name={`followup-${followUpQ.id}`}
                                                      className="mr-1"
                                                      disabled
                                                    />
                                                    <span className="text-xs text-blue-700">
                                                      {option}
                                                    </span>
                                                  </label>
                                                )
                                              )}
                                            </div>
                                          )}

                                        {followUpQ.type === "checkbox" &&
                                          followUpQ.options && (
                                            <div className="space-y-1">
                                              {followUpQ.options.map(
                                                (option, optIndex) => (
                                                  <label
                                                    key={optIndex}
                                                    className="flex items-center"
                                                  >
                                                    <input
                                                      type="checkbox"
                                                      className="mr-1"
                                                      disabled
                                                    />
                                                    <span className="text-xs text-blue-700">
                                                      {option}
                                                    </span>
                                                  </label>
                                                )
                                              )}
                                            </div>
                                          )}

                                        {followUpQ.type === "select" &&
                                          followUpQ.options && (
                                            <select
                                              className="w-full p-1 text-xs border border-blue-300 rounded"
                                              disabled
                                            >
                                              <option>Select an option</option>
                                              {followUpQ.options.map(
                                                (option, optIndex) => (
                                                  <option
                                                    key={optIndex}
                                                    value={option}
                                                  >
                                                    {option}
                                                  </option>
                                                )
                                              )}
                                            </select>
                                          )}

                                        {/* Recursively render nested follow-ups */}
                                        {renderFollowUps(
                                          followUpQ.id,
                                          depth + 1
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            };

                            return renderFollowUps(question.id);
                          })()}
                        </div>
                      ))}
                  </div>
                </div>
              ))}

              <div className="pt-6 border-t">
                <button className="btn-primary" disabled>
                  Submit Form (Preview Mode)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
