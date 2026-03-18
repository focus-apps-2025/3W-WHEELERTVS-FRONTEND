import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Save,
  Eye,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  CheckCircle,
  MoreVertical,
} from "lucide-react";
import {
  getLevel1Options,
  getLevel2Options,
  getLevel3Options,
  getLevel4Options,
  getLevel5Options,
  getLevel6Options,
} from "../../config/npsHierarchy";

interface FormSection {
  id: string;
  title: string;
  description: string;
  weightage?: number;
  questions: FormQuestion[];
}

interface FollowUpQuestion {
  id: string;
  text: string;
  type: string;
  required: boolean;
  trackResponseRank?: boolean;
  options?: string[];
  parentId: string;
  showWhen?: {
    questionId: string;
    value: string;
  };
}

interface FormQuestion {
  id: string;
  text: string;
  type: "text" | "radio" | "paragraph" | "checkbox" | "select" | "search-select" | "yesNoNA" | "productNPSTGWBuckets";
  required: boolean;
  trackResponseRank?: boolean;
  options?: string[];
  followUpQuestions?: FollowUpQuestion[];
  followUpConfig?: Record<
    string,
    {
      hasFollowUp: boolean;
      required: boolean;
      linkedFormId?: string;
      goToSection?: string;
    }
  >;
}

interface FormData {
  title: string;
  description: string;
  isPublic: boolean;
  sections: FormSection[];
  showMarksToCustomer?: boolean;
  marksPerQuestion?: number;
}

interface MultipleChoiceFormBuilderProps {
  onFormCreated?: (form: FormData) => void;
  onPreview?: (form: FormData) => void;
  initialData?: Partial<FormData>;
}

const YES_NO_NA_OPTIONS = ["Yes", "No", "N/A"];

const DEFAULT_FORM_DATA: FormData = {
  title: "Comprehensive Assessment Form",
  description:
    "Complete form with 5 sections covering different question types",
  isPublic: false,
  showMarksToCustomer: false,
  marksPerQuestion: 1,
  sections: [
    {
      id: "section1",
      title: "Section 1: Basic Information",
      description: "Collect basic details and preferences",
      weightage: 20,
      questions: [
        {
          id: "q1",
          text: "What is your name?",
          type: "text",
          required: true,
        },
        {
          id: "q2",
          text: "What is your email address?",
          type: "text",
          required: true,
        },
        {
          id: "q3",
          text: "Have you used our service before?",
          type: "yesNoNA",
          required: true,
          followUpQuestions: [
            {
              id: "fup-q3-1",
              text: "How would you rate your previous experience?",
              type: "select",
              required: false,
              options: ["Excellent", "Good", "Average", "Poor"],
              parentId: "q3",
              showWhen: { questionId: "q3", value: "Yes" },
            },
          ],
        },
        {
          id: "q4",
          text: "What is your primary reason for visiting?",
          type: "radio",
          required: true,
          options: ["Product Purchase", "Support", "Information", "Feedback"],
          followUpConfig: {
            "Product Purchase": { hasFollowUp: true, required: false },
            Support: { hasFollowUp: true, required: false },
          },
          followUpQuestions: [
            {
              id: "fup-q4-1",
              text: "Which product category interests you?",
              type: "radio",
              required: false,
              options: ["Electronics", "Clothing", "Home & Garden", "Sports"],
              parentId: "q4",
              showWhen: { questionId: "q4", value: "Product Purchase" },
            },
            {
              id: "fup-q4-2",
              text: "What issue are you experiencing?",
              type: "paragraph",
              required: false,
              parentId: "q4",
              showWhen: { questionId: "q4", value: "Support" },
            },
          ],
        },
        {
          id: "q5",
          text: "Please provide any additional comments",
          type: "paragraph",
          required: false,
        },
      ],
    },
    {
      id: "section2",
      title: "Section 2: Product/Service Evaluation",
      description: "Evaluate your satisfaction and experience",
      weightage: 20,
      questions: [
        {
          id: "q6",
          text: "How satisfied are you with the product quality?",
          type: "select",
          required: true,
          options: [
            "Very Satisfied",
            "Satisfied",
            "Neutral",
            "Dissatisfied",
            "Very Dissatisfied",
          ],
        },
        {
          id: "q7",
          text: "Does the product meet your expectations?",
          type: "yesNoNA",
          required: true,
          followUpQuestions: [
            {
              id: "fup-q7-1",
              text: "What specific improvements would you suggest?",
              type: "paragraph",
              required: false,
              parentId: "q7",
              showWhen: { questionId: "q7", value: "No" },
            },
          ],
        },
        {
          id: "q8",
          text: "Select all features you find useful",
          type: "checkbox",
          required: false,
          options: [
            "Easy to Use",
            "Fast Performance",
            "Good Design",
            "Reliable",
            "Cost Effective",
          ],
        },
        {
          id: "q9",
          text: "Would you recommend this to others?",
          type: "yesNoNA",
          required: true,
          followUpQuestions: [
            {
              id: "fup-q9-1",
              text: "Why would you recommend it?",
              type: "paragraph",
              required: false,
              parentId: "q9",
              showWhen: { questionId: "q9", value: "Yes" },
            },
            {
              id: "fup-q9-2",
              text: "Why not? What would convince you?",
              type: "paragraph",
              required: false,
              parentId: "q9",
              showWhen: { questionId: "q9", value: "No" },
            },
          ],
        },
        {
          id: "q10",
          text: "Which pricing tier interests you?",
          type: "radio",
          required: false,
          options: ["Basic", "Standard", "Premium", "Enterprise"],
          followUpConfig: {
            Enterprise: { hasFollowUp: true, required: false },
          },
          followUpQuestions: [
            {
              id: "fup-q10-1",
              text: "How many users will your organization have?",
              type: "select",
              required: false,
              options: ["1-10", "11-50", "51-100", "100+"],
              parentId: "q10",
              showWhen: { questionId: "q10", value: "Enterprise" },
            },
          ],
        },
      ],
    },
    {
      id: "section3",
      title: "Section 3: Customer Support Experience",
      description: "Feedback on support services",
      weightage: 20,
      questions: [
        {
          id: "q11",
          text: "Did you contact our support team?",
          type: "yesNoNA",
          required: true,
          followUpQuestions: [
            {
              id: "fup-q11-1",
              text: "How would you rate their responsiveness?",
              type: "select",
              required: false,
              options: ["Very Fast", "Fast", "Acceptable", "Slow", "Very Slow"],
              parentId: "q11",
              showWhen: { questionId: "q11", value: "Yes" },
            },
            {
              id: "fup-q11-2",
              text: "Did they resolve your issue?",
              type: "yesNoNA",
              required: false,
              parentId: "q11",
              showWhen: { questionId: "q11", value: "Yes" },
            },
          ],
        },
        {
          id: "q12",
          text: "How would you prefer to contact support?",
          type: "checkbox",
          required: true,
          options: ["Phone", "Email", "Live Chat", "Social Media", "In-Person"],
        },
        {
          id: "q13",
          text: "What channel did you use?",
          type: "radio",
          required: false,
          options: ["Phone", "Email", "Live Chat", "Social Media", "In-Person"],
          followUpConfig: {},
        },
        {
          id: "q14",
          text: "Was the support representative knowledgeable?",
          type: "yesNoNA",
          required: false,
        },
        {
          id: "q15",
          text: "Any suggestions for improving support?",
          type: "paragraph",
          required: false,
        },
      ],
    },
    {
      id: "section4",
      title: "Section 4: Purchase & Billing",
      description: "Questions about purchasing and billing experience",
      weightage: 20,
      questions: [
        {
          id: "q16",
          text: "Have you made a purchase?",
          type: "yesNoNA",
          required: true,
          followUpQuestions: [
            {
              id: "fup-q16-1",
              text: "How many times have you purchased?",
              type: "select",
              required: false,
              options: ["1 time", "2-3 times", "4-5 times", "6+ times"],
              parentId: "q16",
              showWhen: { questionId: "q16", value: "Yes" },
            },
            {
              id: "fup-q16-2",
              text: "What prevented you from purchasing?",
              type: "paragraph",
              required: false,
              parentId: "q16",
              showWhen: { questionId: "q16", value: "No" },
            },
          ],
        },
        {
          id: "q17",
          text: "Was the checkout process easy?",
          type: "yesNoNA",
          required: false,
        },
        {
          id: "q18",
          text: "Which payment methods do you prefer?",
          type: "checkbox",
          required: true,
          options: [
            "Credit Card",
            "Debit Card",
            "PayPal",
            "Bank Transfer",
            "Digital Wallet",
          ],
        },
        {
          id: "q19",
          text: "How did you hear about us?",
          type: "radio",
          required: true,
          options: [
            "Search Engine",
            "Social Media",
            "Friend/Family",
            "Advertisement",
            "Other",
          ],
          followUpConfig: {
            Other: { hasFollowUp: true, required: false },
          },
          followUpQuestions: [
            {
              id: "fup-q19-1",
              text: "Please specify the source",
              type: "text",
              required: false,
              parentId: "q19",
              showWhen: { questionId: "q19", value: "Other" },
            },
          ],
        },
        {
          id: "q20",
          text: "Are you interested in our newsletter?",
          type: "yesNoNA",
          required: false,
        },
      ],
    },
    {
      id: "section5",
      title: "Section 5: Overall Feedback & Future",
      description: "Summary feedback and future engagement",
      weightage: 20,
      questions: [
        {
          id: "q21",
          text: "Overall, how would you rate your experience?",
          type: "select",
          required: true,
          options: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        },
        {
          id: "q22",
          text: "Would you use our service again?",
          type: "yesNoNA",
          required: true,
          followUpQuestions: [
            {
              id: "fup-q22-1",
              text: "What would make you come back?",
              type: "paragraph",
              required: false,
              parentId: "q22",
              showWhen: { questionId: "q22", value: "Maybe" },
            },
          ],
        },
        {
          id: "q23",
          text: "What aspect impressed you the most?",
          type: "checkbox",
          required: false,
          options: [
            "Product Quality",
            "Pricing",
            "Customer Service",
            "Delivery Speed",
            "User Experience",
          ],
        },
        {
          id: "q24",
          text: "What needs improvement?",
          type: "radio",
          required: false,
          options: [
            "Product Range",
            "Pricing",
            "Delivery",
            "Website",
            "Customer Service",
          ],
        },
        {
          id: "q25",
          text: "Any final comments or feedback?",
          type: "paragraph",
          required: false,
        },
      ],
    },
  ],
};

