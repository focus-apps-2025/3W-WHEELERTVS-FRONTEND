import type { Question, Response } from "../types";
import type { FollowUpQuestion, Section } from "../types/forms";
import * as XLSX from "xlsx";

const { utils, writeFile, read } = XLSX;

function generateId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 11)}`;
}

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "yes", "1", "y"].includes(normalized);
  }
  return false;
}

function parseNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return Number.isNaN(value) ? undefined : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const normalized = trimmed.endsWith("%")
      ? trimmed.slice(0, -1).trim()
      : trimmed;
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function collectQuestions(section: Section) {
  const rows: Array<Record<string, any>> = [];
  const visit = (question: FollowUpQuestion) => {
    const followUpConfig = (question as any).followUpConfig
      ? JSON.stringify((question as any).followUpConfig)
      : "";
    rows.push({
      SectionId: section.id,
      QuestionId: question.id,
      SubParam1: question.subParam1 || "",
      SubParam2: question.subParam2 || "",
      QuestionText: question.text,
      QuestionType: question.type,
      Required: question.required,
      Options: (question.options || []).join("|"),
      Description: question.description || "",
      ParentQuestionId: question.showWhen?.questionId || "",
      TriggerValue: question.showWhen?.value ?? "",
      GridRows: question.gridOptions?.rows?.join("|") || "",
      GridColumns: question.gridOptions?.columns?.join("|") || "",
      Min: question.min ?? "",
      Max: question.max ?? "",
      Step: question.step ?? "",
      ImageUrl: question.imageUrl || "",
      FollowUpConfig: followUpConfig,
      GoToSection: (question as any).followUpConfig
        ? Object.values((question as any).followUpConfig as Record<string, any>)
            .map((config) => config?.goToSection || "")
            .filter(Boolean)
            .join("|")
        : "",
      LinkedSectionIds: (question as any).followUpConfig
        ? Object.values((question as any).followUpConfig as Record<string, any>)
            .map((config) => config?.linkedSectionId || "")
            .filter(Boolean)
            .join("|")
        : "",
      LinkedFormIds: (question as any).followUpConfig
        ? Object.values((question as any).followUpConfig as Record<string, any>)
            .map((config) => config?.linkedFormId || "")
            .filter(Boolean)
            .join("|")
        : "",
      "Correct Answer": (question as any).correctAnswer || "",
      "Correct Answers": (question as any).correctAnswers
        ? (question as any).correctAnswers.join("|")
        : "",
      SectionBranching: (question as any).branchingRules
        ? (question as any).branchingRules
            .map((rule: any) => `${rule.optionLabel}:${rule.targetSectionId}`)
            .join("|")
        : "",
    });
    if (question.followUpQuestions && question.followUpQuestions.length > 0) {
      question.followUpQuestions.forEach((child) => visit(child));
    }
  };
  section.questions.forEach((question) => visit(question));
  return rows;
}

export function exportResponsesToExcel(
  responses: Response[],
  question: Question
) {
  const data = responses.map((response) => {
    const rawTimestamp =
      (response as any).timestamp || (response as any).fallbackTimestamp;
    const row: Record<string, string> = {
      Timestamp: rawTimestamp ? new Date(rawTimestamp).toLocaleString() : "",
    };

    const allQuestions =
      question.sections.length > 0
        ? question.sections.flatMap((section) => section.questions)
        : question.followUpQuestions;

    allQuestions.forEach((questionItem) => {
      const answer = response.answers[questionItem.id];
      const formattedAnswer = Array.isArray(answer)
        ? answer.join(", ")
        : answer ?? "";
      row[questionItem.text] = String(formattedAnswer);
    });

    return row;
  });

  const worksheet = utils.json_to_sheet(data);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Responses");
  writeFile(workbook, `responses-${question.id}.xlsx`);
}

export function exportFormStructureToExcel(form: Question) {
  const formSheet = utils.json_to_sheet([
    {
      FormId: (form as any).id || (form as any)._id || "",
      Title: form.title,
      Description: form.description,
      IsVisible:
        typeof (form as any).isVisible === "boolean"
          ? (form as any).isVisible
          : true,
      TenantId: (form as any).tenantId || "",
      LogoUrl: form.logoUrl || "",
      ImageUrl: form.imageUrl || "",
      ParentFormId: form.parentFormId || "",
      ParentFormTitle: form.parentFormTitle || "",
      LocationEnabled: (form as any).locationEnabled ? "Yes" : "No",
    },
  ]);

  const sections = form.sections || [];
  const sectionSheet = utils.json_to_sheet(
    sections.map((section, index) => ({
      SectionOrder: index + 1,
      SectionId: section.id,
      SectionTitle: section.title,
      SectionDescription: section.description || "",
      SectionWeightage: (section as any).weightage || 0,
      LinkedToOption: section.linkedToOption || "",
      LinkedToQuestionId: section.linkedToQuestionId || "",
    }))
  );

  const questionRows = sections.flatMap((section) => collectQuestions(section));
  const questionsSheet = utils.json_to_sheet(questionRows, {
    header: [
      "SectionId",
      "QuestionId",
      "SubParam1",
      "SubParam2",
      "QuestionText",
      "QuestionType",
      "Required",
      "Options",
      "Description",
      "ParentQuestionId",
      "TriggerValue",
      "GridRows",
      "GridColumns",
      "Min",
      "Max",
      "Step",
      "ImageUrl",
      "FollowUpConfig",
      "GoToSection",
      "LinkedSectionIds",
      "LinkedFormIds",
      "Correct Answer",
      "Correct Answers",
      "SectionBranching",
    ],
  });

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, formSheet, "Form");
  utils.book_append_sheet(workbook, sectionSheet, "Sections");
  utils.book_append_sheet(workbook, questionsSheet, "Questions");
  writeFile(
    workbook,
    `${(form.title || "form")
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()}-structure.xlsx`
  );
}

function getSectionForOption(
  optionsStr: string,
  linkedSection: string,
  optionIndex: number
): string {
  if (!optionsStr || !linkedSection) return "";

  const options = optionsStr.split(",").map((opt) => opt.trim());
  if (optionIndex >= options.length) return "";

  const optionText = options[optionIndex];

  const links = linkedSection.split(",").map((link) => link.trim());
  for (const link of links) {
    const [sectionNum, ...optionParts] = link.split(":");
    const linkedOption = optionParts.join(":").trim();
    if (linkedOption === optionText) {
      return sectionNum;
    }
  }

  return "";
}

export function createSampleFormData() {
  const sampleData = [
    {
      "Form Title": "Customer Service Feedback Form",
      "Form Description": "Comprehensive feedback form with sub-parameters for enhanced customization",
      "Section Number": "1",
      "Section Title": "Customer Information",
      "Section Description": "Basic customer details and contact information",
      "Section Weightage": "25",
      Question: "What is your full name?",
      "Question Description": "Please provide your complete legal name",
      "Question Type": "shortText",
      Required: "TRUE",
      Options: "",
      SubParam1: "Personal Info",
      SubParam2: "Required Field",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
    },
    {
      "Section Weightage": "25",
      Question: "What type of service did you receive?",
      "Question Description": "Select the primary service category",
      "Question Type": "dropdown",
      Required: "TRUE",
      Options: "Technical Support,Product Consultation,Billing Inquiry,General Inquiry",
      SubParam1: "Service Category",
      SubParam2: "Dropdown Selection",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
      "FU1: Option": "Technical Support",
      "FU1: Question Type": "shortText",
      "FU1: Required": "TRUE",
      "FU1: SubParam1": "Tech Support",
      "FU1: SubParam2": "Follow-up Required",
      "FU1: Question Text": "What was the technical issue you experienced?",
      "FU1: Options": "",
      "FU1: Correct Answer": "",
      "FU2: Option": "Product Consultation",
      "FU2: Question Type": "longText",
      "FU2: Required": "FALSE",
      "FU2: SubParam1": "Product Info",
      "FU2: SubParam2": "Optional Details",
      "FU2: Question Text": "Please describe the product information you were seeking:",
      "FU2: Options": "",
      "FU2: Correct Answer": "",
    },
    {
      "Section Number": "2",
      "Section Title": "Service Quality Assessment",
      "Section Description": "Rate various aspects of the service experience",
      "Section Weightage": "35",
      Question: "How would you rate the overall service quality?",
      "Question Description": "Rate on a scale of 1-5",
      "Question Type": "multipleChoice",
      Required: "TRUE",
      Options: "1 - Poor,2 - Below Average,3 - Average,4 - Good,5 - Excellent",
      SubParam1: "Quality Rating",
      SubParam2: "Scale 1-5",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
      "FU1: Option": "1 - Poor",
      "FU1: Question Type": "longText",
      "FU1: Required": "TRUE",
      "FU1: SubParam1": "Improvement Needed",
      "FU1: SubParam2": "Critical Feedback",
      "FU1: Question Text": "What specific improvements would you suggest to enhance our service?",
      "FU1: Options": "",
      "FU1: Correct Answer": "",
      "FU2: Option": "5 - Excellent",
      "FU2: Question Type": "shortText",
      "FU2: Required": "FALSE",
      "FU2: SubParam1": "Positive Feedback",
      "FU2: SubParam2": "Optional Praise",
      "FU2: Question Text": "What did we do particularly well?",
      "FU2: Options": "",
      "FU2: Correct Answer": "",
    },
    {
      "Section Weightage": "35",
      Question: "Would you recommend our service to others?",
      "Question Description": "Net Promoter Score style question",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "NPS Question",
      SubParam2: "Recommendation",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
      "FU1: Option": "Yes",
      "FU1: Question Type": "shortText",
      "FU1: Required": "FALSE",
      "FU1: SubParam1": "Referral Source",
      "FU1: SubParam2": "Optional",
      "FU1: Question Text": "How did you hear about our service?",
      "FU1: Options": "",
      "FU1: Correct Answer": "",
    },
    {
      "Section Number": "3",
      "Section Title": "Additional Documentation",
      "Section Description": "Upload any relevant files or documents",
      "Section Weightage": "40",
      Question: "Please upload any supporting documents (optional)",
      "Question Description": "Accepted formats: PDF, images up to 5MB",
      "Question Type": "fileUpload",
      Required: "FALSE",
      Options: "",
      SubParam1: "Document Upload",
      SubParam2: "Max 5MB",
      "Allowed File Types": "pdf,image",
      "Correct Answer": "",
      "Correct Answers": "",
    },
    {
      "Section Weightage": "40",
      Question: "Do you have any additional comments?",
      "Question Description": "Any other feedback or suggestions",
      "Question Type": "longText",
      Required: "FALSE",
      Options: "",
      SubParam1: "Open Feedback",
      SubParam2: "Free Text",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
    },
  ];

  return sampleData;
}

export async function loadSampleFormData(): Promise<Partial<Question> & { sections: Section[] }> {
  const sampleData = createSampleFormData();

  // Convert sample data to the format expected by parseNewTemplateFormat
  // Skip the first 3 rows (header, description, separator) and process the data rows
  const dataRows = sampleData;

  return parseNewTemplateFormat(dataRows);
}

export function downloadFormImportTemplate() {
  const mainHeaders = [
    "Form Title",
    "Form Description",
    "Section Number",
    "Section Title",
    "Section Description",
    "Section Weightage",
    "Question",
    "Question Description",
    "Question Type",
    "Required",
    "Options",
    "SubParam1",
    "SubParam2",
    "Allowed File Types",
    "Correct Answer",
    "Correct Answers",
  ];

  const followUpHeaders = [];
  for (let i = 1; i <= 10; i++) {
    followUpHeaders.push(
      `FU${i}: Option`,
      `FU${i}: Question Type`,
      `FU${i}: Required`,
      `FU${i}: SubParam1`,
      `FU${i}: SubParam2`,
      `FU${i}: Question Text`,
      `FU${i}: Options`,
      `FU${i}: Correct Answer`
    );
  }

  const headers = [...mainHeaders, ...followUpHeaders];

  const descriptions = [
    "Name of the form",
    "Overview/purpose of the form",
    "Which section (1, 2, 3...)",
    "Title of the section",
    "Description of what this section covers",
    "Percentage weight (0-100, must total 100% if used)",
    "The question text to ask",
    "Additional details about the question",
    "Type: shortText, longText, multipleChoice, checkboxes, dropdown, yesNoNA, fileUpload",
    "TRUE/FALSE - is this question required?",
    "For multipleChoice/checkboxes/dropdown: option1,option2,option3 (comma-separated)",
    "Additional parameter 1 for custom question configuration",
    "Additional parameter 2 for custom question configuration",
    "For fileUpload: allowed file types (image,pdf,excel) - comma-separated",
    "For quiz: correct answer value",
    "For quiz: multiple correct answers separated by |",
  ];

  for (let i = 1; i <= 10; i++) {
    descriptions.push(
      `Follow-up #${i}: Which option triggers this follow-up (must match main options)`,
      `Follow-up #${i}: Question type`,
      `Follow-up #${i}: Required (TRUE/FALSE)`,
      `Follow-up #${i}: SubParam1`,
      `Follow-up #${i}: SubParam2`,
      `Follow-up #${i}: The follow-up question text`,
      `Follow-up #${i}: Options (comma-separated)`,
      `Follow-up #${i}: Correct answer (if quiz)`
    );
  }

  const headerRow = headers.reduce((obj, header) => {
    obj[header] = header;
    return obj;
  }, {} as Record<string, string>);

  const descriptionRow = headers.reduce((obj, header, idx) => {
    obj[header] = descriptions[idx];
    return obj;
  }, {} as Record<string, string>);

  const separatorRow = headers.reduce((obj, header) => {
    obj[header] = "";
    return obj;
  }, {} as Record<string, string>);

  const templateData: Record<string, any>[] = [
    headerRow,
    descriptionRow,
    separatorRow,
  ];

  const formTitle = "Follow-up Testing Form - Nested Support";
  const formDesc =
    "Test form with 3 sections demonstrating basic and nested follow-ups";

  const rows = [
    {
      "Form Title": formTitle,
      "Form Description": formDesc,
      "Section Number": "1",
      "Section Title": "Section 1: Basic Screening",
      "Section Description":
        "Initial qualification questions - no follow-ups required",
      "Section Weightage": "30",
      Question: "Are you 18 years or older?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Age Verification",
      SubParam2: "Eligibility Check",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
    },
    {
      "Section Weightage": "30",
      Question: "Do you have valid identification documents?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Document Verification",
      SubParam2: "ID Requirements",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
    },
    {
      "Section Weightage": "30",
      Question: "Have you previously used our service before?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Service History",
      SubParam2: "Previous Experience",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
    },
    {
      "Section Weightage": "30",
      Question: "Are you available for a follow-up appointment if needed?",
      "Question Type": "yesNoNA",
      Required: "FALSE",
      Options: "Yes,No,N/A",
      SubParam1: "Availability",
      SubParam2: "Scheduling",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
    },
    {
      "Section Number": "2",
      "Section Title": "Section 2: Service Experience & Nested Follow-ups",
      "Section Description":
        "Questions about service experience with multi-level follow-ups",
      "Section Weightage": "40",
      Question: "Are you satisfied with our service quality?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Satisfaction Rating",
      SubParam2: "Quality Assessment",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
    },
    {
      "Section Weightage": "40",
      Question: "Did you complete your desired goal with our help?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Goal Achievement",
      SubParam2: "Success Metrics",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
    },
    {
      "Section Weightage": "40",
      Question: "Would you recommend us to others?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "NPS Question",
      SubParam2: "Referral Intent",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
      "FU1: Option": "Yes",
      "FU1: Question Type": "shortText",
      "FU1: Required": "TRUE",
      "FU1: SubParam1": "Positive Feedback",
      "FU1: SubParam2": "Highlight Success",
      "FU1: Question Text": "Which aspect of our service would you highlight?",
      "FU1: Options": "",
      "FU1: Correct Answer": "",
      "FU2: Option": "No",
      "FU2: Question Type": "longText",
      "FU2: Required": "TRUE",
      "FU2: SubParam1": "Improvement Areas",
      "FU2: SubParam2": "Critical Feedback",
      "FU2: Question Text": "What specific improvements would you suggest?",
      "FU2: Options": "",
      "FU2: Correct Answer": "",
      "FU3: Option": "N/A",
      "FU3: Question Type": "longText",
      "FU3: Required": "FALSE",
      "FU3: SubParam1": "Not Applicable",
      "FU3: SubParam2": "Optional Explanation",
      "FU3: Question Text": "Why is this not applicable to your situation?",
      "FU3: Options": "",
      "FU3: Correct Answer": "",
    },
    {
      "Section Weightage": "40",
      Question: "Will you use our service again in the future?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Future Intent",
      SubParam2: "Retention",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
      "FU1: Option": "Yes",
      "FU1: Question Type": "yesNoNA",
      "FU1: Required": "TRUE",
      "FU1: SubParam1": "Future Usage",
      "FU1: SubParam2": "Timeline Question",
      "FU1: Question Text": "How soon do you plan to use our service again?",
      "FU1: Options": "Yes,No,N/A",
      "FU1: Correct Answer": "",
      "FU2: Option": "No",
      "FU2: Question Type": "dropdown",
      "FU2: Required": "TRUE",
      "FU2: SubParam1": "Retention Factors",
      "FU2: SubParam2": "Improvement Areas",
      "FU2: Question Text":
        "What would change your mind about using our service?",
      "FU2: Options":
        "Better pricing,Improved features,Different support,Other",
      "FU2: Correct Answer": "",
      "FU3: Option": "N/A",
      "FU3: Question Type": "longText",
      "FU3: Required": "FALSE",
      "FU3: SubParam1": "Not Applicable",
      "FU3: SubParam2": "Optional Context",
      "FU3: Question Text": "Please explain why this is not applicable",
      "FU3: Options": "",
      "FU3: Correct Answer": "",
    },
    {
      "Section Weightage": "40",
      Question: "Is your issue completely resolved?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Resolution Status",
      SubParam2: "Issue Closure",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
      "FU1: Option": "Yes",
      "FU1: Question Type": "yesNoNA",
      "FU1: Required": "FALSE",
      "FU1: SubParam1": "Resolution Check",
      "FU1: SubParam2": "Follow-up Concerns",
      "FU1: Question Text": "Are there any remaining concerns?",
      "FU1: Options": "Yes,No,N/A",
      "FU1: Correct Answer": "",
      "FU2: Option": "No",
      "FU2: Question Type": "longText",
      "FU2: Required": "TRUE",
      "FU2: SubParam1": "Unresolved Issues",
      "FU2: SubParam2": "Detailed Feedback",
      "FU2: Question Text": "What part of your issue remains unresolved?",
      "FU2: Options": "",
      "FU2: Correct Answer": "",
      "FU3: Option": "N/A",
      "FU3: Question Type": "shortText",
      "FU3: Required": "FALSE",
      "FU3: SubParam1": "Not Applicable",
      "FU3: SubParam2": "Optional Context",
      "FU3: Question Text": "Please elaborate on why this is N/A",
      "FU3: Options": "",
      "FU3: Correct Answer": "",
    },
    {
      "Section Number": "3",
      "Section Title": "Section 3: Follow-up Support & Feedback",
      "Section Description":
        "Final section with yes/no/n/a questions and follow-ups",
      "Section Weightage": "30",
      Question: "Do you need additional support or resources?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Support Needs",
      SubParam2: "Resource Requirements",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
      "FU1: Option": "Yes",
      "FU1: Question Type": "dropdown",
      "FU1: Required": "TRUE",
      "FU1: SubParam1": "Support Types",
      "FU1: SubParam2": "Additional Resources",
      "FU1: Question Text": "What type of support do you need?",
      "FU1: Options": "Technical,Training,Consulting,Other",
      "FU1: Correct Answer": "",
      "FU2: Option": "No",
      "FU2: Question Type": "shortText",
      "FU2: Required": "FALSE",
      "FU2: SubParam1": "Satisfaction",
      "FU2: SubParam2": "Positive Feedback",
      "FU2: Question Text": "What made you feel supported?",
      "FU2: Options": "",
      "FU2: Correct Answer": "",
    },
    {
      "Section Weightage": "30",
      Question: "Can we contact you with service updates?",
      "Question Type": "yesNoNA",
      Required: "FALSE",
      Options: "Yes,No,N/A",
      SubParam1: "Communication Consent",
      SubParam2: "Update Preferences",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
      "FU1: Option": "Yes",
      "FU1: Question Type": "multipleChoice",
      "FU1: Required": "TRUE",
      "FU1: SubParam1": "Contact Preferences",
      "FU1: SubParam2": "Communication Method",
      "FU1: Question Text": "Preferred contact method:",
      "FU1: Options": "Email,Phone,SMS,Postal Mail",
      "FU1: Correct Answer": "",
    },
    {
      "Section Weightage": "30",
      Question: "Will you provide feedback on your experience?",
      "Question Type": "yesNoNA",
      Required: "FALSE",
      Options: "Yes,No,N/A",
      SubParam1: "Feedback Consent",
      SubParam2: "Review Participation",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
      "FU1: Option": "Yes",
      "FU1: Question Type": "longText",
      "FU1: Required": "TRUE",
      "FU1: SubParam1": "Detailed Feedback",
      "FU1: SubParam2": "Comprehensive Review",
      "FU1: Question Text": "Please share your detailed feedback:",
      "FU1: Options": "",
      "FU1: Correct Answer": "",
      "FU2: Option": "No",
      "FU2: Question Type": "shortText",
      "FU2: Required": "FALSE",
      "FU2: SubParam1": "Decline Reason",
      "FU2: SubParam2": "Optional Context",
      "FU2: Question Text": "Would you share why?",
      "FU2: Options": "",
      "FU2: Correct Answer": "",
    },
    {
      Question: "Do you consent to data usage for service improvement?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Data Privacy",
      SubParam2: "Analytics Consent",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
      "FU1: Option": "Yes",
      "FU1: Question Type": "shortText",
      "FU1: Required": "FALSE",
      "FU1: SubParam1": "Improvement Focus",
      "FU1: SubParam2": "Specific Areas",
      "FU1: Question Text": "What specific area should we improve?",
      "FU1: Options": "",
      "FU1: Correct Answer": "",
    },
    {
      Question: "Is there anything else you'd like to share?",
      "Question Type": "yesNoNA",
      Required: "FALSE",
      Options: "Yes,No,N/A",
      SubParam1: "Eligibility",
      SubParam2: "Document Verification",
      "Allowed File Types": "",
      "Correct Answer": "",
      "Correct Answers": "",
      "FU1: Option": "Yes",
      "FU1: Question Type": "longText",
      "FU1: Required": "TRUE",
      "FU1: SubParam1": "Quality Assessment",
      "FU1: SubParam2": "Feedback Collection",
      "FU1: Question Text": "Please provide additional comments:",
      "FU1: Options": "",
      "FU1: Correct Answer": "",
    },
    {
      "Section Weightage": "30",
      Question: "Please upload any supporting documents (optional)",
      "Question Type": "fileUpload",
      Required: "FALSE",
      Options: "",
      SubParam1: "Service History",
      SubParam2: "Document Verification",
      "Allowed File Types": "pdf,image",
      "Correct Answer": "",
      "Correct Answers": "",
    },
  ];

  rows.forEach((row) => {
    const fullRow: Record<string, any> = {
      "Form Title": row["Form Title"] || "",
      "Form Description": row["Form Description"] || "",
      "Section Number": row["Section Number"] || "",
      "Section Title": row["Section Title"] || "",
      "Section Description": row["Section Description"] || "",
      Question: row.Question || "",
      "Question Description": row["Question Description"] || "",
      "Question Type": row["Question Type"] || "",
      Required: row.Required || "FALSE",
      Options: row.Options || "",
      SubParam1: row.SubParam1 || "",
      SubParam2: row.SubParam2 || "",
      "Allowed File Types": row["Allowed File Types"] || "",
      "Correct Answer": row["Correct Answer"] || "",
      "Correct Answers": row["Correct Answers"] || "",
    };

    for (let i = 1; i <= 10; i++) {
      fullRow[`FU${i}: Option`] = row[`FU${i}: Option`] || "";
      fullRow[`FU${i}: Question Type`] = row[`FU${i}: Question Type`] || "";
      fullRow[`FU${i}: Required`] = row[`FU${i}: Required`] || "";
      fullRow[`FU${i}: SubParam1`] = row[`FU${i}: SubParam1`] || "";
      fullRow[`FU${i}: SubParam2`] = row[`FU${i}: SubParam2`] || "";
      fullRow[`FU${i}: Question Text`] = row[`FU${i}: Question Text`] || "";
      fullRow[`FU${i}: Options`] = row[`FU${i}: Options`] || "";
      fullRow[`FU${i}: Correct Answer`] = row[`FU${i}: Correct Answer`] || "";
    }

    templateData.push(fullRow);
  });

  const worksheet = utils.json_to_sheet(templateData, {
    header: headers,
  });

  worksheet["!cols"] = headers.map(() => ({ wch: 25 }));

  // Add data validation for SubParam1 and SubParam2 columns
  worksheet['!datavalidation'] = [
    {
      sqref: 'L5:L1000', // SubParam1 column L (11), from row 5 onwards
      type: 'list',
      formula1: '=Parameters!$A$4:$A$1000'
    },
    {
      sqref: 'M5:M1000', // SubParam2 column M (12)
      type: 'list',
      formula1: '=Parameters!$A$4:$A$1000'
    },
    {
      sqref: 'S5:S1000', // FU1:SubParam1 column S (19)
      type: 'list',
      formula1: '=Parameters!$A$4:$A$1000'
    },
    {
      sqref: 'T5:T1000', // FU1:SubParam2 column T (20)
      type: 'list',
      formula1: '=Parameters!$A$4:$A$1000'
    },
    {
      sqref: 'AB5:AB1000', // FU2:SubParam1 column AB (27)
      type: 'list',
      formula1: '=Parameters!$A$4:$A$1000'
    },
    {
      sqref: 'AC5:AC1000', // FU2:SubParam2 column AC (28)
      type: 'list',
      formula1: '=Parameters!$A$4:$A$1000'
    },
    {
      sqref: 'AJ5:AJ1000', // FU3:SubParam1 column AJ (35)
      type: 'list',
      formula1: '=Parameters!$A$4:$A$1000'
    },
    {
      sqref: 'AK5:AK1000', // FU3:SubParam2 column AK (36)
      type: 'list',
      formula1: '=Parameters!$A$4:$A$1000'
    }
  ];

  // Create Parameters sheet
  const parametersHeaders = ["Parameter Name", "Type"];
  const parametersDescriptions = ["Name of the parameter", "Type: Main or Followup"];

  const parametersHeaderRow = {
    "Parameter Name": "Parameter Name",
    "Type": "Type"
  };

  const parametersDescriptionRow = {
    "Parameter Name": parametersDescriptions[0],
    "Type": parametersDescriptions[1]
  };

  const parametersSeparatorRow = {
    "Parameter Name": "",
    "Type": ""
  };

  const parametersSampleData = [
    { "Parameter Name": "Eligibility", "Type": "Main" },
    { "Parameter Name": "Document Verification", "Type": "Main" },
    { "Parameter Name": "Service History", "Type": "Main" },
    { "Parameter Name": "Quality Assessment", "Type": "Followup" },
    { "Parameter Name": "Feedback Collection", "Type": "Followup" },
  ];

  const parametersData = [
    parametersHeaderRow,
    parametersDescriptionRow,
    parametersSeparatorRow,
    ...parametersSampleData
  ];

  const parametersWorksheet = utils.json_to_sheet(parametersData, {
    header: parametersHeaders,
  });

  parametersWorksheet["!cols"] = parametersHeaders.map(() => ({ wch: 25 }));

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, parametersWorksheet, "Parameters");
  utils.book_append_sheet(workbook, worksheet, "Form Template");
  writeFile(workbook, "form-import-template-nested-followups.xlsx");
}

