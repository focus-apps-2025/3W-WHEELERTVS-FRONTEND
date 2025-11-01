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
  ChevronUp,
  ChevronDown,
  Clipboard,
  Link as LinkIcon,
} from "lucide-react";
import { apiClient } from "../api/client";
import { questionsApi } from "../api/storage";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { NestedFollowUpRenderer } from "./NestedFollowUpRenderer";
import ChildFormsManager from "./forms/ChildFormsManager";
import { SectionBranchingConfig } from "./forms/SectionBranchingConfig";
import { FormRoutingConfig } from "./forms/FormRoutingConfig";
import PreviewForm from "./PreviewForm";

interface FormSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  parentSectionId?: string; // For subsections
  isSubsection?: boolean; // Mark if this is a subsection
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
  correctAnswer?: string;
  followUpConfig?: Record<
    string,
    {
      hasFollowUp: boolean;
      required: boolean;
      linkedFormId?: string;
    }
  >;
  branchingRules?: Array<{
    optionLabel: string;
    targetSectionId: string;
    isOtherOption?: boolean;
  }>;
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
  correctAnswer?: string;
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
  const [currentPage, setCurrentPage] = useState<number>(0); // For multi-page navigation
  const [openOptionMenu, setOpenOptionMenu] = useState<string | null>(null); // Track which option's menu is open
  const [showSectionSelector, setShowSectionSelector] = useState(false); // Show modal for selecting a section
  const [pendingSectionLink, setPendingSectionLink] = useState<{
    sectionId: string;
    parentQuestionId: string;
    triggerValue: string;
    path: string[];
  } | null>(null);
  const [showFormSelector, setShowFormSelector] = useState(false); // Show modal for selecting a form
  const [pendingFormLink, setPendingFormLink] = useState<{
    sectionId: string;
    parentQuestionId: string;
    triggerValue: string;
    path: string[];
  } | null>(null);
  const [showBranchingConfig, setShowBranchingConfig] = useState(false);
  const [branchingConfigQuestion, setBranchingConfigQuestion] = useState<{
    questionId: string;
    sectionId: string;
    options: string[];
  } | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    isVisible: true,
    locationEnabled: true,
    sections: [
      {
        id: crypto.randomUUID(),
        title: "Section 1",
        description: "",
        questions: [],
      },
    ] as FormSection[],
  });
  const [formSectionBranching, setFormSectionBranching] = useState<any[]>([]);
  const [showFormRoutingConfig, setShowFormRoutingConfig] = useState(false);
  const [formRoutingConfigQuestion, setFormRoutingConfigQuestion] = useState<{
    questionId: string;
    sectionId: string;
    options: string[];
  } | null>(null);
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
    const loadForms = async () => {
      try {
        const response = await apiClient.getForms();
        setForms(response.forms || []);
      } catch (error) {
        console.error("Failed to fetch forms:", error);
        setForms([]);
      }
    };
    loadForms();

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
            locationEnabled: backendForm.locationEnabled !== false,
            sections: sectionsWithNestedFollowUps,
            followUpQuestions: backendForm.followUpQuestions || [],
          });

          // Load branching rules for the form
          if (backendForm.sectionBranching) {
            setFormSectionBranching(backendForm.sectionBranching);
            console.log(
              "Branching rules loaded from form:",
              backendForm.sectionBranching
            );
          }
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
          locationEnabled: true,
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

        // Save branching rules if any exist
        if (formSectionBranching.length > 0) {
          console.log("Saving branching rules:", formSectionBranching);
          await apiClient.request(`/forms/${id}/section-branching`, {
            method: "POST",
            body: JSON.stringify({ rules: formSectionBranching }),
          });
          console.log("Branching rules saved successfully");
        }

        showSuccess("Form updated successfully", "Success");
        navigate("/forms/management");
      } else {
        // Create new form
        console.log("Creating new form...");
        const response = await apiClient.createForm(formToSave);
        console.log("Form created successfully:", response);
        const newFormId = response.form._id;

        // Save branching rules if any exist
        if (formSectionBranching.length > 0) {
          console.log(
            "Saving branching rules for new form:",
            formSectionBranching
          );
          await apiClient.request(`/forms/${newFormId}/section-branching`, {
            method: "POST",
            body: JSON.stringify({ rules: formSectionBranching }),
          });
          console.log("Branching rules saved successfully");
        }

        showSuccess("Form created successfully", "Success");
        setMode("list");
        // Refresh forms list from backend
        const formsResponse = await apiClient.getForms();
        setForms(formsResponse.forms || []);
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
      async () => {
        try {
          await apiClient.deleteForm(id);
          const formsResponse = await apiClient.getForms();
          setForms(formsResponse.forms || []);
          showSuccess("Form deleted successfully", "Success");
        } catch (error) {
          console.error("Failed to delete form:", error);
          showError("Failed to delete form", "Error");
        }
      },
      "Delete Form",
      "Delete",
      "Cancel"
    );
  };

  const handleDuplicate = async (form: any) => {
    try {
      await apiClient.duplicateForm(form._id);
      const formsResponse = await apiClient.getForms();
      setForms(formsResponse.forms || []);
      showSuccess("Form duplicated successfully", "Success");
    } catch (error) {
      console.error("Failed to duplicate form:", error);
      showError("Failed to duplicate form", "Error");
    }
  };

  const handleToggleVisibility = async (
    id: string,
    currentVisibility: boolean
  ) => {
    try {
      await apiClient.updateFormVisibility(id, !currentVisibility);
      const formsResponse = await apiClient.getForms();
      setForms(formsResponse.forms || []);
      showSuccess("Form visibility updated", "Success");
    } catch (error) {
      console.error("Failed to update form visibility:", error);
      showError("Failed to update form visibility", "Error");
    }
  };

  const handleCreateForm = () => {
    setMode("create");
    setForm({
      title: "",
      description: "",
      isVisible: true,
      locationEnabled: true,
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
      locationEnabled: true,
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
          isSubsection: false,
        },
      ],
    }));
  };

  const addSubsection = (parentSectionId: string) => {
    const parentIndex = form.sections.findIndex(
      (s) => s.id === parentSectionId
    );
    if (parentIndex === -1) return;

    // Count existing subsections for this parent
    const existingSubsections = form.sections.filter(
      (s) => s.parentSectionId === parentSectionId
    );

    const newSubsection: FormSection = {
      id: crypto.randomUUID(),
      title: `Subsection ${existingSubsections.length + 1}`,
      description: "",
      questions: [],
      isSubsection: true,
      parentSectionId: parentSectionId,
    };

    // Insert subsection after parent and its existing subsections
    const insertIndex = parentIndex + existingSubsections.length + 1;
    const updatedSections = [...form.sections];
    updatedSections.splice(insertIndex, 0, newSubsection);

    setForm((prev) => ({
      ...prev,
      sections: updatedSections,
    }));
  };

  // Group sections into pages (main sections = pages, subsections = same page as parent)
  const getPagesFromSections = (): FormSection[][] => {
    const pages: FormSection[][] = [];

    form.sections.forEach((section) => {
      if (!section.isSubsection) {
        // This is a main section, start a new page
        const subsections = form.sections.filter(
          (s) => s.parentSectionId === section.id
        );
        pages.push([section, ...subsections]);
      }
    });

    return pages;
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

  // Insert question at specific position
  const insertQuestionAt = (sectionId: string, index: number) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const newQuestion: Question = {
      id: crypto.randomUUID(),
      text: "New Question",
      type: "text",
      required: false,
      description: "",
    };

    const questions = [...section.questions];
    questions.splice(index, 0, newQuestion);

    updateSection(sectionId, { questions });
  };

  // Duplicate question
  const duplicateQuestion = (sectionId: string, questionId: string) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const question = section.questions.find((q) => q.id === questionId);
    if (!question) return;

    // Deep clone the question with new IDs
    const duplicateQuestionRecursive = (
      q: Question | FollowUpQuestion
    ): Question | FollowUpQuestion => {
      return {
        ...q,
        id: crypto.randomUUID(),
        followUpQuestions: q.followUpQuestions?.map(
          (fq) =>
            ({
              ...duplicateQuestionRecursive(fq),
              parentId: crypto.randomUUID(), // Will be updated later
            } as FollowUpQuestion)
        ),
      };
    };

    const duplicatedQuestion = duplicateQuestionRecursive(question) as Question;

    const questionIndex = section.questions.findIndex(
      (q) => q.id === questionId
    );
    const questions = [...section.questions];
    questions.splice(questionIndex + 1, 0, duplicatedQuestion);

    updateSection(sectionId, { questions });
    showSuccess("Question duplicated successfully", "Success");
  };

  // Move question up
  const moveQuestionUp = (sectionId: string, questionId: string) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const questionIndex = section.questions.findIndex(
      (q) => q.id === questionId
    );
    if (questionIndex <= 0) return; // Already at top

    const questions = [...section.questions];
    [questions[questionIndex - 1], questions[questionIndex]] = [
      questions[questionIndex],
      questions[questionIndex - 1],
    ];

    updateSection(sectionId, { questions });
  };

  // Move question down
  const moveQuestionDown = (sectionId: string, questionId: string) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const questionIndex = section.questions.findIndex(
      (q) => q.id === questionId
    );
    if (questionIndex === -1 || questionIndex >= section.questions.length - 1)
      return; // Already at bottom

    const questions = [...section.questions];
    [questions[questionIndex], questions[questionIndex + 1]] = [
      questions[questionIndex + 1],
      questions[questionIndex],
    ];

    updateSection(sectionId, { questions });
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

  const openBranchingConfig = (
    sectionId: string,
    questionId: string,
    options: string[]
  ) => {
    setBranchingConfigQuestion({ questionId, sectionId, options });
    setShowBranchingConfig(true);
  };

  const openFormRoutingConfig = (
    sectionId: string,
    questionId: string,
    options: string[]
  ) => {
    setFormRoutingConfigQuestion({ questionId, sectionId, options });
    setShowFormRoutingConfig(true);
  };

  const handleSaveBranchingRules = (rules: any[]) => {
    if (!branchingConfigQuestion) return;

    const section = form.sections.find(
      (s) => s.id === branchingConfigQuestion.sectionId
    );
    if (!section) return;

    const question = section.questions.find(
      (q) => q.id === branchingConfigQuestion.questionId
    );
    if (!question) return;

    const branchingRules = rules.map((rule) => ({
      optionLabel: rule.optionLabel,
      targetSectionId: rule.targetSectionId,
      isOtherOption: rule.isOtherOption || false,
    }));

    const updatedQuestion = {
      ...question,
      branchingRules: branchingRules,
    };

    updateSection(branchingConfigQuestion.sectionId, {
      questions: section.questions.map((q) =>
        q.id === branchingConfigQuestion.questionId ? updatedQuestion : q
      ),
    });

    // Update formSectionBranching state with complete rule structure for API
    const apiRules = rules.map((rule) => ({
      questionId: branchingConfigQuestion.questionId,
      sectionId: branchingConfigQuestion.sectionId,
      optionLabel: rule.optionLabel,
      targetSectionId: rule.targetSectionId,
      isOtherOption: rule.isOtherOption || false,
    }));

    // Remove old rules for this question and add new ones
    const updatedBranching = formSectionBranching.filter(
      (r) =>
        !(
          r.questionId === branchingConfigQuestion.questionId &&
          r.sectionId === branchingConfigQuestion.sectionId
        )
    );
    setFormSectionBranching([...updatedBranching, ...apiRules]);
    console.log("Branching rules updated:", [...updatedBranching, ...apiRules]);

    setShowBranchingConfig(false);
    setBranchingConfigQuestion(null);
    showSuccess("Section routing configured successfully");
  };

  const handleSaveFormRoutingConfig = (
    config: Record<string, { linkedFormId: string }>
  ) => {
    if (!formRoutingConfigQuestion) return;

    const section = form.sections.find(
      (s) => s.id === formRoutingConfigQuestion.sectionId
    );
    if (!section) return;

    const question = section.questions.find(
      (q) => q.id === formRoutingConfigQuestion.questionId
    );
    if (!question) return;

    const updatedQuestion = {
      ...question,
      followUpConfig: {
        ...(question.followUpConfig || {}),
        ...config,
      },
    };

    updateSection(formRoutingConfigQuestion.sectionId, {
      questions: section.questions.map((q) =>
        q.id === formRoutingConfigQuestion.questionId ? updatedQuestion : q
      ),
    });

    setShowFormRoutingConfig(false);
    setFormRoutingConfigQuestion(null);
    showSuccess("Follow-up form routing configured successfully");
  };

  const linkFollowUpSection = (
    sectionId: string,
    parentQuestionId: string,
    option: string
  ) => {
    // Show section selector modal
    setPendingSectionLink({
      sectionId,
      parentQuestionId,
      triggerValue: option,
      path: [],
    });
    setShowSectionSelector(true);
  };

  const linkFollowUpForm = (
    sectionId: string,
    parentQuestionId: string,
    option: string,
    linkedFormId?: string
  ) => {
    if (linkedFormId) {
      // Direct form linking from modal
      const section = form.sections.find((s) => s.id === sectionId);
      if (!section) return;

      const parentQuestion = section.questions.find(
        (q) => q.id === parentQuestionId
      );
      if (!parentQuestion) return;

      const existingConfig = parentQuestion.followUpConfig?.[option] || {
        hasFollowUp: true,
        required: false,
      };

      const updatedParentQuestion = {
        ...parentQuestion,
        followUpConfig: {
          ...parentQuestion.followUpConfig,
          [option]: {
            ...existingConfig,
            linkedFormId: linkedFormId,
          },
        },
      };

      updateSection(sectionId, {
        questions: section.questions.map((q) =>
          q.id === parentQuestionId ? updatedParentQuestion : q
        ),
      });
      showSuccess(`Form linked successfully for "${option}"`);
    } else {
      // Show form selector modal
      setPendingFormLink({
        sectionId,
        parentQuestionId,
        triggerValue: option,
        path: [],
      });
      setShowFormSelector(true);
    }
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

  const handleAddFollowUpSection = (
    sectionId: string,
    parentQuestionId: string,
    triggerValue: string,
    path: string[]
  ) => {
    setPendingSectionLink({
      sectionId,
      parentQuestionId,
      triggerValue,
      path,
    });
    setShowSectionSelector(true);
  };

  const handleSelectSectionForLink = (selectedSectionId: string) => {
    if (!pendingSectionLink) return;

    const section = form.sections.find(
      (s) => s.id === pendingSectionLink.sectionId
    );
    if (!section) {
      showError("Section not found");
      return;
    }

    const updateFollowUpConfig = (
      questions: (Question | FollowUpQuestion)[],
      pathIndex: number = 0
    ): (Question | FollowUpQuestion)[] => {
      return questions.map((q) => {
        if (
          pathIndex < pendingSectionLink.path.length &&
          q.id === pendingSectionLink.path[pathIndex]
        ) {
          if (pathIndex === pendingSectionLink.path.length - 1) {
            return {
              ...q,
              followUpConfig: {
                ...(q.followUpConfig || {}),
                [pendingSectionLink.triggerValue]: {
                  hasFollowUp: true,
                  required: false,
                  linkedSectionId: selectedSectionId,
                },
              },
            };
          } else {
            return {
              ...q,
              followUpQuestions: updateFollowUpConfig(
                q.followUpQuestions || [],
                pathIndex + 1
              ),
            };
          }
        }
        return q;
      });
    };

    const updatedQuestions = updateFollowUpConfig(section.questions, 0);
    updateSection(pendingSectionLink.sectionId, {
      questions: updatedQuestions as Question[],
    });

    setShowSectionSelector(false);
    setPendingSectionLink(null);
    showSuccess(`Section linked successfully`);
  };

  const handleAddFollowUpForm = (
    sectionId: string,
    parentQuestionId: string,
    triggerValue: string,
    path: string[]
  ) => {
    setPendingFormLink({
      sectionId,
      parentQuestionId,
      triggerValue,
      path,
    });
    setShowFormSelector(true);
  };

  const handleSelectFormForLink = (selectedFormId: string) => {
    if (!pendingFormLink) return;

    const section = form.sections.find(
      (s) => s.id === pendingFormLink.sectionId
    );
    if (!section) {
      showError("Section not found");
      return;
    }

    const updateFollowUpConfig = (
      questions: (Question | FollowUpQuestion)[],
      pathIndex: number = 0
    ): (Question | FollowUpQuestion)[] => {
      return questions.map((q) => {
        if (
          pathIndex < pendingFormLink.path.length &&
          q.id === pendingFormLink.path[pathIndex]
        ) {
          if (pathIndex === pendingFormLink.path.length - 1) {
            return {
              ...q,
              followUpConfig: {
                ...(q.followUpConfig || {}),
                [pendingFormLink.triggerValue]: {
                  hasFollowUp: true,
                  required: false,
                  linkedFormId: selectedFormId,
                },
              },
            };
          } else {
            return {
              ...q,
              followUpQuestions: updateFollowUpConfig(
                q.followUpQuestions || [],
                pathIndex + 1
              ),
            };
          }
        }
        return q;
      });
    };

    const updatedQuestions = updateFollowUpConfig(section.questions, 0);
    updateSection(pendingFormLink.sectionId, {
      questions: updatedQuestions as Question[],
    });

    setShowFormSelector(false);
    setPendingFormLink(null);
    showSuccess(`Form linked successfully`);
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

  // Duplicate option
  const duplicateOption = (
    sectionId: string,
    questionId: string,
    optionIndex: number
  ) => {
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const question = section.questions.find((q) => q.id === questionId);
    if (!question || !question.options) return;

    const optionToDuplicate = question.options[optionIndex];
    const newOptions = [...question.options];
    newOptions.splice(optionIndex + 1, 0, `${optionToDuplicate} (Copy)`);

    updateQuestion(sectionId, questionId, {
      options: newOptions,
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
    <div className="w-full min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50 min-w-full">
        <div className="min-w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/forms/management")}
                className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                  {id ? "✏️ Edit Form" : "✨ Create New Form"}
                </h1>
                <p className="text-sm text-gray-600">
                  Build amazing forms with ease
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate("/forms/management")}
                className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                Save Form
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-8">
        <div className="flex gap-6">
          {/* Form Editor */}
          <div className="flex-1 space-y-6">
            {/* Form Details */}
            <div className="bg-white rounded-xl shadow-sm border-l-4 border-l-blue-500 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-blue-50 px-6 py-4 border-b border-blue-100">
                <h2 className="text-lg font-bold text-blue-900">
                  📋 Form Details
                </h2>
                <p className="text-sm text-blue-700 mt-1">
                  Set your form's basic information
                </p>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                    Form Title *
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base font-medium"
                    placeholder="e.g., Customer Feedback Survey"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
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
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none text-sm"
                    rows={3}
                    placeholder="Describe the purpose of your form..."
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

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="locationEnabled"
                    checked={form.locationEnabled !== false}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        locationEnabled: e.target.checked,
                      }))
                    }
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label
                    htmlFor="locationEnabled"
                    className="ml-2 text-sm text-primary-700"
                  >
                    Enable location tracking for responses
                  </label>
                </div>

                {/* Load Demo Data Button */}
                <div className="pt-4 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={loadDemoData}
                    className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
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

            {/* Page Navigation */}
            {(() => {
              const pages = getPagesFromSections();
              if (pages.length > 1) {
                return (
                  <div className="bg-white rounded-xl shadow-md border border-blue-200 p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-700">
                        Form Pages:
                      </h4>
                      <div className="flex items-center gap-2">
                        {pages.map((_, pageIndex) => (
                          <button
                            key={pageIndex}
                            onClick={() => setCurrentPage(pageIndex)}
                            className={`w-10 h-10 rounded-lg font-bold text-sm transition-all duration-200 ${
                              currentPage === pageIndex
                                ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-110"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {pageIndex + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Viewing Page {currentPage + 1} of {pages.length} · Each
                      main section is a separate page
                    </p>
                  </div>
                );
              }
              return null;
            })()}

            {/* Sections - Display current page */}
            {(() => {
              const pages = getPagesFromSections();
              const currentPageSections = pages[currentPage] || [];

              return currentPageSections.map((section, indexInPage) => {
                // Calculate the global section index
                const globalSectionIndex = form.sections.findIndex(
                  (s) => s.id === section.id
                );
                const sectionLabel = section.isSubsection
                  ? String.fromCharCode(
                      65 +
                        form.sections.findIndex(
                          (s) => s.id === section.parentSectionId
                        )
                    ) +
                    "." +
                    indexInPage
                  : String.fromCharCode(65 + currentPage); // A, B, C for main sections

                return (
                  <div
                    key={section.id}
                    className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden ${
                      section.isSubsection
                        ? "border-l-4 border-l-green-500 ml-6"
                        : "border-l-4 border-l-blue-500"
                    }`}
                  >
                    {/* Section Header */}
                    <div
                      className={`px-6 py-4 border-b ${
                        section.isSubsection
                          ? "bg-gradient-to-r from-green-50 to-teal-50 border-green-100"
                          : "bg-gradient-to-r from-blue-50 to-blue-50 border-blue-100"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div
                              className={`flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm shadow-md ${
                                section.isSubsection
                                  ? "bg-green-600"
                                  : "bg-blue-600"
                              }`}
                            >
                              {sectionLabel}
                            </div>
                            <h3
                              className={`text-lg font-bold ${
                                section.isSubsection
                                  ? "text-green-900"
                                  : "text-blue-900"
                              }`}
                            >
                              {section.isSubsection ? "Subsection" : "Section"}{" "}
                              {sectionLabel}
                              {section.title && (
                                <span
                                  className={`font-normal ml-2 ${
                                    section.isSubsection
                                      ? "text-green-600"
                                      : "text-blue-600"
                                  }`}
                                >
                                  · {section.title}
                                </span>
                              )}
                            </h3>
                          </div>
                          {section.description && (
                            <p
                              className={`text-sm ml-11 ${
                                section.isSubsection
                                  ? "text-green-700"
                                  : "text-blue-700"
                              }`}
                            >
                              {section.description}
                            </p>
                          )}
                        </div>
                        {/* <div className="flex items-center gap-2">
                          {!section.isSubsection && (
                            <button
                              onClick={() => addSubsection(section.id)}
                              className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                              title="Add subsection"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          )}
                          {form.sections.filter((s) => !s.isSubsection).length >
                            1 && (
                            <button
                              onClick={() => deleteSection(section.id)}
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete section"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div> */}
                      </div>
                    </div>

                    {/* Section Details (Optional) */}
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                            Section Title (Optional)
                          </label>
                          <input
                            type="text"
                            value={section.title}
                            onChange={(e) =>
                              updateSection(section.id, {
                                title: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                            placeholder="e.g., Personal Information, Contact Details"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                            Section Description (Optional)
                          </label>
                          <textarea
                            value={section.description}
                            onChange={(e) =>
                              updateSection(section.id, {
                                description: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-sm"
                            rows={2}
                            placeholder="Brief description for respondents"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Questions Container */}
                    <div className="p-6 space-y-5">
                      {/* Insert button at the beginning */}
                      {section.questions.length > 0 && (
                        <div className="flex justify-center -mb-3 relative z-10">
                          <button
                            onClick={() => insertQuestionAt(section.id, 0)}
                            className="group bg-white border-2 border-dashed border-blue-300 rounded-full p-2 text-blue-400 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600 transition-all duration-200"
                            title="Insert question at the beginning"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      )}

                      {section.questions.map((question, questionIndex) => (
                        <React.Fragment key={question.id}>
                          {/* Insert button between questions */}
                          {questionIndex > 0 && (
                            <div className="flex justify-center -my-3 relative z-10">
                              <button
                                onClick={() =>
                                  insertQuestionAt(section.id, questionIndex)
                                }
                                className="group bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-2 border-blue-400 rounded-full p-2 text-white transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-110"
                                title="Insert question here"
                              >
                                <Plus className="w-5 h-5" />
                              </button>
                            </div>
                          )}

                          {/* Question Card */}
                          <div className="bg-white border-2 border-gray-200 rounded-xl shadow-sm hover:shadow-lg hover:border-blue-300 transition-all duration-200">
                            {/* Question Header */}
                            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 rounded-t-xl">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs shadow">
                                  {questionIndex + 1}
                                </div>
                                <span className="text-sm font-semibold text-gray-700">
                                  Question {questionIndex + 1}
                                </span>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-1">
                                {/* Move Up */}
                                <button
                                  onClick={() =>
                                    moveQuestionUp(section.id, question.id)
                                  }
                                  disabled={questionIndex === 0}
                                  className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Move up"
                                >
                                  <ChevronUp className="w-5 h-5" />
                                </button>
                                {/* Move Down */}
                                <button
                                  onClick={() =>
                                    moveQuestionDown(section.id, question.id)
                                  }
                                  disabled={
                                    questionIndex ===
                                    section.questions.length - 1
                                  }
                                  className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Move down"
                                >
                                  <ChevronDown className="w-5 h-5" />
                                </button>
                                {/* Duplicate */}
                                <button
                                  onClick={() =>
                                    duplicateQuestion(section.id, question.id)
                                  }
                                  className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Duplicate question"
                                >
                                  <Copy className="w-5 h-5" />
                                </button>
                                {/* Delete */}
                                <button
                                  onClick={() =>
                                    deleteQuestion(section.id, question.id)
                                  }
                                  className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete question"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </div>

                            {/* Question Body */}
                            <div className="p-5">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
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
                                    className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                    placeholder="Enter your question"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                                    Question Type
                                  </label>
                                  <select
                                    value={question.type}
                                    onChange={(e) =>
                                      updateQuestion(section.id, question.id, {
                                        type: e.target.value,
                                      })
                                    }
                                    className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                  >
                                    {questionTypes.map((type) => (
                                      <option
                                        key={type.value}
                                        value={type.value}
                                      >
                                        {type.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="mt-4">
                                <label className="flex items-center cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={question.required}
                                    onChange={(e) =>
                                      updateQuestion(section.id, question.id, {
                                        required: e.target.checked,
                                      })
                                    }
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-all"
                                  />
                                  <span className="ml-2.5 text-sm text-gray-700 group-hover:text-blue-700 font-medium transition-colors">
                                    Required question
                                  </span>
                                </label>
                              </div>

                              {(question.type === "radio" ||
                                question.type === "checkbox" ||
                                question.type === "select") && (
                                <div className="mt-5 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                  <label className="block text-xs font-semibold text-blue-800 mb-3 uppercase tracking-wide">
                                    Options
                                  </label>
                                  <div className="space-y-2.5">
                                    {(question.options || []).map(
                                      (option, index) => {
                                        const menuKey = `${section.id}-${question.id}-${index}`;
                                        const isMenuOpen =
                                          openOptionMenu === menuKey;

                                        return (
                                          <div
                                            key={index}
                                            className="flex items-center gap-2 group"
                                          >
                                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-200 text-blue-700 font-bold text-xs">
                                              {index + 1}
                                            </div>
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
                                              className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                              placeholder={`Option ${
                                                index + 1
                                              }`}
                                            />
                                            <button
                                              onClick={() =>
                                                duplicateOption(
                                                  section.id,
                                                  question.id,
                                                  index
                                                )
                                              }
                                              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all"
                                              title="Duplicate option"
                                            >
                                              <Clipboard className="w-5 h-5" />
                                            </button>
                                            <button
                                              onClick={() =>
                                                removeOption(
                                                  section.id,
                                                  question.id,
                                                  index
                                                )
                                              }
                                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-all"
                                              title="Delete option"
                                            >
                                              <X className="w-5 h-5" />
                                            </button>

                                            {/* Three dots menu for follow-up options */}
                                            <div className="relative">
                                              <button
                                                onClick={() =>
                                                  setOpenOptionMenu(
                                                    isMenuOpen ? null : menuKey
                                                  )
                                                }
                                                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
                                                title="Follow-up options"
                                              >
                                                <MoreVertical className="w-5 h-5" />
                                              </button>

                                              {/* Dropdown menu */}
                                              {isMenuOpen && (
                                                <>
                                                  {/* Backdrop to close menu */}
                                                  <div
                                                    className="fixed inset-0 z-10"
                                                    onClick={() =>
                                                      setOpenOptionMenu(null)
                                                    }
                                                  />

                                                  <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
                                                    <div className="py-1">
                                                      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                                                        Follow-up Options
                                                      </div>
                                                      <button
                                                        onClick={() => {
                                                          addFollowUpQuestion(
                                                            section.id,
                                                            question.id,
                                                            option
                                                          );
                                                          setOpenOptionMenu(
                                                            null
                                                          );
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2"
                                                      >
                                                        <span className="text-lg">
                                                          📝
                                                        </span>
                                                        <div>
                                                          <div className="font-medium">
                                                            Follow-up Question
                                                          </div>
                                                          <div className="text-xs text-gray-500">
                                                            Add a question for
                                                            this option
                                                          </div>
                                                        </div>
                                                      </button>

                                                      <button
                                                        onClick={() => {
                                                          linkFollowUpSection(
                                                            section.id,
                                                            question.id,
                                                            option
                                                          );
                                                          setOpenOptionMenu(
                                                            null
                                                          );
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors flex items-center gap-2"
                                                      >
                                                        <span className="text-lg">
                                                          📋
                                                        </span>
                                                        <div>
                                                          <div className="font-medium">
                                                            Follow-up Section
                                                          </div>
                                                          <div className="text-xs text-gray-500">
                                                            Add a section for
                                                            this option
                                                          </div>
                                                        </div>
                                                      </button>

                                                      <button
                                                        onClick={() => {
                                                          linkFollowUpForm(
                                                            section.id,
                                                            question.id,
                                                            option
                                                          );
                                                          setOpenOptionMenu(
                                                            null
                                                          );
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2"
                                                      >
                                                        <span className="text-lg">
                                                          📄
                                                        </span>
                                                        <div>
                                                          <div className="font-medium">
                                                            Follow-up Form
                                                          </div>
                                                          <div className="text-xs text-gray-500">
                                                            Link a form for this
                                                            option
                                                          </div>
                                                        </div>
                                                      </button>
                                                    </div>
                                                  </div>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      }
                                    )}
                                    <button
                                      onClick={() =>
                                        addOption(section.id, question.id)
                                      }
                                      className="flex items-center gap-2 px-4 py-2 text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-lg text-sm font-medium transition-all"
                                    >
                                      <Plus className="w-5 h-5" />
                                      Add Option
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Section Branching Configuration */}
                              {(question.type === "radio" ||
                                question.type === "checkbox" ||
                                question.type === "select") &&
                                question.options &&
                                question.options.length > 0 && (
                                  <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg">🔀</span>
                                        <label className="text-xs font-semibold text-purple-800 uppercase tracking-wide">
                                          Section Routing
                                        </label>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openBranchingConfig(
                                            section.id,
                                            question.id,
                                            question.options || []
                                          )
                                        }
                                        className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-1"
                                      >
                                        <LinkIcon className="w-4 h-4" />
                                        Configure Routing
                                      </button>
                                    </div>
                                    <p className="text-xs text-purple-700 mb-2">
                                      Route user to different sections based on
                                      their answer
                                    </p>
                                    {question.branchingRules &&
                                      question.branchingRules.length > 0 && (
                                        <div className="text-xs text-purple-600 bg-white rounded p-2">
                                          <div className="font-medium mb-1">
                                            Active routing:
                                          </div>
                                          <ul className="space-y-1">
                                            {question.branchingRules.map(
                                              (rule, idx) => (
                                                <li key={idx}>
                                                  • "{rule.optionLabel}" →{" "}
                                                  {form.sections.find(
                                                    (s) =>
                                                      s.id ===
                                                      rule.targetSectionId
                                                  )?.title || "Unknown"}
                                                </li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                  </div>
                                )}

                              {/* Form Routing Configuration */}
                              {(question.type === "radio" ||
                                question.type === "checkbox" ||
                                question.type === "select") &&
                                question.options &&
                                question.options.length > 0 && (
                                  <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg">🔗</span>
                                        <label className="text-xs font-semibold text-green-800 uppercase tracking-wide">
                                          Follow-up Form Routing
                                        </label>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openFormRoutingConfig(
                                            section.id,
                                            question.id,
                                            question.options || []
                                          )
                                        }
                                        className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-1"
                                      >
                                        <LinkIcon className="w-4 h-4" />
                                        Configure Form Links
                                      </button>
                                    </div>
                                    <p className="text-xs text-green-700 mb-2">
                                      Link answers to follow-up forms
                                      (auto-redirect after submission)
                                    </p>
                                    {question.followUpConfig &&
                                      Object.keys(question.followUpConfig).some(
                                        (k) =>
                                          question.followUpConfig?.[k]
                                            ?.linkedFormId
                                      ) && (
                                        <div className="text-xs text-green-600 bg-white rounded p-2">
                                          <div className="font-medium mb-1">
                                            ✅ Active form links:
                                          </div>
                                          <ul className="space-y-1">
                                            {Object.entries(
                                              question.followUpConfig
                                            )
                                              .filter(
                                                ([_, config]) =>
                                                  config.linkedFormId
                                              )
                                              .map(([option, config], idx) => (
                                                <li key={idx}>
                                                  • "{option}" → Form:{" "}
                                                  {config.linkedFormId}
                                                </li>
                                              ))}
                                          </ul>
                                        </div>
                                      )}
                                  </div>
                                )}

                              {/* Correct Answer Section */}
                              {(question.type === "radio" ||
                                question.type === "checkbox" ||
                                question.type === "select") &&
                                question.options &&
                                question.options.length > 0 && (
                                  <div className="mt-3">
                                    <label className="block text-xs font-medium text-primary-600 mb-2">
                                      Correct Answer (Optional - for quiz
                                      questions)
                                    </label>
                                    <select
                                      value={question.correctAnswer || ""}
                                      onChange={(e) =>
                                        updateQuestion(
                                          section.id,
                                          question.id,
                                          {
                                            correctAnswer:
                                              e.target.value || undefined,
                                          }
                                        )
                                      }
                                      className="w-full p-2 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                      <option value="">
                                        No correct answer
                                      </option>
                                      {question.options.map((option, index) => (
                                        <option key={index} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
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
                                          followUpQuestions={
                                            question.followUpQuestions
                                          }
                                          sectionId={section.id}
                                          parentQuestion={{
                                            id: question.id,
                                            options: question.options,
                                          }}
                                          path={[question.id]}
                                          onUpdate={(
                                            sId,
                                            fqId,
                                            updates,
                                            path
                                          ) => {
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
                                              deleteFollowUpQuestion(
                                                sId,
                                                path[0],
                                                fqId
                                              );
                                            } else {
                                              // Nested follow-up
                                              deleteNestedFollowUpQuestion(
                                                sId,
                                                fqId,
                                                path
                                              );
                                            }
                                          }}
                                          onAddNested={
                                            addNestedFollowUpQuestion
                                          }
                                          onAddOption={(sId, fqId, path) => {
                                            if (path.length === 1) {
                                              // First level follow-up
                                              addFollowUpOption(
                                                sId,
                                                path[0],
                                                fqId
                                              );
                                            } else {
                                              // Nested follow-up
                                              addNestedFollowUpOption(
                                                sId,
                                                fqId,
                                                path
                                              );
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
                                          onRemoveOption={(
                                            sId,
                                            fqId,
                                            optIndex,
                                            path
                                          ) => {
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
                                          onAddFollowUpSection={
                                            handleAddFollowUpSection
                                          }
                                          onAddFollowUpForm={
                                            handleAddFollowUpForm
                                          }
                                          questionTypes={questionTypes}
                                          depth={0}
                                        />
                                      )}

                                    {(!question.followUpQuestions ||
                                      question.followUpQuestions.length ===
                                        0) && (
                                      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 rounded-lg text-center">
                                        <div className="flex items-center justify-center mb-3">
                                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                            <Plus className="w-6 h-6 text-blue-600" />
                                          </div>
                                        </div>
                                        <p className="text-sm font-medium text-blue-900 mb-3">
                                          Add follow-up questions for your
                                          options
                                        </p>
                                        <p className="text-xs text-blue-700 mb-3">
                                          Select an option to add a follow-up
                                          question that appears when users
                                          select it
                                        </p>
                                        <div className="flex flex-wrap gap-2 justify-center">
                                          {question.options?.map(
                                            (option, optIndex) => (
                                              <button
                                                key={optIndex}
                                                onClick={() => {
                                                  addFollowUpQuestion(
                                                    section.id,
                                                    question.id,
                                                    option
                                                  );
                                                }}
                                                className="px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                              >
                                                Add for "{option}"
                                              </button>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Note: Follow-up options are now available in the three-dots menu for each option */}
                                  </div>
                                )}
                            </div>
                          </div>
                        </React.Fragment>
                      ))}

                      {/* Add question button at the end */}
                      {section.questions.length > 0 && (
                        <div className="flex justify-center -my-3 relative z-10">
                          <button
                            onClick={() => addQuestion(section.id)}
                            className="group bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-2 border-blue-400 rounded-full p-2 text-white transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-110"
                            title="Add question at the end"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      )}

                      {/* Or large button if no questions */}
                      {section.questions.length === 0 && (
                        <div className="text-center py-12">
                          <div
                            className="inline-flex flex-col items-center gap-3 p-8 border-2 border-dashed border-blue-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer"
                            onClick={() => addQuestion(section.id)}
                          >
                            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg">
                              <Plus className="w-8 h-8" />
                            </div>
                            <p className="text-lg font-semibold text-blue-700">
                              Add Your First Question
                            </p>
                            <p className="text-sm text-gray-600">
                              Click to start building your form
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}

            {/* Add Section Button */}
            <div className="mt-8">
              <button
                onClick={() => {
                  addSection();
                  // Switch to the new page
                  const pages = getPagesFromSections();
                  setCurrentPage(pages.length);
                }}
                className="w-full group relative overflow-hidden p-6 border-2 border-dashed border-blue-300 rounded-xl text-blue-700 hover:border-blue-500 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-50 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white shadow-md group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="text-lg font-bold">
                    Add New Page (Section)
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Create a new main section on a separate page
                </p>
              </button>

              {/* Child Forms Manager - Only show when editing existing form */}
              {id ? (
                <div className="mt-6">
                  <ChildFormsManager
                    parentFormId={id}
                    onUpdate={() => {
                      // Optionally refresh form data if needed
                      console.log("Child forms updated");
                    }}
                  />
                </div>
              ) : (
                <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                  <div className="flex items-start space-x-3">
                    <LinkIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">
                        🔗 Create Follow-Up Forms (Child Forms)
                      </h3>
                      <p className="text-sm text-blue-800 mb-3">
                        Want to link follow-up forms that appear after users
                        complete this form?
                      </p>
                      <div className="bg-white border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                        <p className="font-medium mb-2">📝 How it works:</p>
                        <ol className="list-decimal list-inside space-y-1 text-blue-800">
                          <li>Save this form first</li>
                          <li>Come back to edit it</li>
                          <li>Link existing forms as "child forms"</li>
                          <li>
                            Child forms will appear to users after completing
                            this parent form
                          </li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 flex-shrink-0 space-y-6">
            {/* Sticky Page Navigation */}
            {(() => {
              const pages = getPagesFromSections();
              if (pages.length > 1) {
                return (
                  <div className="sticky top-1/2 -translate-y-1/2 h-0">
                    <div className="bg-white rounded-lg border-2 border-blue-200 shadow-lg p-4 -translate-y-1/2">
                      <h3 className="text-sm font-bold text-blue-900 mb-3 text-center">
                        📄 Pages
                      </h3>
                      <div className="space-y-2">
                        {pages.map((page, pageIndex) => {
                          const isCurrent = currentPage === pageIndex;
                          const sectionLabel = String.fromCharCode(
                            65 + pageIndex
                          ); // A, B, C...
                          const mainSection = page.find((s) => !s.isSubsection);
                          const questionCount = page.reduce(
                            (total, s) => total + s.questions.length,
                            0
                          );

                          return (
                            <button
                              key={pageIndex}
                              type="button"
                              onClick={() => setCurrentPage(pageIndex)}
                              className={`
                                w-full p-3 rounded-lg text-left transition-all duration-200
                                ${
                                  isCurrent
                                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md scale-105"
                                    : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                                }
                              `}
                              title={
                                mainSection?.title || `Page ${pageIndex + 1}`
                              }
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`
                                    flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm
                                    ${
                                      isCurrent
                                        ? "bg-white text-blue-600"
                                        : "bg-blue-600 text-white"
                                    }
                                  `}
                                  >
                                    {sectionLabel}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div
                                      className={`text-sm font-bold truncate ${
                                        isCurrent
                                          ? "text-white"
                                          : "text-blue-900"
                                      }`}
                                    >
                                      {mainSection?.title ||
                                        `Section ${pageIndex + 1}`}
                                    </div>
                                    <div
                                      className={`text-xs ${
                                        isCurrent
                                          ? "text-blue-100"
                                          : "text-blue-600"
                                      }`}
                                    >
                                      {questionCount}{" "}
                                      {questionCount === 1
                                        ? "question"
                                        : "questions"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Progress indicator */}
                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <div className="text-xs text-center text-blue-700 mb-2 font-medium">
                          Page {currentPage + 1} of {pages.length}
                        </div>
                        <div className="w-full bg-blue-100 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-600 to-blue-700 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${
                                ((currentPage + 1) / pages.length) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h3 className="font-medium text-primary-800 mb-4">
                Form Preview
              </h3>
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
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-primary-900">
                Form Preview
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <PreviewForm form={form} />
            </div>
          </div>
        </div>
      )}

      {/* Section Branching Configuration Modal */}
      {showBranchingConfig && branchingConfigQuestion && (
        <SectionBranchingConfig
          questionId={branchingConfigQuestion.questionId}
          sectionId={branchingConfigQuestion.sectionId}
          options={branchingConfigQuestion.options}
          sections={form.sections.map((s) => ({ id: s.id, title: s.title }))}
          existingRules={
            form.sections
              .find((s) => s.id === branchingConfigQuestion.sectionId)
              ?.questions.find(
                (q) => q.id === branchingConfigQuestion.questionId
              )?.branchingRules || []
          }
          onSave={handleSaveBranchingRules}
          onClose={() => {
            setShowBranchingConfig(false);
            setBranchingConfigQuestion(null);
          }}
        />
      )}

      {/* Form Routing Configuration Modal */}
      {showFormRoutingConfig && formRoutingConfigQuestion && (
        <FormRoutingConfig
          questionId={formRoutingConfigQuestion.questionId}
          sectionId={formRoutingConfigQuestion.sectionId}
          options={formRoutingConfigQuestion.options}
          availableForms={forms.map((f) => ({ id: f.id || f._id, title: f.title }))}
          existingConfig={
            form.sections
              .find((s) => s.id === formRoutingConfigQuestion.sectionId)
              ?.questions.find(
                (q) => q.id === formRoutingConfigQuestion.questionId
              )?.followUpConfig || {}
          }
          onSave={handleSaveFormRoutingConfig}
          onClose={() => {
            setShowFormRoutingConfig(false);
            setFormRoutingConfigQuestion(null);
          }}
        />
      )}
    </div>
  );
}