export const MultipleChoiceFormBuilder: React.FC<
  MultipleChoiceFormBuilderProps
> = ({ onFormCreated, onPreview, initialData }) => {
  const [formData, setFormData] = useState<FormData>(() => ({
    ...DEFAULT_FORM_DATA,
    ...initialData,
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sectionModal, setSectionModal] = useState<{
    isOpen: boolean;
    sectionIndex: number;
    questionIndex: number;
    option: string;
  } | null>(null);
  const [openOptionMenu, setOpenOptionMenu] = useState<string | null>(null);
  const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    sectionRefs.current.length = formData.sections.length;
    setActiveSectionIndex((prev) =>
      Math.min(prev, Math.max(formData.sections.length - 1, 0))
    );
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = sectionRefs.current.findIndex(
              (section) => section === entry.target
            );
            if (index !== -1) {
              setActiveSectionIndex(index);
            }
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0.1 }
    );
    sectionRefs.current.forEach((section) => {
      if (section) {
        observer.observe(section);
      }
    });
    return () => {
      observer.disconnect();
    };
  }, [formData.sections.length]);

  const handleSectionNavigate = (index: number) => {
    const target = sectionRefs.current[index];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSectionIndex(index);
    }
  };

  const handleFormFieldChange = <K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSectionChange = <K extends keyof FormSection>(
    sectionIndex: number,
    field: K,
    value: FormSection[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, index) =>
        index === sectionIndex ? { ...section, [field]: value } : section
      ),
    }));
  };

  const totalWeightage = useMemo(() => {
    return formData.sections.reduce(
      (sum, section) => sum + (section.weightage || 0),
      0
    );
  }, [formData.sections]);

  const handleQuestionChange = <K extends keyof FormQuestion>(
    sectionIndex: number,
    questionIndex: number,
    field: K,
    value: FormQuestion[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((question, qIndex) =>
                qIndex === questionIndex
                  ? { ...question, [field]: value }
                  : question
              ),
            }
          : section
      ),
    }));
  };

  const addSection = () => {
    const newSectionId = `section${formData.sections.length + 1}`;
    const newSection: FormSection = {
      id: newSectionId,
      title: "",
      description: "",
      questions: [
        {
          id: `q${Date.now()}`,
          text: "",
          type: "text",
          required: false,
        },
      ],
    };

    setFormData((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
  };

  const removeSection = (sectionIndex: number) => {
    if (formData.sections.length <= 1) {
      setError("At least one section is required");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, index) => index !== sectionIndex),
    }));
  };

  const addQuestion = (sectionIndex: number) => {
    const newQuestion: FormQuestion = {
      id: `q${Date.now()}`,
      text: "",
      type: "text",
      required: false,
      trackResponseRank: true,
    };

    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              questions: [...section.questions, newQuestion],
            }
          : section
      ),
    }));
  };

  const isYesNoNAType = (type: string): boolean => type === "yesNoNA";

  const removeQuestion = (sectionIndex: number, questionIndex: number) => {
    const section = formData.sections[sectionIndex];
    if (section.questions.length <= 1) {
      setError("At least one question is required per section");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((sec, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...sec,
              questions: sec.questions.filter(
                (_, qIndex) => qIndex !== questionIndex
              ),
            }
          : sec
      ),
    }));
  };

  const addOption = (sectionIndex: number, questionIndex: number) => {
    const question = formData.sections[sectionIndex].questions[questionIndex];
    if (!question.options || question.type === "yesNoNA") return;

    const newOption = `Option ${question.options.length + 1}`;

    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      options: [...(q.options || []), newOption],
                      followUpConfig: {
                        ...(q.followUpConfig || {}),
                        [newOption]: { hasFollowUp: false, required: false },
                      },
                    }
                  : q
              ),
            }
          : section
      ),
    }));
  };

  const removeOption = (
    sectionIndex: number,
    questionIndex: number,
    optionIndex: number
  ) => {
    const question = formData.sections[sectionIndex].questions[questionIndex];
    if (
      !question.options ||
      question.options.length <= 2 ||
      question.type === "yesNoNA"
    ) {
      if (question.type !== "yesNoNA") {
        setError("Minimum 2 options required");
      }
      return;
    }

    const optionToRemove = question.options[optionIndex];
    const newOptions = question.options.filter(
      (_, index) => index !== optionIndex
    );
    const newFollowUpConfig = { ...question.followUpConfig };
    delete newFollowUpConfig[optionToRemove];

    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      options: newOptions,
                      followUpConfig: newFollowUpConfig,
                    }
                  : q
              ),
            }
          : section
      ),
    }));
  };

  const updateOption = (
    sectionIndex: number,
    questionIndex: number,
    optionIndex: number,
    newValue: string
  ) => {
    const question = formData.sections[sectionIndex].questions[questionIndex];
    if (!question.options) return;

    const oldValue = question.options[optionIndex];
    const newOptions = question.options.map((option, index) =>
      index === optionIndex ? newValue : option
    );

    // Update follow-up config keys
    const newFollowUpConfig = { ...question.followUpConfig };
    if (oldValue in newFollowUpConfig && oldValue !== newValue) {
      newFollowUpConfig[newValue] = newFollowUpConfig[oldValue];
      delete newFollowUpConfig[oldValue];
    }

    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      options: newOptions,
                      followUpConfig: newFollowUpConfig,
                    }
                  : q
              ),
            }
          : section
      ),
    }));
  };

  const addFollowUp = (
    sectionIndex: number,
    questionIndex: number,
    option: string
  ) => {
    const question = formData.sections[sectionIndex].questions[questionIndex];

    // Create a new follow-up question
    const newFollowUp: FollowUpQuestion = {
      id: `followup-${Date.now()}`,
      text: `Follow-up for "${option}"`,
      type: "shortText",
      required: false,
      trackResponseRank: true,
      parentId: question.id,
      showWhen: {
        questionId: question.id,
        value: option,
      },
    };

    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      followUpQuestions: [
                        ...(q.followUpQuestions || []),
                        newFollowUp,
                      ],
                      followUpConfig: {
                        ...(q.followUpConfig || {}),
                        [option]: { hasFollowUp: true, required: false },
                      },
                    }
                  : q
              ),
            }
          : section
      ),
    }));
  };

  const linkFollowUpSection = (
    sectionIndex: number,
    questionIndex: number,
    option: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      followUpConfig: {
                        ...Object.keys(q.followUpConfig || {}).reduce(
                          (acc, key) => ({
                            ...acc,
                            [key]: {
                              hasFollowUp: false,
                              required: false,
                              linkedFormId: undefined,
                            },
                          }),
                          {}
                        ),
                        [option]: {
                          hasFollowUp: true,
                          required: false,
                          linkedFormId: undefined,
                        },
                      },
                    }
                  : q
              ),
            }
          : section
      ),
    }));
  };

  const linkFollowUpForm = (
    sectionIndex: number,
    questionIndex: number,
    option: string,
    linkedFormId: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      followUpConfig: {
                        ...q.followUpConfig,
                        [option]: {
                          ...(q.followUpConfig?.[option] || {
                            hasFollowUp: false,
                            required: false,
                          }),
                          linkedFormId: linkedFormId || undefined,
                        },
                      },
                    }
                  : q
              ),
            }
          : section
      ),
    }));
  };

  const updateGoToSection = (
    sectionIndex: number,
    questionIndex: number,
    option: string,
    targetSectionId: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      followUpConfig: {
                        ...q.followUpConfig,
                        [option]: {
                          ...(q.followUpConfig?.[option] || {
                            hasFollowUp: false,
                            required: false,
                          }),
                          goToSection: targetSectionId || undefined,
                        },
                      },
                    }
                  : q
              ),
            }
          : section
      ),
    }));
  };

  const updateFollowUp = (
    sectionIndex: number,
    questionIndex: number,
    followUpIndex: number,
    field: keyof FollowUpQuestion,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      followUpQuestions: q.followUpQuestions?.map(
                        (fq, fqIndex) =>
                          fqIndex === followUpIndex
                            ? { ...fq, [field]: value }
                            : fq
                      ),
                    }
                  : q
              ),
            }
          : section
      ),
    }));
  };

  const removeFollowUp = (
    sectionIndex: number,
    questionIndex: number,
    followUpIndex: number
  ) => {
    const question = formData.sections[sectionIndex].questions[questionIndex];
    const followUpToRemove = question.followUpQuestions?.[followUpIndex];

    if (!followUpToRemove) return;

    const option = followUpToRemove.showWhen?.value as string;
    const newFollowUpConfig = { ...question.followUpConfig };
    if (option) {
      delete newFollowUpConfig[option];
    }

    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      followUpQuestions: q.followUpQuestions?.filter(
                        (_, fqIndex) => fqIndex !== followUpIndex
                      ),
                      followUpConfig: newFollowUpConfig,
                    }
                  : q
              ),
            }
          : section
      ),
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setError("Form title is required");
      return false;
    }

    if (!formData.description.trim()) {
      setError("Form description is required");
      return false;
    }

    // Validate each section and question
    for (const section of formData.sections) {
      for (const question of section.questions) {
        if (
          question.type === "radio" ||
          question.type === "checkbox" ||
          question.type === "select" ||
          question.type === "search-select" ||
          question.type === "yesNoNA"
        ) {
          if (!question.options || question.options.length < 2) {
            setError(
              `${
                question.type === "checkbox"
                  ? "Checkbox"
                  : question.type === "select" ||
                    question.type === "search-select"
                  ? "Dropdown"
                  : question.type === "yesNoNA"
                  ? "Yes/No/N/A"
                  : "Multiple choice"
              } questions must have at least 2 options`
            );
            return false;
          }

          if (question.options.some((option) => !option.trim())) {
            setError("All options must have text");
            return false;
          }

          // Check for duplicates
          const optionSet = new Set(
            question.options.map((opt) => opt.trim().toLowerCase())
          );
          if (optionSet.size !== question.options.length) {
            setError("All options must be unique");
            return false;
          }
        }
      }
    }

    // Validate section weightage (if any section has weightage, total must be 100)
    const totalWeightage = formData.sections.reduce(
      (sum, s) => sum + (s.weightage || 0),
      0
    );
    if (totalWeightage > 0 && Math.abs(totalWeightage - 100) > 0.1) {
      setError(
        `Section weightage must add up to 100%. Current total: ${totalWeightage.toFixed(
          1
        )}%`
      );
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSuccess("Form saved successfully!");
      if (onFormCreated) {
        onFormCreated(formData);
      }

      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError("Failed to save form");
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    if (!validateForm()) return;
    if (onPreview) {
      onPreview(formData);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {formData.sections.length > 0 && (
          <nav className="md:w-28 md:flex-shrink-0">
            <div className="sticky top-1/2 -translate-y-1/2 transform bg-white dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-3 shadow-lg flex flex-col items-center gap-3">
              <div className="w-full px-2 pb-3 border-b border-gray-200 dark:border-gray-700 text-center">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Weightage
                </p>
                <p
                  className={`mt-1 text-sm font-bold ${
                    totalWeightage === 100
                      ? "text-green-600"
                      : totalWeightage > 0
                      ? "text-orange-600"
                      : "text-gray-500"
                  }`}
                >
                  {totalWeightage.toFixed(1)}%
                </p>
              </div>

              <div className="w-full space-y-2">
                {formData.sections.map((section, index) => {
                  const sectionWeight = section.weightage || 0;
                  const isActive = activeSectionIndex === index;
                  const hasWeight = sectionWeight > 0;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => handleSectionNavigate(index)}
                      title={section.title || `Section ${index + 1}`}
                      aria-label={section.title || `Section ${index + 1}`}
                      aria-current={isActive ? "step" : undefined}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all border ${
                        isActive
                          ? "bg-blue-600 text-white border-blue-600 shadow-lg scale-[1.02]"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                            isActive
                              ? "bg-white text-blue-600 border-blue-500"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="text-left line-clamp-2 leading-tight">
                          {section.title || `Section ${index + 1}`}
                        </span>
                      </span>
                      <span
                        className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          hasWeight
                            ? isActive
                              ? "bg-white/20 text-white border border-white/60"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-gray-100 text-gray-500 border border-gray-200"
                        }`}
                      >
                        {hasWeight ? `${sectionWeight.toFixed(1)}%` : "0%"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {totalWeightage !== 100 && totalWeightage > 0 && (
                <div className="w-full mt-2 text-center text-[11px] font-medium text-orange-600">
                  Adjust sections to total 100%
                </div>
              )}
            </div>
          </nav>
        )}
        <div className="flex-1">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                Customer Service Request Form Builder
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Create a comprehensive form with sections and multiple choice
                questions
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

            <div className="space-y-8">
              {/* Form Details */}
              <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                  Form Details
                </h3>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="form-title"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Form Title *
                    </label>
                    <input
                      id="form-title"
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        handleFormFieldChange("title", e.target.value)
                      }
                      placeholder="Enter form title (e.g., 'Customer Service Request')"
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="form-description"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Description
                    </label>
                    <textarea
                      id="form-description"
                      value={formData.description}
                      onChange={(e) =>
                        handleFormFieldChange("description", e.target.value)
                      }
                      placeholder="Describe your form purpose (e.g., 'Collect customer feedback and service requests')"
                      rows={3}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      id="public-visibility"
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={(e) =>
                        handleFormFieldChange("isPublic", e.target.checked)
                      }
                      className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="public-visibility"
                      className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                    >
                      Make form publicly visible
                    </label>
                  </div>

                  {/* Marks Visibility Settings */}
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                      Marks & Scoring Settings
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          id="show-marks-to-customer"
                          type="checkbox"
                          checked={formData.showMarksToCustomer || false}
                          onChange={(e) =>
                            handleFormFieldChange(
                              "showMarksToCustomer",
                              e.target.checked
                            )
                          }
                          className="h-4 w-4 text-green-600 border-gray-300 dark:border-gray-600 rounded focus:ring-green-500"
                        />
                        <label
                          htmlFor="show-marks-to-customer"
                          className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                        >
                          Show marks to customers
                        </label>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-500">
                          (
                          {formData.showMarksToCustomer
                            ? "Customers can see marks"
                            : "Only Admin can see marks"}
                          )
                        </span>
                      </div>

                      <div>
                        <label
                          htmlFor="marks-per-question"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >
                          Marks per Question
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id="marks-per-question"
                            type="number"
                            min="0"
                            max="100"
                            value={formData.marksPerQuestion || 1}
                            onChange={(e) =>
                              handleFormFieldChange(
                                "marksPerQuestion",
                                Math.max(0, parseInt(e.target.value) || 1)
                              )
                            }
                            placeholder="1"
                            className="w-20 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            points per correct answer
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
                        <div className="font-semibold mb-1">
                          📊 Total Form Score:
                        </div>
                        <div>
                          {formData.sections.reduce((total, section) => {
                            return (
                              total +
                              section.questions.filter(
                                (q) =>
                                  !q.followUpQuestions ||
                                  q.followUpQuestions.length === 0
                              ).length
                            );
                          }, 0) * (formData.marksPerQuestion || 1)}{" "}
                          points
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sections */}
              {formData.sections.map((section, sectionIndex) => (
                <div
                  key={section.id}
                  ref={(element) => {
                    sectionRefs.current[sectionIndex] = element;
                  }}
                  className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      Section {sectionIndex + 1}
                    </h3>
                    {formData.sections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSection(sectionIndex)}
                        className="flex items-center px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete Section
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor={`section-${sectionIndex}-title`}
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                      >
                        Section Title
                      </label>
                      <input
                        id={`section-${sectionIndex}-title`}
                        type="text"
                        value={section.title}
                        onChange={(e) =>
                          handleSectionChange(
                            sectionIndex,
                            "title",
                            e.target.value
                          )
                        }
                        placeholder={`Section title (e.g., "Personal Information", "Service Details")`}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`section-${sectionIndex}-description`}
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                      >
                        Section Description
                      </label>
                      <input
                        id={`section-${sectionIndex}-description`}
                        type="text"
                        value={section.description}
                        onChange={(e) =>
                          handleSectionChange(
                            sectionIndex,
                            "description",
                            e.target.value
                          )
                        }
                        placeholder="Brief description of this section's purpose"
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`section-${sectionIndex}-weightage`}
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                      >
                        Section Weightage (%)
                      </label>
                      <input
                        id={`section-${sectionIndex}-weightage`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={section.weightage || 0}
                        onChange={(e) =>
                          handleSectionChange(
                            sectionIndex,
                            "weightage",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="e.g., 20 for 20%"
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Total weightage:{" "}
                        {formData.sections
                          .reduce((sum, s) => sum + (s.weightage || 0), 0)
                          .toFixed(1)}
                        %
                        {Math.abs(
                          formData.sections.reduce(
                            (sum, s) => sum + (s.weightage || 0),
                            0
                          ) - 100
                        ) > 0.1 &&
                          formData.sections.some(
                            (s) => (s.weightage || 0) > 0
                          ) && (
                            <span className="text-orange-600 ml-2">
                              ⚠ Should total 100%
                            </span>
                          )}
                      </p>
                    </div>

                    {/* Questions */}
                    <div className="mt-6">
                      <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">
                        Questions
                      </h4>

                      {section.questions.map((question, questionIndex) => (
                        <div
                          key={question.id}
                          className="border border-gray-200 dark:border-gray-700 p-4 rounded-lg mb-4 bg-white dark:bg-gray-900"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-4">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Question {questionIndex + 1}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <label className="flex items-center space-x-1 cursor-pointer px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-md" title="Track Response Rank">
                                <input
                                  type="checkbox"
                                  checked={question.trackResponseRank || false}
                                  onChange={(e) =>
                                    handleQuestionChange(
                                      sectionIndex,
                                      questionIndex,
                                      "trackResponseRank",
                                      e.target.checked
                                    )
                                  }
                                  className="h-3.5 w-3.5 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">Track Rank</span>
                              </label>
                              {section.questions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeQuestion(sectionIndex, questionIndex)
                                  }
                                  className="flex items-center px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label
                                htmlFor={`question-${sectionIndex}-${questionIndex}-text`}
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                              >
                                Question Text
                              </label>
                              <input
                                id={`question-${sectionIndex}-${questionIndex}-text`}
                                type="text"
                                value={question.text}
                                onChange={(e) =>
                                  handleQuestionChange(
                                    sectionIndex,
                                    questionIndex,
                                    "text",
                                    e.target.value
                                  )
                                }
                                placeholder="What would you like to ask?"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`question-${sectionIndex}-${questionIndex}-type`}
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                              >
                                Question Type
                              </label>
                              <select
                                id={`question-${sectionIndex}-${questionIndex}-type`}
                                value={question.type}
                                onChange={(e) => {
                                  const newType = e.target.value as
                                    | "text"
                                    | "radio"
                                    | "paragraph"
                                    | "checkbox"
                                    | "select"
                                    | "search-select"
                                    | "yesNoNA"
                                    | "productNPSTGWBuckets";
                                  const updatedQuestion = {
                                    ...question,
                                    type: newType,
                                  };

                                  const needsOptions = [
                                    "radio",
                                    "checkbox",
                                    "select",
                                    "search-select",
                                    "yesNoNA",
                                    "productNPSTGWBuckets",
                                  ].includes(newType);

                                  if (needsOptions && !question.options) {
                                    if (newType === "yesNoNA") {
                                      updatedQuestion.options =
                                        YES_NO_NA_OPTIONS;
                                    } else {
                                      updatedQuestion.options = [
                                        "Option 1",
                                        "Option 2",
                                        "Option 3",
                                        "Option 4",
                                      ];
                                    }
                                    updatedQuestion.followUpConfig = {};
                                  } else if (!needsOptions) {
                                    delete updatedQuestion.options;
                                    delete updatedQuestion.followUpConfig;
                                  }

                                  handleQuestionChange(
                                    sectionIndex,
                                    questionIndex,
                                    "type",
                                    newType
                                  );
                                  if (needsOptions && !question.options) {
                                    handleQuestionChange(
                                      sectionIndex,
                                      questionIndex,
                                      "options",
                                      [
                                        "Option 1",
                                        "Option 2",
                                        "Option 3",
                                        "Option 4",
                                      ]
                                    );
                                    handleQuestionChange(
                                      sectionIndex,
                                      questionIndex,
                                      "followUpConfig",
                                      {}
                                    );
                                  }
                                }}
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="text">
                                  Short Text - Single line text input
                                </option>
                                <option value="radio">
                                  Multiple Choice - Select one option from many
                                </option>
                                <option value="checkbox">
                                  Checkboxes - Select multiple options
                                </option>
                                <option value="select">
                                  Dropdown - Standard selection
                                </option>
                                <option value="search-select">
                                  Searchable Select - Dropdown with search
                                </option>
                                <option value="yesNoNA">
                                  Yes/No/N/A - Preset options (Yes=1 point,
                                  No/N/A=0 points)
                                </option>
                                <option value="paragraph">
                                  Long Text - Multi-line text input
                                </option>
                                <option value="productNPSTGWBuckets">
                                  Product NPS TGW Buckets
                                </option>
                              </select>
                            </div>
                          </div>

                          {(question.type === "productNPSTGWBuckets") && (
                            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-blue-900 dark:text-blue-100">Hierarchy Levels (Cascading)</h4>
                                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Up to 6 levels</span>
                              </div>
                              <div className="space-y-2">
                                {(() => {
                                  const level1Options = getLevel1Options();
                                  let selectedValues = question.selectedHierarchyValues || {};
                                  
                                  if (!selectedValues.level1 && level1Options.length > 0) {
                                    const defaultLevel1 = level1Options[0];
                                    const level2Options = getLevel2Options(defaultLevel1);
                                    selectedValues = {
                                      level1: defaultLevel1,
                                      level2: level2Options.length > 0 ? level2Options[0] : undefined,
                                    };
                                  }
                                  
                                  const defaultLabels = [
                                    "Complaint Groups",
                                    "Sub-complaints",
                                    "Probing Questions",
                                    "Initial Answers",
                                    "Secondary Details",
                                    "Final Options"
                                  ];

                                  const handleLevelChange = (levelNum: number, value: string) => {
                                    const newValues = { ...selectedValues };
                                    newValues[`level${levelNum}` as keyof typeof selectedValues] = value;
                                    
                                    for (let i = levelNum + 1; i <= 6; i++) {
                                      newValues[`level${i}` as keyof typeof selectedValues] = undefined;
                                    }
                                    
                                    handleQuestionChange(sectionIndex, questionIndex, "selectedHierarchyValues", newValues);
                                  };

                                  return (
                                    <>
                                      <div>
                                        <label className="block text-xs font-bold text-blue-900 dark:text-blue-200 mb-1">L1: {defaultLabels[0]}</label>
                                        <select
                                          value={selectedValues.level1 || ""}
                                          onChange={(e) => handleLevelChange(1, e.target.value)}
                                          className="w-full px-2 py-1 text-xs border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-blue-800 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500"
                                        >
                                          <option value="">Select Level 1</option>
                                          {getLevel1Options().map((opt: string) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                          ))}
                                        </select>
                                      </div>

                                      {/* Level 2 */}
                                      {selectedValues.level1 && getLevel2Options(selectedValues.level1).length > 0 && (
                                        <div>
                                          <label className="block text-xs font-bold text-blue-900 dark:text-blue-200 mb-1">L2: {defaultLabels[1]}</label>
                                          <select
                                            value={selectedValues.level2 || ""}
                                            onChange={(e) => handleLevelChange(2, e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-blue-800 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500"
                                          >
                                            <option value="">Select Level 2</option>
                                            {getLevel2Options(selectedValues.level1).map((opt: string) => (
                                              <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                          </select>
                                        </div>
                                      )}

                                      {/* Level 3 */}
                                      {selectedValues.level2 && getLevel3Options(selectedValues.level1 || "", selectedValues.level2).length > 0 && (
                                        <div>
                                          <label className="block text-xs font-bold text-blue-900 dark:text-blue-200 mb-1">L3: {defaultLabels[2]}</label>
                                          <select
                                            value={selectedValues.level3 || ""}
                                            onChange={(e) => handleLevelChange(3, e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-blue-800 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500"
                                          >
                                            <option value="">Select Level 3</option>
                                            {getLevel3Options(selectedValues.level1 || "", selectedValues.level2).map((opt: string) => (
                                              <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                          </select>
                                        </div>
                                      )}

                                      {/* Level 4 */}
                                      {selectedValues.level3 && getLevel4Options(selectedValues.level1 || "", selectedValues.level2 || "", selectedValues.level3).length > 0 && (
                                        <div>
                                          <label className="block text-xs font-bold text-blue-900 dark:text-blue-200 mb-1">L4: {defaultLabels[3]}</label>
                                          <select
                                            value={selectedValues.level4 || ""}
                                            onChange={(e) => handleLevelChange(4, e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-blue-800 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500"
                                          >
                                            <option value="">Select Level 4</option>
                                            {getLevel4Options(selectedValues.level1 || "", selectedValues.level2 || "", selectedValues.level3).map((opt: string) => (
                                              <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                          </select>
                                        </div>
                                      )}

                                      {/* Level 5 */}
                                      {selectedValues.level4 && getLevel5Options(selectedValues.level1 || "", selectedValues.level2 || "", selectedValues.level3 || "", selectedValues.level4).length > 0 && (
                                        <div>
                                          <label className="block text-xs font-bold text-blue-900 dark:text-blue-200 mb-1">L5: {defaultLabels[4]}</label>
                                          <select
                                            value={selectedValues.level5 || ""}
                                            onChange={(e) => handleLevelChange(5, e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-blue-800 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500"
                                          >
                                            <option value="">Select Level 5</option>
                                            {getLevel5Options(selectedValues.level1 || "", selectedValues.level2 || "", selectedValues.level3 || "", selectedValues.level4).map((opt: string) => (
                                              <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                          </select>
                                        </div>
                                      )}

                                      {/* Level 6 */}
                                      {selectedValues.level5 && getLevel6Options(selectedValues.level1 || "", selectedValues.level2 || "", selectedValues.level3 || "", selectedValues.level4 || "", selectedValues.level5).length > 0 && (
                                        <div>
                                          <label className="block text-xs font-bold text-blue-900 dark:text-blue-200 mb-1">L6: {defaultLabels[5]}</label>
                                          <select
                                            value={selectedValues.level6 || ""}
                                            onChange={(e) => handleLevelChange(6, e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-blue-800 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500"
                                          >
                                            <option value="">Select Level 6</option>
                                            {getLevel6Options(selectedValues.level1 || "", selectedValues.level2 || "", selectedValues.level3 || "", selectedValues.level4 || "", selectedValues.level5).map((opt: string) => (
                                              <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                          </select>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2 italic">Select Level 1 first, then each subsequent level will show only available options based on your selection.</p>
                            </div>
                          )}

                          <div className="flex items-center space-x-4 mb-4">
                            <div className="flex items-center">
                              <input
                                id={`question-${sectionIndex}-${questionIndex}-required`}
                                type="checkbox"
                                checked={question.required}
                                onChange={(e) =>
                                  handleQuestionChange(
                                    sectionIndex,
                                    questionIndex,
                                    "required",
                                    e.target.checked
                                  )
                                }
                                className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                              />
                              <label
                                htmlFor={`question-${sectionIndex}-${questionIndex}-required`}
                                className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                              >
                                Required
                              </label>
                            </div>
                          </div>

                          {/* Multiple Choice/Checkboxes/Dropdown/YesNoNA Options */}
                          {(question.type === "radio" ||
                            question.type === "checkbox" ||
                            question.type === "select" ||
                            question.type === "search-select" ||
                            question.type === "yesNoNA") &&
                            question.options && (
                              <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  {question.type === "yesNoNA"
                                    ? "Preset Options"
                                    : "Options (one per line)"}
                                </label>

                                <div className="space-y-3">
                                  {question.options.map(
                                    (option, optionIndex) => {
                                      const currentGoToSection =
                                        question.followUpConfig?.[option]
                                          ?.goToSection;

                                      return (
                                        <div
                                          key={optionIndex}
                                          className="space-y-2"
                                        >
                                          <div className="flex items-center space-x-2">
                                            <input
                                              aria-label={`Option ${
                                                optionIndex + 1
                                              }`}
                                              type="text"
                                              value={option}
                                              onChange={(e) =>
                                                updateOption(
                                                  sectionIndex,
                                                  questionIndex,
                                                  optionIndex,
                                                  e.target.value
                                                )
                                              }
                                              placeholder={`Option ${
                                                optionIndex + 1
                                              }`}
                                              className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />

                                            {question.options &&
                                              question.options.length > 2 &&
                                              question.type !== "yesNoNA" && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    removeOption(
                                                      sectionIndex,
                                                      questionIndex,
                                                      optionIndex
                                                    )
                                                  }
                                                  className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                                                  aria-label="Remove option"
                                                >
                                                  <Minus className="h-4 w-4" />
                                                </button>
                                              )}
                                          </div>

                                          {/* Follow-up Action Menu */}
                                          <div className="ml-8 flex items-center gap-2 mt-2 relative">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const menuId = `${sectionIndex}-${questionIndex}-${optionIndex}`;
                                                setOpenOptionMenu(
                                                  openOptionMenu === menuId
                                                    ? null
                                                    : menuId
                                                );
                                              }}
                                              className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg transition-colors relative"
                                              title="More actions"
                                            >
                                              <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {openOptionMenu ===
                                              `${sectionIndex}-${questionIndex}-${optionIndex}` && (
                                              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-max">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    addFollowUp(
                                                      sectionIndex,
                                                      questionIndex,
                                                      option
                                                    );
                                                    setOpenOptionMenu(null);
                                                  }}
                                                  className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                                                >
                                                  Add a question for this option
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    console.log(
                                                      "Opening section modal for option:",
                                                      option
                                                    );
                                                    console.log(
                                                      "Available sections:",
                                                      formData.sections.length
                                                    );
                                                    setSectionModal({
                                                      isOpen: true,
                                                      sectionIndex,
                                                      questionIndex,
                                                      option,
                                                    });
                                                    setOpenOptionMenu(null);
                                                  }}
                                                  className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors"
                                                >
                                                  Add a section for this option
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const isLinked =
                                                      section.questions[
                                                        questionIndex
                                                      ].followUpConfig?.[option]
                                                        ?.hasFollowUp;
                                                    if (!isLinked) {
                                                      alert(
                                                        "Please link a follow-up section first before linking a form"
                                                      );
                                                      return;
                                                    }
                                                    const formId =
                                                      (window as any).formId ||
                                                      "current-form";
                                                    const forms =
                                                      (window as any)
                                                        .availableForms || [];
                                                    if (forms.length === 0) {
                                                      alert(
                                                        "No other forms available to link"
                                                      );
                                                      return;
                                                    }
                                                    const selectedFormId =
                                                      prompt(
                                                        "Enter the ID of the form to link (or paste form ID)"
                                                      );
                                                    if (selectedFormId) {
                                                      linkFollowUpForm(
                                                        sectionIndex,
                                                        questionIndex,
                                                        option,
                                                        selectedFormId
                                                      );
                                                      alert(
                                                        "Form linked successfully!"
                                                      );
                                                    }
                                                    setOpenOptionMenu(null);
                                                  }}
                                                  className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                                                >
                                                  Link a form for this option
                                                </button>
                                              </div>
                                            )}
                                          </div>

                                          {/* Go to Section Display */}
                                          <div className="ml-8 flex items-center space-x-2">
                                            <div className="flex-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                              {currentGoToSection ? (
                                                currentGoToSection ===
                                                "submit" ? (
                                                  <span className="text-purple-600 font-medium">
                                                    ✅ Submit form
                                                  </span>
                                                ) : (
                                                  <span className="text-green-600 font-medium">
                                                    ➡️ Jump to{" "}
                                                    {formData.sections.findIndex(
                                                      (s) =>
                                                        s.id ===
                                                        currentGoToSection
                                                    ) !== -1
                                                      ? `Section ${
                                                          formData.sections.findIndex(
                                                            (s) =>
                                                              s.id ===
                                                              currentGoToSection
                                                          ) + 1
                                                        }${
                                                          formData.sections.find(
                                                            (s) =>
                                                              s.id ===
                                                              currentGoToSection
                                                          )?.title
                                                            ? `: ${
                                                                formData.sections.find(
                                                                  (s) =>
                                                                    s.id ===
                                                                    currentGoToSection
                                                                )?.title
                                                              }`
                                                            : ""
                                                        }`
                                                      : "Unknown section"}
                                                  </span>
                                                )
                                              ) : (
                                                <span className="text-gray-500 dark:text-gray-500">
                                                  ➡️ Continue to next section
                                                </span>
                                              )}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSectionModal({
                                                  isOpen: true,
                                                  sectionIndex,
                                                  questionIndex,
                                                  option,
                                                });
                                              }}
                                              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                                            >
                                              {currentGoToSection
                                                ? "Change"
                                                : "Set"}
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>

                                {question.type !== "yesNoNA" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        addOption(sectionIndex, questionIndex)
                                      }
                                      className="mt-3 flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                      <Plus className="h-4 w-4 mr-1" />
                                      Add Option
                                    </button>

                                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                                      💡 Tip: Each line becomes a selectable
                                      option for your users
                                    </div>
                                  </>
                                )}
                                {question.type === "yesNoNA" && (
                                  <div className="mt-2 text-xs text-green-700 bg-green-50 p-2 rounded">
                                    ✓ Yes/No/N/A options are preset. Yes = 1
                                    point, No/N/A = 0 points
                                  </div>
                                )}

                                {/* Follow-up Questions */}
                                {question.followUpQuestions &&
                                  question.followUpQuestions.length > 0 && (
                                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                      <h5 className="text-sm font-semibold text-blue-900 mb-3">
                                        Follow-up Questions
                                      </h5>
                                      <div className="space-y-3">
                                        {question.followUpQuestions.map(
                                          (followUp, followUpIndex) => (
                                            <div
                                              key={followUp.id}
                                              className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-blue-200"
                                            >
                                              <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center space-x-3">
                                                  <span className="text-xs font-medium text-blue-600">
                                                    Shown when: "{followUp.showWhen?.value}"
                                                  </span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                  <label className="flex items-center space-x-1 cursor-pointer px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-md" title="Track Response Rank">
                                                    <input
                                                      type="checkbox"
                                                      checked={followUp.trackResponseRank || false}
                                                      onChange={(e) =>
                                                        updateFollowUp(
                                                          sectionIndex,
                                                          questionIndex,
                                                          followUpIndex,
                                                          "trackResponseRank",
                                                          e.target.checked
                                                        )
                                                      }
                                                      className="h-3 w-3 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                                                    />
                                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">Track Rank</span>
                                                  </label>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      removeFollowUp(
                                                        sectionIndex,
                                                        questionIndex,
                                                        followUpIndex
                                                      )
                                                    }
                                                    className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                                                    aria-label="Remove follow-up"
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                  </button>
                                                </div>
                                              </div>

                                              <input
                                                type="text"
                                                value={followUp.text}
                                                onChange={(e) =>
                                                  updateFollowUp(
                                                    sectionIndex,
                                                    questionIndex,
                                                    followUpIndex,
                                                    "text",
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Follow-up question text"
                                                className="w-full p-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                                              />

                                              <div className="grid grid-cols-2 gap-2">
                                                <select
                                                  value={followUp.type}
                                                  onChange={(e) =>
                                                    updateFollowUp(
                                                      sectionIndex,
                                                      questionIndex,
                                                      followUpIndex,
                                                      "type",
                                                      e.target.value
                                                    )
                                                  }
                                                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                                                >
                                                  <option value="text">
                                                    Short Text
                                                  </option>
                                                  <option value="paragraph">
                                                    Long Text
                                                  </option>
                                                  <option value="radio">
                                                    Multiple Choice
                                                  </option>
                                                  <option value="checkbox">
                                                    Checkboxes
                                                  </option>
                                                  <option value="select">
                                                    Dropdown
                                                  </option>
                                                  <option value="search-select">
                                                    Searchable Select
                                                  </option>
                                                  <option value="productNPSTGWBuckets">
                                                    Product NPS TGW Buckets
                                                  </option>
                                                </select>

                                                <label className="flex items-center space-x-2 p-2">
                                                  <input
                                                    type="checkbox"
                                                    checked={followUp.required}
                                                    onChange={(e) =>
                                                      updateFollowUp(
                                                        sectionIndex,
                                                        questionIndex,
                                                        followUpIndex,
                                                        "required",
                                                        e.target.checked
                                                      )
                                                    }
                                                    className="h-4 w-4 text-blue-600"
                                                  />
                                                  <span className="text-sm text-gray-700 dark:text-gray-300">
                                                    Required
                                                  </span>
                                                </label>
                                              </div>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            )}
                        </div>
                      ))}

                      {/* Add Question Button */}
                      <button
                        type="button"
                        onClick={() => addQuestion(sectionIndex)}
                        className="mt-4 flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Question to Section {sectionIndex + 1}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Section Button */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={addSection}
                  className="flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add New Section
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handlePreview}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                >
                  <Eye className="h-4 w-4" />
                  <span>Preview Form</span>
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{loading ? "Saving..." : "Save Form"}</span>
                </button>
              </div>
            </div>

            {/* Section Selection Modal */}
            {sectionModal?.isOpen && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                onClick={(e) => {
                  // Close modal if clicking on backdrop
                  if (e.target === e.currentTarget) {
                    setSectionModal(null);
                  }
                }}
              >
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
                  {/* Modal Header */}
                  <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-4 text-white">
                    <h3 className="text-xl font-semibold">
                      Select Section to Jump To
                    </h3>
                    <p className="text-sm text-green-50 mt-1">
                      When "{sectionModal.option}" is selected, go to:
                    </p>
                    <p className="text-xs text-green-100 mt-2">
                      📋 {formData.sections.length} section
                      {formData.sections.length !== 1 ? "s" : ""} available
                    </p>
                  </div>

                  {/* Modal Body */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-3">
                      {/* Continue to Next Section Option */}
                      <button
                        type="button"
                        onClick={() => {
                          updateGoToSection(
                            sectionModal.sectionIndex,
                            sectionModal.questionIndex,
                            sectionModal.option,
                            ""
                          );
                          setSectionModal(null);
                        }}
                        className="w-full text-left p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-700">
                              ➡️ Continue to Next Section
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                              Follow the default sequential flow
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* All Available Sections */}
                      {formData.sections.map((section, index) => {
                        const isCurrentSection =
                          index === sectionModal.sectionIndex;
                        return (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() => {
                              updateGoToSection(
                                sectionModal.sectionIndex,
                                sectionModal.questionIndex,
                                sectionModal.option,
                                section.id
                              );
                              setSectionModal(null);
                            }}
                            disabled={isCurrentSection}
                            className={`w-full text-left p-4 border-2 rounded-lg transition-all ${
                              isCurrentSection
                                ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                                : "border-green-300 hover:border-green-500 hover:bg-green-50 group"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div
                                  className={`font-semibold ${
                                    isCurrentSection
                                      ? "text-gray-500"
                                      : "text-gray-900 group-hover:text-green-700"
                                  }`}
                                >
                                  📋 Section {index + 1}
                                  {section.title && `: ${section.title}`}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                                  {section.questions.length} question
                                  {section.questions.length !== 1 ? "s" : ""}
                                  {section.description &&
                                    ` • ${section.description}`}
                                </div>
                                {isCurrentSection && (
                                  <div className="text-xs text-orange-600 mt-1">
                                    ⚠️ Cannot jump to current section
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}

                      {/* Submit Form Option */}
                      <button
                        type="button"
                        onClick={() => {
                          updateGoToSection(
                            sectionModal.sectionIndex,
                            sectionModal.questionIndex,
                            sectionModal.option,
                            "submit"
                          );
                          setSectionModal(null);
                        }}
                        className="w-full text-left p-4 border-2 border-purple-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-purple-700">
                              ✅ Submit Form
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                              End the form immediately after this answer
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSectionModal(null)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
