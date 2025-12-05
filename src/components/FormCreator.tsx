import React, { useState, useEffect, useMemo } from "react";
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
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Link as LinkIcon,
  MessageSquarePlus,
  Download,
  Upload,
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
import ParameterModal from "./ParameterModal";
import { downloadFormImportTemplate, parseFormWorkbook } from "../utils/exportUtils";

const YES_NO_NA_OPTIONS = ["Yes", "No", "N/A"];
const YES_NO_NA_CORRECT = "Yes";
const MAX_VISIBLE_PAGE_BUTTONS = 3;

interface FormSection {
  id: string;
  title: string;
  description?: string;
  weightage?: number;
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
  allowedFileTypes?: string[];
  description?: string;
  imageUrl?: string;
  subParam1?: string;
  subParam2?: string;
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
  allowedFileTypes?: string[];
  description?: string;
  imageUrl?: string;
  subParam1?: string;
  subParam2?: string;
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
  const [pageWindowStart, setPageWindowStart] = useState<number>(0);
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
        weightage: 0,
        questions: [],
      },
    ] as FormSection[],
  });
  const [sectionWeightageDrafts, setSectionWeightageDrafts] = useState<Record<string, string>>({});
  const [formSectionBranching, setFormSectionBranching] = useState<any[]>([]);
  const [showFormRoutingConfig, setShowFormRoutingConfig] = useState(false);
  const [formRoutingConfigQuestion, setFormRoutingConfigQuestion] = useState<{
    questionId: string;
    sectionId: string;
    options: string[];
  } | null>(null);
  const [showParameterModal, setShowParameterModal] = useState(false);
  const [parameters, setParameters] = useState<any[]>([]);
  const [tempParameters, setTempParameters] = useState<any[]>([]);
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
          // Reconstruct nested follow-up questions from flat array or use existing nested structure
          const sectionsWithNestedFollowUps = (backendForm.sections || []).map(
            (section: any) => {
              const mainQuestions: Question[] = [];
              const followUpMap = new Map<string, FollowUpQuestion[]>();

              // First pass: separate main questions and follow-ups (for backward compatibility with flat structure)
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

              // Second pass: attach follow-ups to their parent questions and initialize followUpConfig
              const questionsWithFollowUps = mainQuestions.map((q) => {
                // Use existing nested follow-ups if present, otherwise reconstruct from flat array
                const followUps = (q.followUpQuestions && q.followUpQuestions.length > 0)
                  ? q.followUpQuestions
                  : (followUpMap.get(q.id) || []);

                // Initialize followUpConfig if not present
                const followUpConfig = q.followUpConfig || {};
                if (q.options && q.options.length > 0) {
                  q.options.forEach((option: string) => {
                    if (!followUpConfig[option]) {
                      followUpConfig[option] = {
                        hasFollowUp: false,
                        required: false,
                      };
                    }
                  });
                  // Mark options that have follow-ups
                  followUps.forEach((followUp) => {
                    if (
                      followUp.showWhen?.value &&
                      followUpConfig[followUp.showWhen.value]
                    ) {
                      followUpConfig[followUp.showWhen.value].hasFollowUp =
                        true;
                    }
                  });
                }

                return {
                  ...q,
                  followUpQuestions: followUps,
                  followUpConfig: followUpConfig,
                };
              });

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
      const state = location.state as { mode?: string; formData?: any };
      if (state?.mode === "create") {
        setMode("create");
        if (state.formData) {
          // Load pre-populated form data
          setForm({
            title: state.formData.title || "",
            description: state.formData.description || "",
            isVisible: state.formData.isVisible !== false,
            locationEnabled: state.formData.locationEnabled !== false,
            sections: (state.formData.sections || []).map((section: any) => ({
              id: section.id || crypto.randomUUID(),
              title: section.title || "",
              description: section.description || "",
              weightage: section.weightage || 0,
              questions: (section.questions || []).map((question: any) => ({
                id: question.id || crypto.randomUUID(),
                text: question.text || "",
                type: question.type || "text",
                required: question.required || false,
                options: question.options || undefined,
                allowedFileTypes: question.allowedFileTypes || undefined,
                description: question.description || undefined,
                imageUrl: question.imageUrl || undefined,
                subParam1: question.subParam1 || undefined,
                subParam2: question.subParam2 || undefined,
                followUpQuestions: question.followUpQuestions || [],
                showWhen: question.showWhen || undefined,
                parentId: question.parentId || undefined,
                correctAnswer: question.correctAnswer || undefined,
                followUpConfig: question.followUpConfig || undefined,
                branchingRules: question.branchingRules || undefined,
              })),
            })),
          });
        } else {
          // Start with empty form
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
                weightage: 0,
                questions: [],
              },
            ] as FormSection[],
          });
        }
      } else {
        setMode("list");
      }
    }
  }, [id, location.state]);

  useEffect(() => {
    setSectionWeightageDrafts((prev) => {
      const currentIds = new Set(form.sections.map((section) => section.id));
      const next = { ...prev };
      let changed = false;

      Object.keys(next).forEach((key) => {
        if (!currentIds.has(key)) {
          delete next[key];
          changed = true;
        }
      });

      form.sections.forEach((section) => {
        if (next[section.id] === undefined) {
          if (typeof section.weightage === "number" && !Number.isNaN(section.weightage)) {
            next[section.id] = section.weightage.toString();
          } else {
            next[section.id] = "";
          }
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [form.sections]);

  // Fetch parameters
  useEffect(() => {
    const fetchParameters = async () => {
      if (id) {
        // For existing forms, fetch from API
        try {
          const response = await apiClient.getParameters({ formId: id });
          setParameters(response.parameters || []);
        } catch (error) {
          console.error("Failed to fetch parameters:", error);
        }
      } else {
        // For new forms, use temporary parameters
        setParameters(tempParameters);
      }
    };
    fetchParameters();
  }, [id, tempParameters]);

  // Helper function to determine if a question is a followup question
  const isFollowupQuestion = (question: Question, section: FormSection) => {
    // Check if question has parentId (for nested followups)
    if (question.parentId) return true;

    // Check if question is in followUpQuestions of another question
    const isInFollowUps = section.questions.some(q =>
      q.followUpQuestions?.some(fq => fq.id === question.id)
    );

    return isInFollowUps;
  };

  const handleExportTemplate = () => {
    try {
      downloadFormImportTemplate();
      showSuccess("Template exported successfully!", "Export Template");
    } catch (error) {
      console.error("Failed to export template:", error);
      showError("Failed to export template", "Error");
    }
  };

  const handleImportTemplate = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedData = await parseFormWorkbook(file);
      
      const newForm = {
        title: importedData.title || "Imported Form",
        description: importedData.description || "",
        isVisible: true,
        locationEnabled: true,
        sections: importedData.sections || [],
      };

      setForm(newForm);
      if (importedData.parametersToCreate && importedData.parametersToCreate.length > 0) {
        setTempParameters(importedData.parametersToCreate);
      }
      showSuccess("Template imported successfully!", "Import Template");
    } catch (error) {
      console.error("Failed to import template:", error);
      showError(
        error instanceof Error ? error.message : "Failed to import template",
        "Import Error"
      );
    }
  };

  // Function to load sample data for testing
  const loadSampleData = async () => {
    try {
      showConfirm(
        "This will replace your current form with sample data. Continue?",
        "Load Sample Data",
        async () => {
          // Create sample parameters first
          const tenantId = user?.role === "superadmin" ? selectedTenantId : user?.tenantId;

          const sampleParameters = [
            // Main parameters
            { name: "Safety Score", type: "main" as const },
            { name: "Quality Rating", type: "main" as const },
            { name: "Efficiency Index", type: "main" as const },
            { name: "Compliance Level", type: "main" as const },
            // Followup parameters
            { name: "Root Cause", type: "followup" as const },
            { name: "Action Required", type: "followup" as const },
            { name: "Timeline", type: "followup" as const },
            { name: "Responsible Party", type: "followup" as const },
          ];

          // Create parameters in batch
          const createdParameters = [];
          for (const param of sampleParameters) {
            try {
              const response = await apiClient.createParameter({
                ...param,
                tenantId,
              });
              createdParameters.push(response.parameter);
            } catch (error) {
              console.warn(`Failed to create parameter ${param.name}:`, error);
            }
          }

          // Update parameters state
          setParameters(prev => [...prev, ...createdParameters]);

          // Create sample form data
          const sampleForm = {
            title: "Manufacturing Quality Inspection Form",
            description: "Comprehensive quality inspection form with follow-up questions for manufacturing processes",
            isVisible: true,
            locationEnabled: true,
            sections: [
              {
                id: crypto.randomUUID(),
                title: "Process Overview",
                description: "Initial assessment of the manufacturing process",
                weightage: 25,
                questions: [
                  {
                    id: crypto.randomUUID(),
                    text: "What is the current production line status?",
                    type: "radio",
                    required: true,
                    options: ["Running Normally", "Minor Issues", "Major Issues", "Stopped"],
                    subParam1: "Efficiency Index",
                    subParam2: "Safety Score",
                    followUpConfig: {
                      "Minor Issues": { hasFollowUp: true, required: true },
                      "Major Issues": { hasFollowUp: true, required: true },
                      "Stopped": { hasFollowUp: true, required: true },
                    },
                    followUpQuestions: [
                      {
                        id: crypto.randomUUID(),
                        text: "Please describe the issue in detail",
                        type: "textarea",
                        required: true,
                        subParam1: "Root Cause",
                        subParam2: "Action Required",
                        showWhen: { questionId: "", value: "Minor Issues" },
                        followUpQuestions: [
                          {
                            id: crypto.randomUUID(),
                            text: "Who is responsible for resolving this issue?",
                            type: "text",
                            required: true,
                            subParam1: "Responsible Party",
                            showWhen: { questionId: "", value: "" },
                          }
                        ]
                      },
                      {
                        id: crypto.randomUUID(),
                        text: "What is the estimated downtime?",
                        type: "select",
                        required: true,
                        options: ["< 1 hour", "1-4 hours", "4-8 hours", "> 8 hours"],
                        subParam1: "Timeline",
                        showWhen: { questionId: "", value: "Major Issues" },
                      }
                    ]
                  },
                  {
                    id: crypto.randomUUID(),
                    text: "Rate the overall quality of recent production",
                    type: "radio",
                    required: true,
                    options: ["Excellent", "Good", "Average", "Poor", "Critical"],
                    subParam1: "Quality Rating",
                    followUpConfig: {
                      "Poor": { hasFollowUp: true, required: true },
                      "Critical": { hasFollowUp: true, required: true },
                    },
                    followUpQuestions: [
                      {
                        id: crypto.randomUUID(),
                        text: "What quality issues were identified?",
                        type: "textarea",
                        required: true,
                        subParam1: "Root Cause",
                        showWhen: { questionId: "", value: "Poor" },
                      }
                    ]
                  }
                ]
              },
              {
                id: crypto.randomUUID(),
                title: "Compliance Check",
                description: "Verification of regulatory and safety compliance",
                weightage: 35,
                questions: [
                  {
                    id: crypto.randomUUID(),
                    text: "Are all safety protocols being followed?",
                    type: "radio",
                    required: true,
                    options: ["Yes", "No", "Partially"],
                    subParam1: "Safety Score",
                    subParam2: "Compliance Level",
                    followUpConfig: {
                      "No": { hasFollowUp: true, required: true },
                      "Partially": { hasFollowUp: true, required: true },
                    },
                    followUpQuestions: [
                      {
                        id: crypto.randomUUID(),
                        text: "Which protocols are not being followed?",
                        type: "textarea",
                        required: true,
                        subParam1: "Root Cause",
                        showWhen: { questionId: "", value: "No" },
                      }
                    ]
                  }
                ]
              },
              {
                id: crypto.randomUUID(),
                title: "Final Assessment",
                description: "Overall evaluation and recommendations",
                weightage: 40,
                questions: [
                  {
                    id: crypto.randomUUID(),
                    text: "Overall process efficiency rating",
                    type: "radio",
                    required: true,
                    options: ["Highly Efficient", "Efficient", "Needs Improvement", "Inefficient"],
                    subParam1: "Efficiency Index",
                    followUpConfig: {
                      "Needs Improvement": { hasFollowUp: true, required: false },
                      "Inefficient": { hasFollowUp: true, required: true },
                    },
                    followUpQuestions: [
                      {
                        id: crypto.randomUUID(),
                        text: "What improvements are recommended?",
                        type: "textarea",
                        required: true,
                        subParam1: "Action Required",
                        showWhen: { questionId: "", value: "Needs Improvement" },
                      }
                    ]
                  }
                ]
              }
            ]
          };

          // Fix followUp questionId references
          sampleForm.sections.forEach(section => {
            section.questions.forEach(question => {
              if (question.followUpQuestions) {
                question.followUpQuestions.forEach(followUp => {
                  if (followUp.showWhen) {
                    followUp.showWhen.questionId = question.id;
                  }
                  if (followUp.followUpQuestions) {
                    followUp.followUpQuestions.forEach(nestedFollowUp => {
                      if (nestedFollowUp.showWhen) {
                        nestedFollowUp.showWhen.questionId = followUp.id;
                      }
                    });
                  }
                });
              }
            });
          });

          setForm(sampleForm);
          showSuccess("Sample data loaded successfully!", "Sample Data");
        }
      );
    } catch (error) {
      console.error("Failed to load sample data:", error);
      showError("Failed to load sample data", "Error");
    }
  };

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

        const questionHasText = Boolean(question.text && question.text.trim());
        const questionHasImage = Boolean(question.imageUrl && question.imageUrl.trim());
        const questionLabel = question.text?.trim() || "Image question";

        if (!questionHasText && !questionHasImage) {
          showError(
            `Question in section "${section.title}" must include text or an image`,
            "Validation Error"
          );
          return;
        }

        if (!question.type) {
          showError(
            `Question "${questionLabel}" in section "${section.title}" is missing a type`,
            "Validation Error"
          );
          return;
        }

        if (
          question.followUpQuestions &&
          question.followUpQuestions.length > 0
        ) {
          for (const followUp of question.followUpQuestions) {
            if (!followUp.id) {
              showError(
                `Follow-up question for "${questionLabel}" is missing an ID`,
                "Validation Error"
              );
              return;
            }

            const followUpHasText = Boolean(
              followUp.text && followUp.text.trim()
            );
            const followUpHasImage = Boolean(
              followUp.imageUrl && followUp.imageUrl.trim()
            );

            if (!followUpHasText && !followUpHasImage) {
              showError(
                `Follow-up question for "${questionLabel}" must include text or an image`,
                "Validation Error"
              );
              return;
            }

            const followUpLabel = followUp.text?.trim() || "Image question";

            if (!followUp.type) {
              showError(
                `Follow-up question "${followUpLabel}" is missing a type`,
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
          const questionLabelForLog = question.text?.trim() || "Image question";
          console.log(
            `${indent}Processing question: "${questionLabelForLog}" (depth: ${depth})`
          );

          const { followUpQuestions, ...mainQuestion } = question;
          allQuestions.push(mainQuestion as Question);

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
              const followUpLabelForLog =
                followUpWithShowWhen.text?.trim() || "Image question";
              console.log(
                `${indent}Adding follow-up: "${followUpLabelForLog}"`
              );

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

        // Create temporary parameters if any exist
        if (tempParameters.length > 0) {
          console.log("Creating parameters for new form:", tempParameters);
          try {
            const createPromises = tempParameters.map(param =>
              apiClient.createParameter({
                name: param.name,
                type: param.type,
                formId: newFormId,
              })
            );
            await Promise.all(createPromises);
            console.log("Parameters created successfully");
            // Clear temporary parameters
            setTempParameters([]);
          } catch (error) {
            console.error("Failed to create parameters for new form:", error);
            showError("Form created but failed to create parameters", "Warning");
          }
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
          weightage: 0,
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
          weightage: 50,
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
          weightage: 50,
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
          weightage: 0,
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
        const subsections = form.sections.filter(
          (s) => s.parentSectionId === section.id
        );
        pages.push([section, ...subsections]);
      }
    });

    return pages;
  };

  const pages = useMemo(() => getPagesFromSections(), [form.sections]);
  const totalPages = pages.length;

  useEffect(() => {
    if (totalPages === 0) {
      if (currentPage !== 0) {
        setCurrentPage(0);
      }
      setPageWindowStart(0);
      return;
    }

    if (currentPage > totalPages - 1) {
      setCurrentPage(totalPages - 1);
      return;
    }

    setPageWindowStart((prev) => {
      const maxStart = Math.max(0, totalPages - MAX_VISIBLE_PAGE_BUTTONS);
      let nextStart = prev;

      if (currentPage < nextStart) {
        nextStart = currentPage;
      } else if (currentPage >= nextStart + MAX_VISIBLE_PAGE_BUTTONS) {
        nextStart = currentPage - MAX_VISIBLE_PAGE_BUTTONS + 1;
      }

      if (nextStart > maxStart) {
        nextStart = maxStart;
      }

      if (nextStart < 0) {
        nextStart = 0;
      }

      return nextStart === prev ? prev : nextStart;
    });
  }, [currentPage, totalPages]);

  const handlePageChange = (pageIndex: number, total: number = totalPages) => {
    const nextTotal = Math.max(total, 0);

    if (nextTotal === 0) {
      setCurrentPage(0);
      setPageWindowStart(0);
      return;
    }

    const clampedPage = Math.max(0, Math.min(pageIndex, nextTotal - 1));
    setCurrentPage(clampedPage);

    setPageWindowStart((prev) => {
      const maxStart = Math.max(0, nextTotal - MAX_VISIBLE_PAGE_BUTTONS);
      let nextStart = prev;

      if (clampedPage < nextStart) {
        nextStart = clampedPage;
      } else if (clampedPage >= nextStart + MAX_VISIBLE_PAGE_BUTTONS) {
        nextStart = clampedPage - MAX_VISIBLE_PAGE_BUTTONS + 1;
      }

      if (nextStart > maxStart) {
        nextStart = maxStart;
      }

      if (nextStart < 0) {
        nextStart = 0;
      }

      return nextStart === prev ? prev : nextStart;
    });
  };

  const updateSection = (sectionId: string, updates: Partial<FormSection>) => {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId ? { ...section, ...updates } : section
      ),
    }));
  };

  const resolveSectionWeightageDraft = (section: FormSection) => {
    if (sectionWeightageDrafts[section.id] !== undefined) {
      return sectionWeightageDrafts[section.id];
    }
    if (typeof section.weightage === "number" && !Number.isNaN(section.weightage)) {
      return section.weightage.toString();
    }
    return "";
  };

  const handleSaveSectionWeightage = (sectionId: string) => {
    const rawDraft = sectionWeightageDrafts[sectionId];
    const trimmedDraft = (rawDraft ?? "").trim();
    const valueToParse = trimmedDraft === "" ? "0" : trimmedDraft;
    const parsed = Number(valueToParse);

    if (Number.isNaN(parsed)) {
      showError("Section weightage must be a number", "Validation Error");
      return;
    }

    if (parsed < 0 || parsed > 100) {
      showError("Section weightage must be between 0 and 100", "Validation Error");
      return;
    }

    const rounded = Math.round(parsed * 10) / 10;

    updateSection(sectionId, { weightage: rounded });
    setSectionWeightageDrafts((prev) => ({
      ...prev,
      [sectionId]: rounded.toString(),
    }));
  };

  const getSavedSectionWeightage = (section: FormSection) => {
    if (typeof section.weightage === "number" && !Number.isNaN(section.weightage)) {
      return Math.round(section.weightage * 10) / 10;
    }
    return 0;
  };

  const formatWeightageDisplay = (value: number) => value.toFixed(1).replace(/\.0$/, "");

  const hasPendingWeightageChange = (section: FormSection) => {
    const draft = resolveSectionWeightageDraft(section).trim();
    if (!draft.length) {
      return getSavedSectionWeightage(section) !== 0;
    }
    const parsed = Number(draft);
    if (Number.isNaN(parsed)) {
      return true;
    }
    return Math.abs(parsed - getSavedSectionWeightage(section)) > 0.05;
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
      imageUrl: "",
      subParam1: "",
      subParam2: "",
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
      imageUrl: "",
      subParam1: "",
      subParam2: "",
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

  const MAX_QUESTION_IMAGE_BYTES = 50 * 1024;

  const compressQuestionImage = async (file: File): Promise<string> => {
    const readFileAsDataUrl = () =>
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

    const dataUrl = await readFileAsDataUrl();
    const imageElement = await loadImageElement(dataUrl);
    const canvas = document.createElement("canvas");

    if (typeof canvas.toBlob !== "function") {
      if (file.size <= MAX_QUESTION_IMAGE_BYTES) {
        return dataUrl;
      }
      throw new Error("Unable to process image. Please upload a smaller file under 50KB.");
    }

    if (!canvas.getContext("2d")) {
      if (file.size <= MAX_QUESTION_IMAGE_BYTES) {
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
      if (file.size <= MAX_QUESTION_IMAGE_BYTES) {
        return dataUrl;
      }
      throw new Error("Unable to process image");
    }

    const minQuality = 0.2;

    while (blob.size > MAX_QUESTION_IMAGE_BYTES && quality > minQuality) {
      quality = Math.max(minQuality, quality - 0.1);
      const nextBlob = await createBlob(quality);
      if (!nextBlob) {
        break;
      }
      blob = nextBlob;
    }

    while (blob.size > MAX_QUESTION_IMAGE_BYTES && (width > 120 || height > 120)) {
      width = Math.max(120, Math.floor(width * 0.85));
      height = Math.max(120, Math.floor(height * 0.85));
      drawImage(width, height);
      quality = 0.9;
      let nextBlob = await createBlob(quality);
      if (!nextBlob) {
        break;
      }
      blob = nextBlob;
      while (blob.size > MAX_QUESTION_IMAGE_BYTES && quality > minQuality) {
        quality = Math.max(minQuality, quality - 0.1);
        const smallerBlob = await createBlob(quality);
        if (!smallerBlob) {
          break;
        }
        blob = smallerBlob;
      }
    }

    if (blob.size > MAX_QUESTION_IMAGE_BYTES) {
      throw new Error("Unable to compress image below 50KB. Try a smaller image.");
    }

    return await new Promise<string>((resolve, reject) => {
      const resultReader = new FileReader();
      resultReader.onload = () => resolve(resultReader.result as string);
      resultReader.onerror = () => reject(new Error("Failed to read compressed image"));
      resultReader.readAsDataURL(blob);
    });
  };

  const handleQuestionImageUpload = async (
    sectionId: string,
    questionId: string,
    file: File
  ) => {
    try {
      const compressed = await compressQuestionImage(file);
      updateQuestion(sectionId, questionId, { imageUrl: compressed });
    } catch (error) {
      console.error("Image compression failed:", error);
      showError(
        error instanceof Error ? error.message : "Failed to process image",
        "Image Upload Error"
      );
    }
  };

  const clearQuestionImage = (sectionId: string, questionId: string) => {
    updateQuestion(sectionId, questionId, { imageUrl: undefined });
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
    const section = form.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const parentQuestion = section.questions.find(
      (q) => q.id === parentQuestionId
    );
    if (!parentQuestion) return;

    const newFollowUpQuestion: FollowUpQuestion = {
      id: crypto.randomUUID(),
      text: "Follow-up Question",
      type: "text",
      required: false,
      description: "",
      imageUrl: "",
      subParam1: "",
      subParam2: "",
      parentId: parentQuestionId,
      showWhen: {
        questionId: parentQuestionId,
        value: triggerValue,
      },
    };

    const followUpConfig = {
      ...(parentQuestion.followUpConfig || {}),
    };

    if (parentQuestion.options && parentQuestion.options.length > 0) {
      parentQuestion.options.forEach((option) => {
        if (!followUpConfig[option]) {
          followUpConfig[option] = {
            hasFollowUp: false,
            required: false,
          };
        }
      });
    }

    if (!followUpConfig[triggerValue]) {
      followUpConfig[triggerValue] = {
        hasFollowUp: true,
        required: newFollowUpQuestion.required || false,
      };
    } else {
      followUpConfig[triggerValue] = {
        ...followUpConfig[triggerValue],
        hasFollowUp: true,
        required:
          newFollowUpQuestion.required ?? followUpConfig[triggerValue].required,
      };
    }

    const updatedParentQuestion = {
      ...parentQuestion,
      followUpQuestions: [
        ...(parentQuestion.followUpQuestions || []),
        newFollowUpQuestion,
      ],
      followUpConfig,
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
      imageUrl: "",
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

  const handleNestedFollowUpImageUpload = async (
    sectionId: string,
    followUpQuestionId: string,
    file: File,
    path: string[]
  ) => {
    try {
      const compressed = await compressQuestionImage(file);
      updateNestedFollowUpQuestion(
        sectionId,
        followUpQuestionId,
        { imageUrl: compressed },
        path
      );
    } catch (error) {
      console.error("Nested image compression failed:", error);
      showError(
        error instanceof Error ? error.message : "Failed to process image",
        "Image Upload Error"
      );
    }
  };

  const clearNestedFollowUpImage = (
    sectionId: string,
    followUpQuestionId: string,
    path: string[]
  ) => {
    updateNestedFollowUpQuestion(
      sectionId,
      followUpQuestionId,
      { imageUrl: undefined },
      path
    );
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
    if (question.type === "yesNoNA") return;

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
    if (question.type === "yesNoNA") return;

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
    if (question.type === "yesNoNA") return;

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
    return ["radio", "checkbox", "select", "search-select", "yesNoNA"].includes(
      type
    );
  };

  const handleQuestionTypeChange = (
    sectionId: string,
    questionId: string,
    currentQuestion: Question,
    newType: string
  ) => {
    const updates: Partial<Question> = { type: newType };

    if (newType === "yesNoNA") {
      updates.options = [...YES_NO_NA_OPTIONS];
      updates.correctAnswer = YES_NO_NA_CORRECT;
    } else if (requiresFollowUp(newType)) {
      const baseOptions =
        currentQuestion.type === "yesNoNA"
          ? undefined
          : currentQuestion.options;
      updates.options =
        baseOptions && baseOptions.length > 0
          ? baseOptions
          : ["Option 1", "Option 2"];
      if (currentQuestion.type === "yesNoNA") {
        updates.correctAnswer = undefined;
      }
    } else {
      updates.options = undefined;
      updates.correctAnswer = undefined;
      updates.followUpConfig = undefined;
    }

    if (newType === "file") {
      updates.allowedFileTypes =
        currentQuestion.allowedFileTypes && currentQuestion.allowedFileTypes.length > 0
          ? [...currentQuestion.allowedFileTypes]
          : ["image", "pdf", "excel"];
    } else if (currentQuestion.allowedFileTypes) {
      updates.allowedFileTypes = undefined;
    }

    updateQuestion(sectionId, questionId, updates);
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
      value: "boolean",
      label: "Yes/No",
      description: "Boolean true/false question",
    },
    {
      value: "radio",
      label: "Multiple Choice",
      description: "Select one option from many",
    },
    {
      value: "yesNoNA",
      label: "Yes / No / N/A",
      description: "Preset with Yes, No, and N/A options",
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
    {
      value: "slider-feedback",
      label: "Slider Feedback (1-10)",
      description: "Drag slider with emoji feedback",
    },
    {
      value: "emoji-star-feedback",
      label: "Star Rating Feedback",
      description: "5-star emoji rating",
    },
    {
      value: "emoji-reaction-feedback",
      label: "Emoji Reaction Feedback",
      description: "Emoji reactions (sad to laugh)",
    },
  ];

  const fileTypeOptions = [
    { value: "any", label: "Any file type" },
    { value: "image", label: "Images (JPG, PNG, GIF)" },
    { value: "pdf", label: "PDF" },
    { value: "excel", label: "Excel (XLS, XLSX)" },
  ];

  if (mode === "list") {
    return (
      <div className="p-4">
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
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg border border-neutral-200 dark:border-gray-700">
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
                className="bg-white dark:bg-gray-900 rounded-lg border border-neutral-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
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
    <div className="w-full overflow-auto bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 w-full">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/forms/management")}
                className="p-2 hover:bg-blue-50 dark:hover:bg-gray-800 rounded-lg transition-colors group"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                  {id ? "✏️ Edit Form" : "✨ Create New Form"}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Build amazing forms with ease
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate("/forms/management")}
                className="px-5 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={loadSampleData}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <FileText className="w-5 h-5" />
                Load Sample Data
              </button>
              <button
                onClick={handleExportTemplate}
                title="Export form template to Excel"
                className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Export Template
              </button>
              <div className="relative">
                <button
                  title="Import form template from Excel"
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                  onClick={(e) => {
                    const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                    input?.click();
                  }}
                >
                  <Upload className="w-5 h-5" />
                  Import Template
                </button>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportTemplate}
                  className="hidden"
                />
              </div>
              <button
                onClick={() => setShowParameterModal(true)}
                title="Create parameters for this form"
                className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Parameters
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

      <div className="w-full py-6 px-4 sm:py-8 sm:px-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Form Editor */}
          <div className="flex-1 space-y-6 min-w-0">
            {/* Form Details */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm border-l-4 border-l-blue-500 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-blue-50 dark:from-blue-950/60 dark:to-blue-900/60 px-6 py-4 border-b border-blue-100 dark:border-blue-900/60">
                <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100">
                  📋 Form Details
                </h2>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Set your form's basic information
                </p>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    Form Title *
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base font-medium"
                    placeholder="e.g., Customer Feedback Survey"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
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
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none text-sm"
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
                    className="ml-2 text-sm text-primary-700 dark:text-primary-200"
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
                    className="ml-2 text-sm text-primary-700 dark:text-primary-200"
                  >
                    Enable location tracking for responses
                  </label>
                </div>

                {/* Load Demo Data Button */}
                <div className="pt-4 border-t border-neutral-200 dark:border-gray-700">
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
              if (totalPages > 1) {
                const visiblePages = pages.slice(
                  pageWindowStart,
                  pageWindowStart + MAX_VISIBLE_PAGE_BUTTONS
                );
                const canScrollLeft = pageWindowStart > 0;
                const canScrollRight =
                  pageWindowStart + MAX_VISIBLE_PAGE_BUTTONS < totalPages;

                return (
                  <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-blue-200 dark:border-blue-900/60 p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Form Pages:
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setPageWindowStart((prev) => Math.max(0, prev - 1))
                          }
                          disabled={!canScrollLeft}
                          className="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-2">
                          {visiblePages.map((_, index) => {
                            const pageIndex = pageWindowStart + index;
                            const isActive = currentPage === pageIndex;

                            return (
                              <button
                                key={pageIndex}
                                onClick={() => handlePageChange(pageIndex)}
                                className={`w-10 h-10 rounded-lg font-bold text-sm transition-all duration-200 ${
                                  isActive
                                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-110"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                }`}
                              >
                                {pageIndex + 1}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() =>
                            setPageWindowStart((prev) => {
                              const maxStart = Math.max(
                                0,
                                totalPages - MAX_VISIBLE_PAGE_BUTTONS
                              );
                              return Math.min(prev + 1, maxStart);
                            })
                          }
                          disabled={!canScrollRight}
                          className="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Viewing Page {currentPage + 1} of {totalPages} · Each main
                      section is a separate page
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
                    className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden ${
                      section.isSubsection
                        ? "border-l-4 border-l-green-500 ml-6"
                        : "border-l-4 border-l-blue-500"
                    }`}
                  >
                    {/* Section Header */}
                    <div
                      className={`px-6 py-4 border-b ${
                        section.isSubsection
                          ? "bg-gradient-to-r from-green-50 to-teal-50 border-green-100 dark:from-green-950/60 dark:to-teal-900/60 dark:border-green-900/60"
                          : "bg-gradient-to-r from-blue-50 to-blue-50 border-blue-100 dark:from-blue-950/60 dark:to-blue-900/60 dark:border-blue-900/60"
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
                                  ? "text-green-900 dark:text-green-100"
                                  : "text-blue-900 dark:text-blue-100"
                              }`}
                            >
                              {section.isSubsection ? "Subsection" : "Section"}{" "}
                              {sectionLabel}
                              {section.title && (
                                <span
                                  className={`font-normal ml-2 ${
                                    section.isSubsection
                                      ? "text-green-600 dark:text-green-300"
                                      : "text-blue-600 dark:text-blue-300"
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
                                  ? "text-green-700 dark:text-green-300"
                                  : "text-blue-700 dark:text-blue-300"
                              }`}
                            >
                              {section.description}
                            </p>
                          )}
                          {section.isSubsection && section.parentSectionId && (
                            <p className="text-xs ml-11 text-green-600 dark:text-green-400 mt-2">
                              Merged with: <strong>{form.sections.find((s) => s.id === section.parentSectionId)?.title || "Parent Section"}</strong>
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
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
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
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                            placeholder="e.g., Personal Information, Contact Details"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                            Section Description (Optional)
                          </label>
                          <textarea
                            value={section.description}
                            onChange={(e) =>
                              updateSection(section.id, {
                                description: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-sm"
                            rows={2}
                            placeholder="Brief description for respondents"
                          />
                        </div>

                        {!section.isSubsection && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                              Section Weightage (%)
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={resolveSectionWeightageDraft(section)}
                                onChange={(e) =>
                                  setSectionWeightageDrafts((prev) => ({
                                    ...prev,
                                    [section.id]: e.target.value,
                                  }))
                                }
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                                placeholder="Enter weightage for this section"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveSectionWeightage(section.id)}
                                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                                  hasPendingWeightageChange(section)
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "bg-gray-200 text-gray-600 cursor-not-allowed"
                                }`}
                                disabled={!hasPendingWeightageChange(section)}
                              >
                                Save
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              Saved: {formatWeightageDisplay(getSavedSectionWeightage(section))}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Questions Container */}
                    <div className="p-6 space-y-5">
                      {/* Insert button at the beginning */}
                      {section.questions.length > 0 && (
                        <div className="flex justify-center -mb-3 relative z-10">
                          <button
                            onClick={() => insertQuestionAt(section.id, 0)}
                            className="group bg-white dark:bg-gray-900 border-2 border-dashed border-blue-300 rounded-full p-2 text-blue-400 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600 transition-all duration-200"
                            title="Insert question at the beginning"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      )}

                      {section.questions.map((question, questionIndex) => {
                        const selectedFileType = question.allowedFileTypes?.[0] ?? "any";
                        const selectedFileTypeOption = fileTypeOptions.find(
                          (option) => option.value === selectedFileType
                        );

                        return (
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
                            <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-lg hover:border-blue-300 transition-all duration-200">
                            {/* Question Header */}
                            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs shadow">
                                  {questionIndex + 1}
                                </div>
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
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
                              {/* Parameter Display */}
                              {question.subParam1 && (
                                <div className="mb-4">
                                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-300 dark:border-purple-600 rounded-lg">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                    <span className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                                      {question.subParam1}
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                                    Question Text (optional when using image)
                                  </label>
                                  <input
                                    type="text"
                                    value={question.text}
                                    onChange={(e) =>
                                      updateQuestion(section.id, question.id, {
                                        text: e.target.value,
                                      })
                                    }
                                    className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                    placeholder="Enter your question"
                                  />
                                  <div className="mt-3 space-y-3">
                                    {question.imageUrl ? (
                                      <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                                        <img
                                          src={question.imageUrl}
                                          alt={`Question ${questionIndex + 1} image`}
                                          className="h-20 w-20 object-contain rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => clearQuestionImage(section.id, question.id)}
                                          className="px-3 py-2 text-sm font-semibold text-red-600 hover:text-white hover:bg-red-500 border border-red-200 rounded-lg transition-colors"
                                        >
                                          Remove Image
                                        </button>
                                      </div>
                                    ) : null}
                                    <div className="flex flex-col gap-2">
                                      <label className="inline-flex items-center justify-center px-3 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer text-sm font-medium text-blue-600 hover:border-blue-400 hover:text-blue-700 transition-colors">
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              void handleQuestionImageUpload(
                                                section.id,
                                                question.id,
                                                file
                                              );
                                              e.target.value = "";
                                            }
                                          }}
                                        />
                                        Upload Image
                                      </label>
                                      <p className="text-xs text-gray-500 dark:text-gray-500">
                                        JPEG or PNG up to 50KB.
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                                    Question Type
                                  </label>
                                  <select
                                    value={question.type}
                                    onChange={(e) =>
                                      handleQuestionTypeChange(
                                        section.id,
                                        question.id,
                                        question,
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
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

                              {question.type === "file" ? (
                                <div className="mt-4">
                                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                                    Allowed file type
                                  </label>
                                  <select
                                    value={selectedFileType}
                                    onChange={(e) =>
                                      updateQuestion(section.id, question.id, {
                                        allowedFileTypes:
                                          e.target.value === "any"
                                            ? undefined
                                            : [e.target.value],
                                      })
                                    }
                                    className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                  >
                                    {fileTypeOptions.map((option) => (
                                      <option
                                        key={`${question.id}-file-type-${option.value}`}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                    {selectedFileType === "any"
                                      ? "Respondents can upload any file type."
                                      : `Respondents must upload files matching ${selectedFileTypeOption?.label}.`}
                                  </p>
                                </div>
                              ) : null}

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
                                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-all"
                                  />
                                  <span className="ml-2.5 text-sm text-gray-700 dark:text-gray-300 group-hover:text-blue-700 font-medium transition-colors">
                                    Required question
                                  </span>
                                </label>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                                    Sub Parameter 1
                                  </label>
                                  <select
                                    value={question.subParam1 || ""}
                                    onChange={(e) =>
                                      updateQuestion(section.id, question.id, {
                                        subParam1: e.target.value,
                                      })
                                    }
                                    className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm dark:bg-gray-800 dark:text-gray-100"
                                  >
                                    <option value="">-- Select Parameter --</option>
                                    {parameters
                                      .filter(param => param.type === 'main')
                                      .map((param) => (
                                        <option key={param.id} value={param.name}>
                                          {param.name} ({param.type})
                                        </option>
                                      ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                                    Sub Parameter 2
                                  </label>
                                  <select
                                    value={question.subParam2 || ""}
                                    onChange={(e) =>
                                      updateQuestion(section.id, question.id, {
                                        subParam2: e.target.value,
                                      })
                                    }
                                    className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm dark:bg-gray-800 dark:text-gray-100"
                                  >
                                    <option value="">-- Select Parameter --</option>
                                    {parameters
                                      .filter(param => param.type === 'followup')
                                      .map((param) => (
                                        <option key={param.id} value={param.name}>
                                          {param.name} ({param.type})
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              </div>

                              {(question.type === "radio" ||
                                question.type === "yesNoNA" ||
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
                                        const isYesNoNa =
                                          question.type === "yesNoNA";

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
                                              className="flex-1 px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 dark:bg-gray-700"
                                              placeholder={`Option ${
                                                index + 1
                                              }`}
                                              disabled={isYesNoNa}
                                              readOnly={isYesNoNa}
                                            />
                                            {!isYesNoNa && (
                                              <>
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
                                              </>
                                            )}

                                            {!isYesNoNa && (
                                              <div className="relative">
                                                <button
                                                  onClick={() =>
                                                    setOpenOptionMenu(
                                                      isMenuOpen
                                                        ? null
                                                        : menuKey
                                                    )
                                                  }
                                                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg transition-all"
                                                  title="Follow-up options"
                                                >
                                                  <MoreVertical className="w-5 h-5" />
                                                </button>

                                                {isMenuOpen && (
                                                  <>
                                                    <div
                                                      className="fixed inset-0 z-10"
                                                      onClick={() =>
                                                        setOpenOptionMenu(null)
                                                      }
                                                    />

                                                    <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20">
                                                      <div className="py-1">
                                                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase">
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
                                                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2"
                                                        >
                                                          <span className="text-lg">
                                                            📝
                                                          </span>
                                                          <div>
                                                            <div className="font-medium">
                                                              Follow-up Question
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-500">
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
                                                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-green-50 hover:text-green-600 transition-colors flex items-center gap-2"
                                                        >
                                                          <span className="text-lg">
                                                            📋
                                                          </span>
                                                          <div>
                                                            <div className="font-medium">
                                                              Follow-up Section
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-500">
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
                                                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2"
                                                        >
                                                          <span className="text-lg">
                                                            📄
                                                          </span>
                                                          <div>
                                                            <div className="font-medium">
                                                              Follow-up Form
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-500">
                                                              Link a form for
                                                              this option
                                                            </div>
                                                          </div>
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }
                                    )}
                                    {question.type !== "yesNoNA" && (
                                      <button
                                        onClick={() =>
                                          addOption(section.id, question.id)
                                        }
                                        className="flex items-center gap-2 px-4 py-2 text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-lg text-sm font-medium transition-all"
                                      >
                                        <Plus className="w-5 h-5" />
                                        Add Option
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Section Branching Configuration */}
                              {(question.type === "radio" ||
                                question.type === "checkbox" ||
                                question.type === "select" ||
                                question.type === "yesNoNA") &&
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
                                        <div className="text-xs text-purple-600 bg-white dark:bg-gray-900 rounded p-2">
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
                                question.type === "select" ||
                                question.type === "yesNoNA") &&
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
                                      <div className="flex items-center gap-2">
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
                                        {question.options && question.options.length > 0 && (
                                          <div className="relative">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setOpenOptionMenu((current) =>
                                                  current === `${section.id}-${question.id}-followup-quick-add`
                                                    ? null
                                                    : `${section.id}-${question.id}-followup-quick-add`
                                                )
                                              }
                                              className="px-3 py-1.5 text-sm font-medium text-green-700 bg-white dark:bg-gray-900 border border-green-200 hover:border-green-300 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-1"
                                            >
                                              <MessageSquarePlus className="w-4 h-4" />
                                              Add Follow-up Question
                                            </button>
                                            {openOptionMenu === `${section.id}-${question.id}-followup-quick-add` && (
                                              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-green-200 bg-white dark:bg-gray-900 shadow-lg z-20">
                                                <div className="py-2">
                                                  {question.options.map((option) => (
                                                    <button
                                                      key={option}
                                                      type="button"
                                                      onClick={() => {
                                                        addFollowUpQuestion(
                                                          section.id,
                                                          question.id,
                                                          option
                                                        );
                                                        setOpenOptionMenu(null);
                                                      }}
                                                      className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50"
                                                    >
                                                      {option}
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
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
                                        <div className="text-xs text-green-600 bg-white dark:bg-gray-900 rounded p-2">
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
                                question.type === "select" ||
                                question.type === "yesNoNA") &&
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
                              {question.followUpQuestions &&
                                question.followUpQuestions.length > 0 && (
                                  <div className="mt-6">
                                    <NestedFollowUpRenderer
                                      followUpQuestions={
                                        question.followUpQuestions || []
                                      }
                                      sectionId={section.id}
                                      parentQuestion={{
                                        id: question.id,
                                        options: question.options,
                                      }}
                                      path={[question.id]}
                                      parameters={parameters}
                                      onUpdate={(
                                        nestedSectionId,
                                        followUpQuestionId,
                                        updates,
                                        nestedPath
                                      ) =>
                                        updateNestedFollowUpQuestion(
                                          nestedSectionId,
                                          followUpQuestionId,
                                          updates,
                                          nestedPath
                                        )
                                      }
                                      onImageUpload={(
                                        nestedSectionId,
                                        followUpQuestionId,
                                        file,
                                        nestedPath
                                      ) =>
                                        handleNestedFollowUpImageUpload(
                                          nestedSectionId,
                                          followUpQuestionId,
                                          file,
                                          nestedPath
                                        )
                                      }
                                      onImageRemove={(
                                        nestedSectionId,
                                        followUpQuestionId,
                                        nestedPath
                                      ) =>
                                        clearNestedFollowUpImage(
                                          nestedSectionId,
                                          followUpQuestionId,
                                          nestedPath
                                        )
                                      }
                                      onDelete={(
                                        nestedSectionId,
                                        followUpQuestionId,
                                        nestedPath
                                      ) =>
                                        deleteNestedFollowUpQuestion(
                                          nestedSectionId,
                                          followUpQuestionId,
                                          nestedPath
                                        )
                                      }
                                      onAddNested={(
                                        nestedSectionId,
                                        parentFollowUpId,
                                        triggerValue,
                                        nestedPath
                                      ) =>
                                        addNestedFollowUpQuestion(
                                          nestedSectionId,
                                          parentFollowUpId,
                                          triggerValue,
                                          nestedPath
                                        )
                                      }
                                      onAddOption={(
                                        nestedSectionId,
                                        followUpQuestionId,
                                        nestedPath
                                      ) =>
                                        addNestedFollowUpOption(
                                          nestedSectionId,
                                          followUpQuestionId,
                                          nestedPath
                                        )
                                      }
                                      onUpdateOption={(
                                        nestedSectionId,
                                        followUpQuestionId,
                                        optionIndex,
                                        value,
                                        nestedPath
                                      ) =>
                                        updateNestedFollowUpOption(
                                          nestedSectionId,
                                          followUpQuestionId,
                                          optionIndex,
                                          value,
                                          nestedPath
                                        )
                                      }
                                      onRemoveOption={(
                                        nestedSectionId,
                                        followUpQuestionId,
                                        optionIndex,
                                        nestedPath
                                      ) =>
                                        removeNestedFollowUpOption(
                                          nestedSectionId,
                                          followUpQuestionId,
                                          optionIndex,
                                          nestedPath
                                        )
                                      }
                                      onAddFollowUpSection={handleAddFollowUpSection}
                                      onAddFollowUpForm={handleAddFollowUpForm}
                                      questionTypes={questionTypes}
                                    />
                                  </div>
                                )}
                            </div>
                          </div>
                          </React.Fragment>
                        );
                      })}

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
                            <p className="text-sm text-gray-600 dark:text-gray-400">
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
                  handlePageChange(totalPages, totalPages + 1);
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
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
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
                      <div className="bg-white dark:bg-gray-900 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
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
          <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
            {/* Sticky Page Navigation */}
            {(() => {
              const pages = getPagesFromSections();
              if (pages.length > 1) {
                return (
                  <div className="sticky top-1/2 -translate-y-1/2 h-0">
                    <div className="bg-white dark:bg-gray-900 rounded-lg border-2 border-blue-200 shadow-lg p-4 -translate-y-1/2">
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

                          const sectionWeightage =
                            typeof mainSection?.weightage === "number" &&
                            !Number.isNaN(mainSection.weightage)
                              ? mainSection.weightage
                              : null;

                          return (
                            <button
                              key={pageIndex}
                              type="button"
                              onClick={() => handlePageChange(pageIndex)}
                              className={`
                                w-full p-3 rounded-lg text-left transition-all duration-200
                                ${
                                  isCurrent
                                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md scale-105"
                                    : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                                }
                              `}
                              title={
                                mainSection?.title?.trim().length
                                  ? mainSection.title
                                  : `Page ${pageIndex + 1}`
                              }
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`
                                    flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0
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
                                  <p
                                    className={`text-sm font-bold truncate ${
                                      isCurrent ? "text-white" : "text-blue-900"
                                    }`}
                                  >
                                    {mainSection?.title?.trim().length
                                      ? mainSection.title
                                      : `Page ${pageIndex + 1}`}
                                  </p>
                                  <p
                                    className={`text-xs ${
                                      isCurrent ? "text-blue-100" : "text-blue-600"
                                    }`}
                                  >
                                    {questionCount} {questionCount === 1 ? "question" : "questions"}
                                  </p>
                                  {sectionWeightage !== null && (
                                    <p
                                      className={`text-xs font-medium ${
                                        isCurrent ? "text-blue-100" : "text-blue-500"
                                      }`}
                                    >
                                      Weightage: {Number(sectionWeightage).toFixed(1).replace(/\.0$/, "")}%
                                    </p>
                                  )}
                                  {page.filter((s) => s.isSubsection).length > 0 && (
                                    <div className={`text-xs mt-2 pt-2 border-t ${
                                      isCurrent ? "border-blue-400" : "border-blue-200"
                                    }`}>
                                      <p className={`font-semibold mb-1 ${
                                        isCurrent ? "text-blue-100" : "text-green-700"
                                      }`}>
                                        Merged:
                                      </p>
                                      {page.filter((s) => s.isSubsection).map((subsection) => (
                                        <p key={subsection.id} className={`ml-2 ${
                                          isCurrent ? "text-blue-100" : "text-green-600"
                                        }`}>
                                          • {subsection.title || "Subsection"}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {(() => {
                                    const routings = [];
                                    page.forEach((section) => {
                                      section.questions.forEach((question) => {
                                        if (question.branchingRules && question.branchingRules.length > 0) {
                                          question.branchingRules.forEach((rule) => {
                                            const targetSection = form.sections.find((s) => s.id === rule.targetSectionId);
                                            if (targetSection) {
                                              routings.push({
                                                from: section.title || `Section ${pageIndex + 1}`,
                                                option: rule.optionLabel,
                                                to: targetSection.title || "Unknown"
                                              });
                                            }
                                          });
                                        }
                                      });
                                    });
                                    
                                    return routings.length > 0 ? (
                                      <div className={`text-xs mt-2 pt-2 border-t ${
                                        isCurrent ? "border-blue-400" : "border-purple-200"
                                      }`}>
                                        <p className={`font-semibold mb-1 ${
                                          isCurrent ? "text-blue-100" : "text-purple-700"
                                        }`}>
                                          🔀 Routes:
                                        </p>
                                        {routings.map((routing, idx) => (
                                          <p key={idx} className={`ml-2 text-xs leading-tight ${
                                            isCurrent ? "text-blue-100" : "text-purple-600"
                                          }`}>
                                            "{routing.option}" → {routing.to}
                                          </p>
                                        ))}
                                      </div>
                                    ) : null;
                                  })()}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="bg-white dark:bg-gray-900 rounded-lg border border-blue-100 shadow p-4">
              <h3 className="text-sm font-bold text-blue-900 mb-3">Form Statistics</h3>
              <div className="space-y-2 text-xs text-blue-700">
                <div className="flex items-center justify-between">
                  <span>Sections</span>
                  <span>{form.sections.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Questions</span>
                  <span>
                    {form.sections.reduce(
                      (total, section) => total + section.questions.length,
                      0
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Follow-ups</span>
                  <span>
                    {form.sections.reduce((total, section) => {
                      const countQuestions = (questions: (Question | FollowUpQuestion)[]): number =>
                        questions.reduce((count, q) => {
                          const nested = q.followUpQuestions
                            ? countQuestions(q.followUpQuestions)
                            : 0;
                          return count + (q.followUpQuestions?.length || 0) + nested;
                        }, 0);

                      return total + countQuestions(section.questions);
                    }, 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total weightage</span>
                  <span>
                    {form.sections
                      .reduce((sum, section) => sum + (section.weightage || 0), 0)
                      .toFixed(1)
                      .replace(/\.0$/, "")}
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Parameter Modal */}
      <ParameterModal
        isOpen={showParameterModal}
        onClose={() => setShowParameterModal(false)}
        formId={id}
        existingParameters={id ? undefined : tempParameters}
        onParameterCreated={async (createdParams) => {
          if (id) {
            // For existing forms, refresh from API
            try {
              const response = await apiClient.getParameters({ formId: id });
              setParameters(response.parameters || []);
            } catch (error) {
              console.error("Failed to refresh parameters:", error);
            }
          } else {
            // For new forms, store temporarily
            setTempParameters(createdParams || []);
          }
        }}
      />

      {/* Section Branching Config Modal */}
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

      {/* Form Routing Config Modal */}
      {showFormRoutingConfig && formRoutingConfigQuestion && (
        <FormRoutingConfig
          questionId={formRoutingConfigQuestion.questionId}
          sectionId={formRoutingConfigQuestion.sectionId}
          options={formRoutingConfigQuestion.options}
          availableForms={forms.map((f) => ({ id: f.id, title: f.title }))}
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