export async function parseFormWorkbook(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "array" });

  const sheetNames = workbook.SheetNames;

  // Find Parameters sheet
  const parametersSheetIndex = sheetNames.findIndex(name => name.toLowerCase().includes('parameter'));
  const parametersSheet = parametersSheetIndex >= 0 ? workbook.Sheets[sheetNames[parametersSheetIndex]] : null;

  // Find Form Template sheet
  const formSheetIndex = sheetNames.findIndex(name => name.toLowerCase().includes('form') || name.toLowerCase().includes('template'));
  const formSheet = formSheetIndex >= 0 ? workbook.Sheets[sheetNames[formSheetIndex]] : workbook.Sheets[sheetNames[0]];

  if (!formSheet) {
    throw new Error("Workbook must have a Form Template sheet");
  }

  // Parse parameters from Parameters sheet
  let parametersToCreate: Array<{ name: string; type: "main" | "followup" }> = [];
  if (parametersSheet) {
    const parametersRawData = utils.sheet_to_json<Record<string, any>>(parametersSheet, {
      defval: "",
    });

    // Extract parameters - find the parameter name column (case-insensitive)
    parametersToCreate = parametersRawData
      .filter((row) => {
        // Find the first non-empty value that isn't a header
        const firstValue = Object.values(row)[0]?.toString().trim() || "";
        return firstValue && firstValue.toLowerCase() !== "parameter name" && firstValue !== "";
      })
      .map((row) => {
        // Get the first non-empty value as parameter name
        const paramName = Object.values(row)[0]?.toString().trim() || "";
        // Get the second value as type, default to 'main'
        const typeValue = Object.values(row)[1]?.toString().trim().toLowerCase() || "main";
        
        return {
          name: paramName,
          type: (typeValue === "followup" ? "followup" : "main") as "main" | "followup"
        };
      })
      .filter(p => p.name && p.name.toLowerCase() !== "parameter name"); // Final validation
  }

  // Parse form data from Form Template sheet
  const rawData = utils.sheet_to_json<Record<string, any>>(formSheet, {
    defval: "",
  });

  if (rawData.length === 0) {
    throw new Error("Form Template sheet is empty");
  }

  const dataRows = rawData.slice(3);

  if (dataRows.length === 0) {
    throw new Error(
      "No data rows found in Form Template. Please add content starting from row 4 (after the example header and descriptions)."
    );
  }

  const formData = parseNewTemplateFormat(dataRows, parametersToCreate);

  // Return combined data
  return {
    ...formData,
    parametersToCreate
  };
}

function parseNewTemplateFormat(
  rows: Record<string, any>[],
  parametersToCreate: Array<{ name: string; type: "main" | "followup" }>
): Partial<Question> & { sections: Section[] } {
  const sectionsMap = new Map<string, Section>();
  const formTitle = rows[0]["Form Title"]?.toString().trim() || "Imported Form";
  let currentSectionNo: string | null = null;
  const sectionLinkMap = new Map<
    string,
    { questionId: string; option: string }
  >();
  const questionMap = new Map<string, FollowUpQuestion>();

  rows.forEach((row) => {
    const sectionNo = row["Section Number"]?.toString().trim();
    const sectionTitle = row["Section Title"]?.toString().trim();
    const sectionDesc = row["Section Description"]?.toString().trim();
    const questionText = row["Question"]?.toString().trim();

    if (!questionText) {
      return;
    }

    if (sectionNo) {
      currentSectionNo = sectionNo;
      const sectionWeightage = parseNumber(row["Section Weightage"]);
      if (!sectionsMap.has(sectionNo)) {
        sectionsMap.set(sectionNo, {
          id: generateId(),
          title: sectionTitle || `Section ${sectionNo}`,
          description: sectionDesc || "Section description",
          weightage: sectionWeightage ?? 0,
          questions: [],
        });
      } else if (sectionWeightage !== undefined) {
        const existingSection = sectionsMap.get(sectionNo);
        if (existingSection) {
          existingSection.weightage = sectionWeightage;
        }
      }
    }

    if (!currentSectionNo) {
      return;
    }

    const section = sectionsMap.get(currentSectionNo);
    if (!section) return;

    const questionDesc = row["Question Description"]?.toString().trim();
    const questionType = row["Question Type"]?.toString().trim() || "text";
    const requiredStr = row["Required"]?.toString().trim().toLowerCase();
    const required =
      requiredStr === "true" || requiredStr === "yes" || requiredStr === "1";
    const optionsStr = row["Options"]?.toString().trim() || "";
    const correctAnswer = row["Correct Answer"]?.toString().trim();
    const correctAnswersStr = row["Correct Answers"]?.toString().trim();
    const correctAnswers = correctAnswersStr
      ? correctAnswersStr
          .split("|")
          .map((ans) => ans.trim())
          .filter(Boolean)
      : undefined;

    const options = optionsStr
      ? optionsStr
          .split(",")
          .map((opt) => opt.trim())
          .filter(Boolean)
      : undefined;

    const followUpConfig: Record<
      string,
      { hasFollowUp: boolean; required: boolean }
    > = {};

    if (options && options.length > 0) {
      options.forEach((option) => {
        followUpConfig[option] = { hasFollowUp: false, required: false };
      });
    }

    const subParam1 = row["SubParam1"]?.toString().trim();
    const subParam2 = row["SubParam2"]?.toString().trim();

    // Validate SubParam1 and SubParam2 against parameters from the Parameters sheet (if parameters exist)
    // Allow SubParam values even if no parameters are defined - they will be auto-created if needed
    if (subParam1 && parametersToCreate.length > 0) {
      const isSubParam1Valid = parametersToCreate.some(p =>
        p.name.toLowerCase() === subParam1.toLowerCase()
      );
      if (!isSubParam1Valid) {
        console.warn(`SubParam1 "${subParam1}" not found in parameters. Will be treated as custom value.`);
      }
    }

    if (subParam2 && parametersToCreate.length > 0) {
      const isSubParam2Valid = parametersToCreate.some(p =>
        p.name.toLowerCase() === subParam2.toLowerCase()
      );
      if (!isSubParam2Valid) {
        console.warn(`SubParam2 "${subParam2}" not found in parameters. Will be treated as custom value.`);
      }
    }

    const allowedFileTypesStr = row["Allowed File Types"]?.toString().trim();
    const allowedFileTypes = allowedFileTypesStr
      ? allowedFileTypesStr
          .split(",")
          .map((type) => type.trim())
          .filter(Boolean)
      : undefined;

    const questionId = generateId();
    const question: FollowUpQuestion = {
      id: questionId,
      text: questionText,
      type: questionType as FollowUpQuestion["type"],
      required: required,
      options: options || undefined,
      description: questionDesc || undefined,
      subParam1: subParam1 || undefined,
      subParam2: subParam2 || undefined,
      allowedFileTypes: allowedFileTypes,
      followUpQuestions: [],
      sectionId: section.id,
      correctAnswer: correctAnswer || undefined,
      correctAnswers: correctAnswers,
    };

    for (let fuIndex = 1; fuIndex <= 10; fuIndex++) {
      const fuOptionKey = `FU${fuIndex}: Option`;
      const fuTypeKey = `FU${fuIndex}: Question Type`;
      const fuRequiredKey = `FU${fuIndex}: Required`;
      const fuSubParam1Key = `FU${fuIndex}: SubParam1`;
      const fuSubParam2Key = `FU${fuIndex}: SubParam2`;
      const fuTextKey = `FU${fuIndex}: Question Text`;
      const fuOptionsKey = `FU${fuIndex}: Options`;
      const fuCorrectAnswerKey = `FU${fuIndex}: Correct Answer`;

      const fuOption = row[fuOptionKey]?.toString().trim();
      const fuType = row[fuTypeKey]?.toString().trim();
      const fuText = row[fuTextKey]?.toString().trim();

      if (fuOption && fuType && fuText) {
        const fuRequired =
          (row[fuRequiredKey]?.toString().trim() || "FALSE").toLowerCase() ===
          "true";
        const fuSubParam1 = row[fuSubParam1Key]?.toString().trim();
        const fuSubParam2 = row[fuSubParam2Key]?.toString().trim();

        // Validate followup SubParam1 and SubParam2 against parameters from the Parameters sheet (if parameters exist)
        if (fuSubParam1 && parametersToCreate.length > 0) {
          const isFuSubParam1Valid = parametersToCreate.some(p =>
            p.name.toLowerCase() === fuSubParam1.toLowerCase()
          );
          if (!isFuSubParam1Valid) {
            console.warn(`FU${fuIndex}: SubParam1 "${fuSubParam1}" not found in parameters. Will be treated as custom value.`);
          }
        }

        if (fuSubParam2 && parametersToCreate.length > 0) {
          const isFuSubParam2Valid = parametersToCreate.some(p =>
            p.name.toLowerCase() === fuSubParam2.toLowerCase()
          );
          if (!isFuSubParam2Valid) {
            console.warn(`FU${fuIndex}: SubParam2 "${fuSubParam2}" not found in parameters. Will be treated as custom value.`);
          }
        }

        const fuOptionsStr = row[fuOptionsKey]?.toString().trim() || "";
        const fuCorrectAnswer =
          row[fuCorrectAnswerKey]?.toString().trim() || "";

        const fuOptions = fuOptionsStr
          ? fuOptionsStr
              .split(",")
              .map((opt) => opt.trim())
              .filter(Boolean)
          : undefined;

        const followUpId = generateId();
        const followUp: FollowUpQuestion = {
          id: followUpId,
          text: fuText,
          type: fuType as FollowUpQuestion["type"],
          required: fuRequired,
          options: fuOptions,
          followUpQuestions: [],
          sectionId: section.id,
          correctAnswer: fuCorrectAnswer || undefined,
          showWhen: {
            questionId: questionId,
            value: fuOption,
          },
          subParam1: fuSubParam1 || undefined,
          subParam2: fuSubParam2 || undefined,
          allowedFileTypes: undefined,
        };

        question.followUpQuestions = question.followUpQuestions || [];
        question.followUpQuestions.push(followUp);

        if (!followUpConfig[fuOption]) {
          followUpConfig[fuOption] = {
            hasFollowUp: true,
            required: fuRequired,
          };
        } else {
          followUpConfig[fuOption].hasFollowUp = true;
          followUpConfig[fuOption].required =
            fuRequired || followUpConfig[fuOption].required;
        }
      }
    }

    if (Object.keys(followUpConfig).length > 0) {
      (question as any).followUpConfig = followUpConfig;
    }

    section.questions.push(question);
    questionMap.set(questionText, question);
  });

  const sections = Array.from(sectionsMap.values());

  sectionLinkMap.forEach((linkInfo, targetSectionNo) => {
    const targetSectionIdx = parseInt(targetSectionNo) - 1;
    if (targetSectionIdx >= 0 && targetSectionIdx < sections.length) {
      const targetSection = sections[targetSectionIdx];
      if ((targetSection as any).linkedToQuestionId === undefined) {
        (targetSection as any).linkedToQuestionId = linkInfo.questionId;
        (targetSection as any).linkedToOption = linkInfo.option;
      }
    }
  });

  const formPayload: Partial<Question> & { sections: Section[] } = {
    id: generateId(),
    title: formTitle,
    description: "Imported form from Excel template",
    isVisible: true,
    sections,
    followUpQuestions: [],
  };

  return formPayload;
}
