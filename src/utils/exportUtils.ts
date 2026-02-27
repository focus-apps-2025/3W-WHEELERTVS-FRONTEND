import type { Question, Response } from "../types";
import type { FollowUpQuestion, Section } from "../types/forms";
import * as XLSX from "xlsx";
import XLSX_STYLE from "xlsx-js-style"; // Import xlsx-style for styling
import { utils } from "xlsx";

// Create a combined utils object
const { utils: styleUtils, writeFile } = XLSX_STYLE;
const { utils: baseUtils, read } = XLSX;

// Add this interface at the top of your file
interface FormRowData {
  [key: string]: string | undefined;
}

interface FollowUpNode {
  path: string; // "1.1.1.1.1"
  question: string;
  type: string;
  required: boolean;
  options?: string[];
  parentPath: string; // "1.1.1.1"
  triggerValue: string; // What triggers this
}
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
      Suggestion: question.suggestion || "",
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
      let formattedAnswer = "";
      
      if (Array.isArray(answer)) {
        formattedAnswer = answer.join(", ");
      } else if (typeof answer === "object" && answer !== null) {
        // Handle Product NPS Buckets (Hierarchy)
        if (answer.level1 || answer.level2 || answer.level3) {
          formattedAnswer = [
            answer.level1,
            answer.level2,
            answer.level3,
            answer.level4,
            answer.level5,
            answer.level6,
          ]
            .filter(Boolean)
            .join(" > ");
        } else {
          try {
            formattedAnswer = JSON.stringify(answer);
          } catch (e) {
            formattedAnswer = String(answer);
          }
        }
      } else {
        formattedAnswer = answer ?? "";
      }
      
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
      "Suggestion",
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
      "Form Title": "Bike Service & Maintenance Form",
      "Form Description":
        "Comprehensive bike service assessment with nested diagnostics",
      "Section Number": "1",
      "Section Title": "Basic Bike Information",
      "Section Description": "Basic details about the bike",
      "Section Weightage": "20",
      "Section Merging": "",
      Question: "What is your bike make and model?",
      "Question Description": "Manufacturer and specific model",
      "Question Type": "shortText",
      Required: "TRUE",
      Options: "",
      SubParam1: "Bike Details",
      SubParam2: "Identification",
    },
    {
      "Section Weightage": "20",
      Question: "What is the bike's registration number?",
      "Question Description": "Official registration/plate number",
      "Question Type": "shortText",
      Required: "TRUE",
      Options: "",
      SubParam1: "Registration",
      SubParam2: "Legal Info",
    },
    {
      "Section Weightage": "20",
      Question: "What is the current odometer reading?",
      "Question Description": "Total kilometers/miles ridden",
      "Question Type": "number",
      Required: "TRUE",
      Options: "",
      SubParam1: "Usage Data",
      SubParam2: "Mileage",
    },
    {
      "Section Number": "2",
      "Section Title": "Service Requirements Assessment",
      "Section Description": "Evaluate what service the bike needs",
      "Section Weightage": "80",
      "Section Merging": "",

      // ========== MAIN QUESTION 1: ENGINE ISSUES (WITH NESTED FOLLOW-UPS) ==========
      Question: "Are you experiencing any engine issues?",
      "Question Description": "Problems related to engine performance",
      "Question Type": "multipleChoice",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Engine Health",
      SubParam2: "Performance",

      // FU1: FOR YES (WITH NESTING)
      "FU1: Option": "Yes",
      "FU1: Question Type": "dropdown",
      "FU1: Required": "TRUE",
      "FU1: SubParam1": "Engine Problem Type",
      "FU1: SubParam2": "Diagnosis",
      "FU1: Question Text": "What type of engine issue are you experiencing?",
      "FU1: Options":
        "Starting Problem,Overheating,Knocking Sound,Oil Leak,Loss of Power",

      // FU1.1: Nested under "Starting Problem"
      "FU1.1: Option": "Starting Problem",
      "FU1.1: Question Type": "multipleChoice",
      "FU1.1: Required": "TRUE",
      "FU1.1: SubParam1": "Start Issue Details",
      "FU1.1: SubParam2": "Electrical",
      "FU1.1: Question Text": "What happens when you try to start?",
      "FU1.1: Options":
        "No Sound at All,Clicking Sound,Cranks But Won't Start,Starts Then Dies",

      // FU1.1.1: Nested under "Cranks But Won't Start"
      "FU1.1.1: Option": "Cranks But Won't Start",
      "FU1.1.1: Question Type": "multipleChoice",
      "FU1.1.1: Required": "TRUE",
      "FU1.1.1: SubParam1": "Fuel System",
      "FU1.1.1: SubParam2": "Ignition",
      "FU1.1.1: Question Text": "When did this problem start?",
      "FU1.1.1: Options":
        "After Fuel Fill,After Rain,Gradually Worsened,Suddenly",

      // FU1.2: Nested under "Oil Leak"
      "FU1.2: Option": "Oil Leak",
      "FU1.2: Question Type": "dropdown",
      "FU1.2: Required": "TRUE",
      "FU1.2: SubParam1": "Leak Location",
      "FU1.2: SubParam2": "Mechanical",
      "FU1.2: Question Text": "Where is the oil leaking from?",
      "FU1.2: Options": "Engine Bottom,Under Seat,Near Chain,From Filter",

      // FU2: FOR NO (SIMPLE - NO NESTING)
      "FU2: Option": "No",
      "FU2: Question Type": "shortText",
      "FU2: Required": "FALSE",
      "FU2: SubParam1": "Engine Status",
      "FU2: SubParam2": "Positive",
      "FU2: Question Text": "When was your last engine service?",

      // FU3: FOR N/A (SIMPLE - NO NESTING)
      "FU3: Option": "N/A",
      "FU3: Question Type": "shortText",
      "FU3: Required": "FALSE",
      "FU3: SubParam1": "Not Applicable",
      "FU3: SubParam2": "Explanation",
      "FU3: Question Text": "Why is this not applicable?",

      // FU4: ADDITIONAL ENGINE QUESTION
      "FU4: Option": "Yes", // Same trigger as FU1
      "FU4: Question Type": "yesNoNA",
      "FU4: Required": "FALSE",
      "FU4: SubParam1": "Warning Lights",
      "FU4: SubParam2": "Dashboard",
      "FU4: Question Text": "Are any warning lights on?",

      // FU5: FINAL ENGINE QUESTION
      "FU5: Option": "Yes", // Same trigger as FU1
      "FU5: Question Type": "shortText",
      "FU5: Required": "FALSE",
      "FU5: SubParam1": "Additional Info",
      "FU5: SubParam2": "Details",
      "FU5: Question Text": "Any other engine symptoms?",
    },
    {
      "Section Weightage": "80",

      // ========== MAIN QUESTION 2: BRAKE SYSTEM (WITH NESTED FOLLOW-UPS) ==========
      Question: "Are there any brake system problems?",
      "Question Description": "Issues with braking performance",
      "Question Type": "multipleChoice",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Brake Safety",
      SubParam2: "Critical",

      // FU1: FOR YES (WITH NESTING)
      "FU1: Option": "Yes",
      "FU1: Question Type": "dropdown",
      "FU1: Required": "TRUE",
      "FU1: SubParam1": "Brake Problem Type",
      "FU1: SubParam2": "Safety Issue",
      "FU1: Question Text": "What brake problem are you experiencing?",
      "FU1: Options":
        "Soft Brake Lever,Grinding Noise,Brake Drag,Poor Stopping,Spongy Feel",

      // FU1.1: Nested under "Grinding Noise"
      "FU1.1: Option": "Grinding Noise",
      "FU1.1: Question Type": "dropdown",
      "FU1.1: Required": "TRUE",
      "FU1.1: SubParam1": "Noise Details",
      "FU1.1: SubParam2": "Wear Indicators",
      "FU1.1: Question Text": "When do you hear the grinding noise?",
      "FU1.1: Options":
        "Always When Braking,Only During Hard Braking,When Releasing Brakes,With Specific Speed",

      // FU1.1.1: Nested under "Always When Braking"
      "FU1.1.1: Option": "Always When Braking",
      "FU1.1.1: Question Type": "dropdown",
      "FU1.1.1: Required": "TRUE",
      "FU1.1.1: SubParam1": "Pad Condition",
      "FU1.1.1: SubParam2": "Maintenance",
      "FU1.1.1: Question Text": "When were brakes last serviced?",
      "FU1.1.1: Options":
        "Within Month,1-3 Months,3-6 Months,Over 6 Months,Never",

      // FU1.2: Nested under "Poor Stopping"
      "FU1.2: Option": "Poor Stopping",
      "FU1.2: Question Type": "dropdown",
      "FU1.2: Required": "TRUE",
      "FU1.2: SubParam1": "Stopping Distance",
      "FU1.2: SubParam2": "Performance",
      "FU1.2: Question Text": "How much has stopping distance increased?",
      "FU1.2: Options":
        "Slightly Noticeable,Significantly Increased,Very Dangerous,Unpredictable",

      // FU2: FOR NO (SIMPLE - NO NESTING)
      "FU2: Option": "No",
      "FU2: Question Type": "shortText",
      "FU2: Required": "FALSE",
      "FU2: SubParam1": "Brake Status",
      "FU2: SubParam2": "Good Condition",
      "FU2: Question Text": "When were brakes last checked?",

      // FU3: FOR N/A (SIMPLE - NO NESTING)
      "FU3: Option": "N/A",
      "FU3: Question Type": "shortText",
      "FU3: Required": "FALSE",
      "FU3: SubParam1": "Not Applicable",
      "FU3: SubParam2": "Explanation",
      "FU3: Question Text": "Why are brakes not applicable?",

      // FU4: ADDITIONAL BRAKE QUESTION
      "FU4: Option": "Yes", // Same trigger as FU1
      "FU4: Question Type": "yesNoNA",
      "FU4: Required": "FALSE",
      "FU4: SubParam1": "Brake Fluid",
      "FU4: SubParam2": "Maintenance",
      "FU4: Question Text": "Has brake fluid been changed recently?",

      // FU5: FINAL BRAKE QUESTION
      "FU5: Option": "Yes", // Same trigger as FU1
      "FU5: Question Type": "shortText",
      "FU5: Required": "FALSE",
      "FU5: SubParam1": "Additional Info",
      "FU5: SubParam2": "Details",
      "FU5: Question Text": "Any vibration during braking?",
    },
    {
      "Section Weightage": "80",

      // ========== MAIN QUESTION 3: TIRE CONDITION (SIMPLE FOLLOW-UPS - NO NESTING) ==========
      Question: "Are there any tire issues?",
      "Question Description": "Problems with tires and wheels",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Tire Safety",
      SubParam2: "Wheels",

      // FU1: FOR YES (SIMPLE - NO NESTING)
      "FU1: Option": "Yes",
      "FU1: Question Type": "multipleChoice",
      "FU1: Required": "TRUE",
      "FU1: SubParam1": "Tire Problem Type",
      "FU1: SubParam2": "Condition",
      "FU1: Question Text": "What tire issue are you facing?",
      "FU1: Options":
        "Puncture,Wear Uneven,Wear Excessive,Bulging,Pressure Loss",

      // FU2: FOR NO (SIMPLE - NO NESTING)
      "FU2: Option": "No",
      "FU2: Question Type": "shortText",
      "FU2: Required": "FALSE",
      "FU2: SubParam1": "Tire Status",
      "FU2: SubParam2": "Good Condition",
      "FU2: Question Text": "When were tires last replaced?",

      // FU3: FOR N/A (SIMPLE - NO NESTING)
      "FU3: Option": "N/A",
      "FU3: Question Type": "shortText",
      "FU3: Required": "FALSE",
      "FU3: SubParam1": "Not Applicable",
      "FU3: SubParam2": "Explanation",
      "FU3: Question Text": "Why are tires not applicable?",

      // FU4: ADDITIONAL TIRE QUESTION
      "FU4: Option": "Yes", // Same trigger as FU1
      "FU4: Question Type": "multipleChoice",
      "FU4: Required": "FALSE",
      "FU4: SubParam1": "Tire Age",
      "FU4: SubParam2": "Maintenance",
      "FU4: Question Text": "How old are your tires?",
      "FU4: Options": "Less than 1 year,1-2 years,2-3 years,Over 3 years",

      // FU5: FINAL TIRE QUESTION
      "FU5: Option": "Yes", // Same trigger as FU1
      "FU5: Question Type": "shortText",
      "FU5: Required": "FALSE",
      "FU5: SubParam1": "Additional Info",
      "FU5: SubParam2": "Details",
      "FU5: Question Text": "Any recent impacts on tires?",
    },
    {
      "Section Weightage": "80",

      // ========== MAIN QUESTION 4: ELECTRICAL SYSTEM (SIMPLE FOLLOW-UPS - NO NESTING) ==========
      Question: "Are there any electrical problems?",
      "Question Description": "Issues with lights, battery, electronics",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Electrical System",
      SubParam2: "Electronics",

      // FU1: FOR YES (SIMPLE - NO NESTING)
      "FU1: Option": "Yes",
      "FU1: Question Type": "multipleChoice",
      "FU1: Required": "TRUE",
      "FU1: SubParam1": "Electrical Problem",
      "FU1: SubParam2": "Diagnosis",
      "FU1: Question Text": "What electrical issue exists?",
      "FU1: Options":
        "Battery Drain,Light Failure,Indicator Problem,Horn Not Working,Display Issues",

      // FU2: FOR NO (SIMPLE - NO NESTING)
      "FU2: Option": "No",
      "FU2: Question Type": "shortText",
      "FU2: Required": "FALSE",
      "FU2: SubParam1": "Electrical Status",
      "FU2: SubParam2": "Good Condition",
      "FU2: Question Text": "When was battery last replaced?",

      // FU3: FOR N/A (SIMPLE - NO NESTING)
      "FU3: Option": "N/A",
      "FU3: Question Type": "shortText",
      "FU3: Required": "FALSE",
      "FU3: SubParam1": "Not Applicable",
      "FU3: SubParam2": "Explanation",
      "FU3: Question Text": "Why is electrical system not applicable?",

      // FU4: ADDITIONAL ELECTRICAL QUESTION
      "FU4: Option": "Yes", // Same trigger as FU1
      "FU4: Question Type": "yesNoNA",
      "FU4: Required": "FALSE",
      "FU4: SubParam1": "Charging System",
      "FU4: SubParam2": "Battery",
      "FU4: Question Text": "Is the charging system working properly?",

      // FU5: FINAL ELECTRICAL QUESTION
      "FU5: Option": "Yes", // Same trigger as FU1
      "FU5: Question Type": "shortText",
      "FU5: Required": "FALSE",
      "FU5: SubParam1": "Additional Info",
      "FU5: SubParam2": "Details",
      "FU5: Question Text": "Any recent electrical modifications?",
    },
    {
      "Section Weightage": "80",

      // ========== MAIN QUESTION 5: SUSPENSION & HANDLING (SIMPLE FOLLOW-UPS - NO NESTING) ==========
      Question: "Are there any suspension or handling issues?",
      "Question Description": "Problems with ride comfort and control",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Suspension",
      SubParam2: "Handling",

      // FU1: FOR YES (SIMPLE - NO NESTING)
      "FU1: Option": "Yes",
      "FU1: Question Type": "multipleChoice",
      "FU1: Required": "TRUE",
      "FU1: SubParam1": "Suspension Problem",
      "FU1: SubParam2": "Ride Quality",
      "FU1: Question Text": "What handling issue do you notice?",
      "FU1: Options": "Too Soft,Too Hard,Uneven,Bottoming Out,Noise Over Bumps",

      // FU2: FOR NO (SIMPLE - NO NESTING)
      "FU2: Option": "No",
      "FU2: Question Type": "shortText",
      "FU2: Required": "FALSE",
      "FU2: SubParam1": "Suspension Status",
      "FU2: SubParam2": "Good Condition",
      "FU2: Question Text": "When was suspension last serviced?",

      // FU3: FOR N/A (SIMPLE - NO NESTING)
      "FU3: Option": "N/A",
      "FU3: Question Type": "shortText",
      "FU3: Required": "FALSE",
      "FU3: SubParam1": "Not Applicable",
      "FU3: SubParam2": "Explanation",
      "FU3: Question Text": "Why is suspension not applicable?",

      // FU4: ADDITIONAL SUSPENSION QUESTION
      "FU4: Option": "Yes", // Same trigger as FU1
      "FU4: Question Type": "multipleChoice",
      "FU4: Required": "FALSE",
      "FU4: SubParam1": "Ride Quality",
      "FU4: SubParam2": "Comfort",
      "FU4: Question Text": "How would you rate ride comfort?",
      "FU4: Options":
        "Very Comfortable,Comfortable,Average,Uncomfortable,Very Uncomfortable",

      // FU5: FINAL SUSPENSION QUESTION
      "FU5: Option": "Yes", // Same trigger as FU1
      "FU5: Question Type": "shortText",
      "FU5: Required": "FALSE",
      "FU5: SubParam1": "Additional Info",
      "FU5: SubParam2": "Details",
      "FU5: Question Text": "Any handling issues during cornering?",
    },
    {
      "Section Number": "3",
      "Section Title": "Service History & Preferences",
      "Section Description": "Previous service records and preferences",
      "Section Weightage": "20",
      "Section Merging": "",
      Question: "When was your last full service?",
      "Question Description": "Complete professional service",
      "Question Type": "dropdown",
      Required: "TRUE",
      Options: "Within 3 months,3-6 months,6-12 months,Over 1 year,Never",
      SubParam1: "Service History",
      SubParam2: "Maintenance",
    },
    {
      "Section Weightage": "20",
      Question: "What type of service do you prefer?",
      "Question Description": "Service package preference",
      "Question Type": "multipleChoice",
      Required: "TRUE",
      Options:
        "Basic Service,Standard Service,Comprehensive Service,Premium Service,Custom",
      SubParam1: "Service Preference",
      SubParam2: "Package",
    },
    {
      "Section Weightage": "20",
      Question: "Do you need a pickup/drop service?",
      "Question Description": "Transportation assistance",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Transport",
      SubParam2: "Logistics",
    },
  ];

  return sampleData;
}

export async function loadSampleFormData(): Promise<
  Partial<Question> & { sections: Section[] }
> {
  const sampleData = createSampleFormData();

  // Type assertion to FormRowData[]
  return parseNewTemplateFormat(sampleData as FormRowData[], []);
}

export function downloadNestedFormImportTemplate() {
  // Color definitions
  const COLORS = {
    MAIN: { fgColor: { rgb: "000000" } }, // Black for main headers
    FU_DARK: { fgColor: { rgb: "0000FF" } }, // Dark Blue
    FU_MEDIUM: { fgColor: { rgb: "6666FF" } }, // Medium Blue
    FU_LIGHT: { fgColor: { rgb: "CCCCFF" } }, // Light Blue
    FU_DARK_GREEN: { fgColor: { rgb: "008000" } }, // Dark Green
    FU_MEDIUM_GREEN: { fgColor: { rgb: "66B266" } }, // Medium Green
    FU_LIGHT_GREEN: { fgColor: { rgb: "CCE5CC" } }, // Light Green
  };

  // Helper function to get color for other FU groups
  function getColorForFULevel(fuNumber, level) {
    const baseColors = {
      "1": { dark: "0000FF", medium: "6666FF", light: "CCCCFF" },
      "2": { dark: "008000", medium: "66B266", light: "CCE5CC" },
      "3": { dark: "800080", medium: "B266B2", light: "E5CCE5" }, // Purple
      "4": { dark: "FF6600", medium: "FF9966", light: "FFCC99" }, // Orange
      "5": { dark: "FF0000", medium: "FF6666", light: "FFCCCC" }, // Red
    };

    const colorHex =
      baseColors[fuNumber]?.[
        level === 1 ? "dark" : level === 2 ? "medium" : "light"
      ] || "000000";

    return { fgColor: { rgb: colorHex } };
  }

  // Helper function to get contrasting text color
  function getContrastTextColor(hexColor) {
    // Remove # if present
    hexColor = hexColor.replace("#", "");

    // Convert hex to RGB
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black or white based on luminance
    return luminance > 0.5 ? "000000" : "FFFFFF";
  }

  const mainHeaders = [
    "Form Title",
    "Form Description",
    "Section Number",
    "Section Title",
    "Section Description",
    "Section Weightage",
    "Next Section",
    "Section Merging",
    "Question",
    "Question Description",
    "Question Type",
    "Required",
    "Options",
    "Branching",
    "Suggestion",
    "SubParam1",
    "SubParam2",
    "Allowed File Types",
    "Correct Answer",
    "Correct Answers",
  ];

  const followUpHeaders = [];

  // Generate headers for nested follow-ups (up to 3 levels deep)
  for (let level1 = 1; level1 <= 5; level1++) {
    // Level 1 follow-ups (FU1:, FU2:, etc.)
    followUpHeaders.push(
      `FU${level1}: Option`,
      `FU${level1}: Question Type`,
      `FU${level1}: Required`,
      `FU${level1}: SubParam1`,
      `FU${level1}: SubParam2`,
      `FU${level1}: Question Text`,
      `FU${level1}: Options`,
      `FU${level1}: Correct Answer`
    );

    // Level 2 follow-ups (FU1.1:, FU1.2:, etc.)
    for (let level2 = 1; level2 <= 3; level2++) {
      followUpHeaders.push(
        `FU${level1}.${level2}: Option`,
        `FU${level1}.${level2}: Question Type`,
        `FU${level1}.${level2}: Required`,
        `FU${level1}.${level2}: SubParam1`,
        `FU${level1}.${level2}: SubParam2`,
        `FU${level1}.${level2}: Question Text`,
        `FU${level1}.${level2}: Options`,
        `FU${level1}.${level2}: Correct Answer`
      );

      // Level 3 follow-ups (FU1.1.1:, FU1.1.2:, etc.)
      for (let level3 = 1; level3 <= 2; level3++) {
        followUpHeaders.push(
          `FU${level1}.${level2}.${level3}: Option`,
          `FU${level1}.${level2}.${level3}: Question Type`,
          `FU${level1}.${level2}.${level3}: Required`,
          `FU${level1}.${level2}.${level3}: SubParam1`,
          `FU${level1}.${level2}.${level3}: SubParam2`,
          `FU${level1}.${level2}.${level3}: Question Text`,
          `FU${level1}.${level2}.${level3}: Options`,
          `FU${level1}.${level2}.${level3}: Correct Answer`
        );
      }
    }
  }
  const headers = [...mainHeaders, ...followUpHeaders];

  const descriptions = [
    "Name of the form",
    "Overview/purpose of the form",
    "Which section (1, 2, 3...)",
    "Title of the section",
    "Description of what this section covers",
    "Percentage weight (0-100, must total 100% if used)",
    "Next section to navigate to (number or 'end')",
    "Mark which columns should be merged together (e.g., 1,2 means columns 1 and 2 merge; leave blank to not merge)",
    "The question text to ask",
    "Additional details about the question",
    "Type: shortText, longText, multipleChoice, checkboxes, dropdown, searchableselect, hierarchy, yesNoNA, file",
    "TRUE/FALSE - is this question required?",
    "For multipleChoice/checkboxes/dropdown/searchableselect: option1,option2,option3 (comma-separated)",
    "Section branching: comma-separated section numbers for each option (e.g., 2,3,4 means option1→sec2, option2→sec3, option3→sec4; use 0 to skip)",
    "Suggestions or recommendations for this question",
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
      "Section Merging": "",
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
      "Section Merging": "",
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
      "Section Merging": "",
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
      "Section Merging": "",
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
      "Section Merging": "",
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
      "Section Merging": "",
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
      "Section Merging": "",
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
      "Section Merging": "",
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
      "Section Merging": "",
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
      "Section Merging": "",
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
      "Section Merging": "",
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
      "Section Merging": "",
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
      "Section Merging": "",
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
      "Section Merging": "",
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
      "Section Merging": "",
      Question: "Please upload any supporting documents (optional)",
      "Question Type": "file",
      Required: "FALSE",
      Options: "",
      SubParam1: "Service History",
      SubParam2: "Document Verification",
      "Allowed File Types": "pdf,image",
      "Correct Answer": "",
      "Correct Answers": "",
    },
  ];

  // Track section counts for merging
  const sectionCounts: Record<string, number> = {};
  const sectionFirstRow: Record<string, number> = {};

  rows.forEach((row) => {
    const sectionNum = row["Section Number"]?.toString().trim();
    if (sectionNum) {
      sectionCounts[sectionNum] = (sectionCounts[sectionNum] || 0) + 1;
      if (!sectionFirstRow[sectionNum]) {
        sectionFirstRow[sectionNum] = templateData.length + 3; // +3 for header, description, separator rows
      }
    }
  });

  rows.forEach((row: any, rowIndex) => {
    // Use `any` type
    const sectionNum = row["Section Number"]?.toString().trim();

    // Build branching string from individual columns or combined branching column
    let branchingStr = "";
    const branchingValues: (string | number)[] = [];

    // Check if we have the old format (5 separate columns)
    for (let i = 1; i <= 5; i++) {
      const branchKey = `Branching: Option ${i} Section`;
      if (row[branchKey]) {
        branchingValues.push(row[branchKey]);
      } else {
        branchingValues.push(0);
      }
    }

    // Only include if there's actual branching data
    if (branchingValues.some((v) => v !== 0 && v !== "")) {
      branchingStr = branchingValues.join(",");
    }

    const fullRow: Record<string, any> = {
      "Form Title": row["Form Title"] || "",
      "Form Description": row["Form Description"] || "",
      "Section Number": row["Section Number"] || "",
      "Section Title": row["Section Title"] || "",
      "Section Description": row["Section Description"] || "",
      "Section Merging": "",
      Question: row.Question || "",
      "Question Description": row["Question Description"] || "",
      "Question Type": row["Question Type"] || "",
      Required: row.Required || "FALSE",
      Options: row.Options || "",
      Branching: branchingStr,
      Suggestion: row["Suggestion"] || "",
      SubParam1: row.SubParam1 || "",
      SubParam2: row.SubParam2 || "",
      "Allowed File Types": row["Allowed File Types"] || "",
      "Correct Answer": row["Correct Answer"] || "",
      "Correct Answers": row["Correct Answers"] || "",
    };

    // Add merge instructions for section columns (3-6) when same section has multiple questions
    if (sectionNum && sectionCounts[sectionNum] > 1) {
      const currentRowNum = templateData.length + 3; // +3 for header rows
      const firstRow = sectionFirstRow[sectionNum];
      // Merge columns 3-6 (C-F: Section Number, Title, Description, Weightage)
      fullRow["Section Merging"] = `C${firstRow}:F${
        firstRow + sectionCounts[sectionNum] - 1
      }`;
    }

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

  const headerArray = [...mainHeaders, ...followUpHeaders];

  const worksheet = utils.json_to_sheet(templateData, {
    header: headerArray,
  });

  worksheet["!cols"] = headerArray.map(() => ({ wch: 25 }));

  // Apply styling to header row (row 1)
  const HEADER_ROW = 1; // Excel is 1-indexed, row 1 is header

  headerArray.forEach((header, colIndex) => {
    const cellAddress = utils.encode_cell({ r: HEADER_ROW - 1, c: colIndex });

    if (!worksheet[cellAddress]) {
      worksheet[cellAddress] = {};
    }

    // Default to main header color
    let color = COLORS.MAIN;

    // Check for follow-up headers and apply appropriate colors
    if (header.includes("FU")) {
      const fuMatch = header.match(/^FU(\d+)(?:\.(\d+)(?:\.(\d+))?)?/);

      if (fuMatch) {
        const [, level1, level2, level3] = fuMatch;

        if (level3) {
          // Level 3 headers (e.g., FU1.1.1)
          color =
            level1 === "1"
              ? COLORS.FU_LIGHT
              : level1 === "2"
              ? COLORS.FU_LIGHT_GREEN
              : getColorForFULevel(level1, 3);
        } else if (level2) {
          // Level 2 headers (e.g., FU1.1)
          color =
            level1 === "1"
              ? COLORS.FU_MEDIUM
              : level1 === "2"
              ? COLORS.FU_MEDIUM_GREEN
              : getColorForFULevel(level1, 2);
        } else {
          // Level 1 headers (e.g., FU1)
          color =
            level1 === "1"
              ? COLORS.FU_DARK
              : level1 === "2"
              ? COLORS.FU_DARK_GREEN
              : getColorForFULevel(level1, 1);
        }
      }
    }
    worksheet[cellAddress].s = {
      fill: {
        patternType: "solid",
        ...color,
      },
      font: {
        bold: true,
        color: { rgb: getContrastTextColor(color.fgColor.rgb) },
      },
    };
  });

  templateData.forEach((row, idx) => {
    const mergeInstructions = row["Section Merging"];
    if (mergeInstructions && typeof mergeInstructions === "string") {
      // Parse merge instructions like "C5:F10"
      try {
        worksheet["!merges"].push(utils.decode_range(mergeInstructions));
      } catch (e) {
        console.warn(`Failed to parse merge instruction: ${mergeInstructions}`);
      }
    }
  });

  // Add data validation for SubParam1 and SubParam2 columns
  // Add data validation for SubParam1 and SubParam2 columns
  worksheet["!datavalidation"] = [
    {
      sqref: "M5:M1000", // SubParam1 column M (13), from row 5 onwards (was L, now M)
      type: "list",
      formula1: "=Parameters!$A$4:$A$1000",
    },
    {
      sqref: "N5:N1000", // SubParam2 column N (14) (was M, now N)
      type: "list",
      formula1: "=Parameters!$A$4:$A$1000",
    },
    {
      sqref: "T5:T1000", // FU1:SubParam1 column T (20) (was S, now T)
      type: "list",
      formula1: "=Parameters!$A$4:$A$1000",
    },
    {
      sqref: "U5:U1000", // FU1:SubParam2 column U (21) (was T, now U)
      type: "list",
      formula1: "=Parameters!$A$4:$A$1000",
    },
    {
      sqref: "AC5:AC1000", // FU2:SubParam1 column AC (29) (was AB, now AC)
      type: "list",
      formula1: "=Parameters!$A$4:$A$1000",
    },
    {
      sqref: "AD5:AD1000", // FU2:SubParam2 column AD (30) (was AC, now AD)
      type: "list",
      formula1: "=Parameters!$A$4:$A$1000",
    },
    {
      sqref: "AK5:AK1000", // FU3:SubParam1 column AK (37) (was AJ, now AK)
      type: "list",
      formula1: "=Parameters!$A$4:$A$1000",
    },
    {
      sqref: "AL5:AL1000", // FU3:SubParam2 column AL (38) (was AK, now AL)
      type: "list",
      formula1: "=Parameters!$A$4:$A$1000",
    },
  ];

  // Create Parameters sheet
  const parametersHeaders = ["Parameter Name", "Type"];
  const parametersDescriptions = [
    "Name of the parameter",
    "Type: Main or Followup",
  ];

  const parametersHeaderRow = {
    "Parameter Name": "Parameter Name",
    Type: "Type",
  };

  const parametersDescriptionRow = {
    "Parameter Name": parametersDescriptions[0],
    Type: parametersDescriptions[1],
  };

  const parametersSeparatorRow = {
    "Parameter Name": "",
    Type: "",
  };

  const parametersSampleData = [
    { "Parameter Name": "Eligibility", Type: "Main" },
    { "Parameter Name": "Document Verification", Type: "Main" },
    { "Parameter Name": "Service History", Type: "Main" },
    { "Parameter Name": "Quality Assessment", Type: "Followup" },
    { "Parameter Name": "Feedback Collection", Type: "Followup" },
  ];

  const parametersData = [
    parametersHeaderRow,
    parametersDescriptionRow,
    parametersSeparatorRow,
    ...parametersSampleData,
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

export function downloadFormImportTemplate() {
  // Color definitions
  const COLORS = {
    MAIN: { fgColor: { rgb: "000000" } }, // Black for main headers
    FU_DARK: { fgColor: { rgb: "0041C2" } }, // Dark Blue for follow-ups
  };

  // Helper function to get contrasting text color
  function getContrastTextColor(hexColor) {
    // Remove # if present
    hexColor = hexColor.replace("#", "");

    // Convert hex to RGB
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black or white based on luminance
    return luminance > 0.5 ? "000000" : "FFFFFF";
  }

  const mainHeaders = [
    "Form Title",
    "Form Description",
    "Section Number",
    "Section Title",
    "Section Description",
    "Section Weightage",
    "Next Section",
    "Section Merging",
    "Question",
    "Question Description",
    "Question Type",
    "Required",
    "Options",
    "Branching",
    "Suggestion",
    "SubParam1",
    "SubParam2",
    "Allowed File Types",
    "Correct Answer",
    "Correct Answers",
  ];

  const followUpHeaders = [];

  // Generate headers for UNLIMITED main follow-ups (1-99)
  for (let fuIndex = 1; fuIndex <= 99; fuIndex++) {
    followUpHeaders.push(
      `FU${fuIndex}: Option`,
      `FU${fuIndex}: Question Type`,
      `FU${fuIndex}: Required`,
      `FU${fuIndex}: SubParam1`,
      `FU${fuIndex}: SubParam2`,
      `FU${fuIndex}: Question Text`,
      `FU${fuIndex}: Options`,
      `FU${fuIndex}: Correct Answer`
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
    "Next section to navigate to (number or 'end')",
    "Mark which columns should be merged together (e.g., 1,2 means columns 1 and 2 merge; leave blank to not merge)",
    "The question text to ask",
    "Additional details about the question",
    "Type: shortText, longText, multipleChoice, checkboxes, dropdown, yesNoNA, file",
    "TRUE/FALSE - is this question required?",
    "For multipleChoice/checkboxes/dropdown: option1,option2,option3 (comma-separated)",
    "Section branching: comma-separated section numbers for each option (e.g., 2,3,4 means option1→sec2, option2→sec3, option3→sec4; use 0 to skip)",
    "Suggestions or recommendations for this question",
    "Additional parameter 1 for custom question configuration",
    "Additional parameter 2 for custom question configuration",
    "For fileUpload: allowed file types (image,pdf,excel) - comma-separated",
    "For quiz: correct answer value",
    "For quiz: multiple correct answers separated by |",
  ];

  // Add descriptions for follow-up columns
  for (let i = 1; i <= 99; i++) {
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

  const formTitle = "Follow-up Testing Form - Unlimited Main Follow-ups";
  const formDesc =
    "Test form with support for unlimited main level follow-up questions";

  const rows = [
    {
      "Form Title": formTitle,
      "Form Description": formDesc,
      "Section Number": "1",
      "Section Title": "Section 1: Basic Screening",
      "Section Description":
        "Initial qualification questions",
      "Section Weightage": "30",
      "Section Merging": "",
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
      "Section Number": "2",
      "Section Title": "Section 2: Service Experience",
      "Section Description":
        "Questions about service experience with many follow-ups",
      "Section Weightage": "40",
      "Section Merging": "",
      Question: "Are you satisfied with our service quality?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      SubParam1: "Satisfaction Rating",
      SubParam2: "Quality Assessment",
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
      // Can add FU4, FU5, ... up to FU99 here
    },
  ];

  // Track section counts for merging
  const sectionCounts: Record<string, number> = {};
  const sectionFirstRow: Record<string, number> = {};

  rows.forEach((row) => {
    const sectionNum = row["Section Number"]?.toString().trim();
    if (sectionNum) {
      sectionCounts[sectionNum] = (sectionCounts[sectionNum] || 0) + 1;
      if (!sectionFirstRow[sectionNum]) {
        sectionFirstRow[sectionNum] = templateData.length + 3; // +3 for header, description, separator rows
      }
    }
  });

  rows.forEach((row: any) => {
    const sectionNum = row["Section Number"]?.toString().trim();

    // Build branching string
    let branchingStr = "";
    const branchingValues: (string | number)[] = [];

    // Check if we have the old format (5 separate columns)
    for (let i = 1; i <= 5; i++) {
      const branchKey = `Branching: Option ${i} Section`;
      if (row[branchKey]) {
        branchingValues.push(row[branchKey]);
      } else {
        branchingValues.push(0);
      }
    }

    // Only include if there's actual branching data
    if (branchingValues.some((v) => v !== 0 && v !== "")) {
      branchingStr = branchingValues.join(",");
    }

    const fullRow: Record<string, any> = {
      "Form Title": row["Form Title"] || "",
      "Form Description": row["Form Description"] || "",
      "Section Number": row["Section Number"] || "",
      "Section Title": row["Section Title"] || "",
      "Section Description": row["Section Description"] || "",
      "Section Merging": "",
      Question: row.Question || "",
      "Question Description": row["Question Description"] || "",
      "Question Type": row["Question Type"] || "",
      Required: row.Required || "FALSE",
      Options: row.Options || "",
      Branching: branchingStr,
      Suggestion: row["Suggestion"] || "",
      SubParam1: row.SubParam1 || "",
      SubParam2: row.SubParam2 || "",
      "Allowed File Types": row["Allowed File Types"] || "",
      "Correct Answer": row["Correct Answer"] || "",
      "Correct Answers": row["Correct Answers"] || "",
    };

    // Add merge instructions for section columns (3-6) when same section has multiple questions
    if (sectionNum && sectionCounts[sectionNum] > 1) {
      const currentRowNum = templateData.length + 3; // +3 for header rows
      const firstRow = sectionFirstRow[sectionNum];
      // Merge columns 3-6 (C-F: Section Number, Title, Description, Weightage)
      fullRow["Section Merging"] = `C${firstRow}:F${
        firstRow + sectionCounts[sectionNum] - 1
      }`;
    }

    // Add follow-up columns dynamically (1-99)
    for (let i = 1; i <= 99; i++) {
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

  const headerArray = [...mainHeaders, ...followUpHeaders];

  const worksheet = utils.json_to_sheet(templateData, {
    header: headerArray,
  });

  worksheet["!cols"] = headerArray.map(() => ({ wch: 25 }));

  // Apply styling to header row (row 1)
  const HEADER_ROW = 1; // Excel is 1-indexed, row 1 is header

  headerArray.forEach((header, colIndex) => {
    const cellAddress = utils.encode_cell({ r: HEADER_ROW - 1, c: colIndex });

    if (!worksheet[cellAddress]) {
      worksheet[cellAddress] = {};
    }

    // Default to main header color
    let color = COLORS.MAIN;

    // Check for follow-up headers and apply blue color
    if (header.includes("FU")) {
      color = COLORS.FU_DARK;
    }

    worksheet[cellAddress].s = {
      fill: {
        patternType: "solid",
        ...color,
      },
      font: {
        bold: true,
        color: { rgb: getContrastTextColor(color.fgColor.rgb) },
      },
    };
  });

  templateData.forEach((row) => {
    const mergeInstructions = row["Section Merging"];
    if (mergeInstructions && typeof mergeInstructions === "string") {
      // Parse merge instructions like "C5:F10"
      try {
        if (!worksheet["!merges"]) worksheet["!merges"] = [];
        worksheet["!merges"].push(utils.decode_range(mergeInstructions));
      } catch (e) {
        console.warn(`Failed to parse merge instruction: ${mergeInstructions}`);
      }
    }
  });

  // Add data validation for SubParam columns
  // Calculate column indices dynamically
  const mainSubParam1Col = utils.encode_col(mainHeaders.indexOf("SubParam1"));
  const mainSubParam2Col = utils.encode_col(mainHeaders.indexOf("SubParam2"));
  
  // For follow-up SubParam columns, we need to calculate based on header position
  const dataValidations: any[] = [
    {
      sqref: `${mainSubParam1Col}5:${mainSubParam1Col}1000`,
      type: "list",
      formula1: "=Parameters!$A$4:$A$1000",
    },
    {
      sqref: `${mainSubParam2Col}5:${mainSubParam2Col}1000`,
      type: "list",
      formula1: "=Parameters!$A$4:$A$1000",
    },
  ];

  // Add data validation for first 10 follow-ups (can be extended)
  for (let fuIndex = 1; fuIndex <= 10; fuIndex++) {
    const fuSubParam1Header = `FU${fuIndex}: SubParam1`;
    const fuSubParam2Header = `FU${fuIndex}: SubParam2`;
    
    const fuSubParam1Index = headerArray.indexOf(fuSubParam1Header);
    const fuSubParam2Index = headerArray.indexOf(fuSubParam2Header);
    
    if (fuSubParam1Index !== -1) {
      const colLetter = utils.encode_col(fuSubParam1Index);
      dataValidations.push({
        sqref: `${colLetter}5:${colLetter}1000`,
        type: "list",
        formula1: "=Parameters!$A$4:$A$1000",
      });
    }
    
    if (fuSubParam2Index !== -1) {
      const colLetter = utils.encode_col(fuSubParam2Index);
      dataValidations.push({
        sqref: `${colLetter}5:${colLetter}1000`,
        type: "list",
        formula1: "=Parameters!$A$4:$A$1000",
      });
    }
  }

  worksheet["!datavalidation"] = dataValidations;

  // Create Parameters sheet
  const parametersHeaders = ["Parameter Name", "Type"];
  const parametersDescriptions = [
    "Name of the parameter",
    "Type: Main or Followup",
  ];

  const parametersHeaderRow = {
    "Parameter Name": "Parameter Name",
    Type: "Type",
  };

  const parametersDescriptionRow = {
    "Parameter Name": parametersDescriptions[0],
    Type: parametersDescriptions[1],
  };

  const parametersSeparatorRow = {
    "Parameter Name": "",
    Type: "",
  };

  const parametersSampleData = [
    { "Parameter Name": "Eligibility", Type: "Main" },
    { "Parameter Name": "Document Verification", Type: "Main" },
    { "Parameter Name": "Service History", Type: "Main" },
    { "Parameter Name": "Quality Assessment", Type: "Followup" },
    { "Parameter Name": "Feedback Collection", Type: "Followup" },
  ];

  const parametersData = [
    parametersHeaderRow,
    parametersDescriptionRow,
    parametersSeparatorRow,
    ...parametersSampleData,
  ];

  const parametersWorksheet = utils.json_to_sheet(parametersData, {
    header: parametersHeaders,
  });

  parametersWorksheet["!cols"] = parametersHeaders.map(() => ({ wch: 25 }));

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, parametersWorksheet, "Parameters");
  utils.book_append_sheet(workbook, worksheet, "Form Template");
  writeFile(workbook, "form-import-template-unlimited-followups.xlsx");
}

export function downloadLinkingFormImportTemplate() {
  const mainHeaders = [
    "Form Title",
    "Form Description",
    "Section Number",
    "Section Title",
    "Section Description",
    "Section Weightage",
    "Next Section",
    "Section Merging",
    "Question",
    "Question Description",
    "Question Type",
    "Required",
    "Options",
    "Branching",
    "Suggestion",
    "SubParam1",
    "SubParam2",
    "Allowed File Types",
    "Correct Answer",
    "Correct Answers",
  ];

  const sampleData = [
    {
      "Form Title": "Conditional Flow Service Form",
      "Form Description": "A form demonstrating section jumping and early submission",
      "Section Number": "1",
      "Section Title": "Initial Screening",
      "Section Description": "Basic check to determine service path",
      "Section Weightage": "25",
      "Next Section": "2",
      Question: "What type of service do you need?",
      "Question Type": "multipleChoice",
      Required: "TRUE",
      Options: "Quick Repair,Full Service,Consultation",
      Branching: "2,3,4",
    },
    {
      "Section Number": "2",
      "Section Title": "Quick Repair Details",
      "Section Description": "Simple fixes only",
      "Section Weightage": "25",
      "Next Section": "end",
      Question: "Describe the issue briefly",
      "Question Type": "longText",
      Required: "TRUE",
    },
    {
      "Section Number": "3",
      "Section Title": "Full Service Checklist",
      "Section Description": "Comprehensive maintenance",
      "Section Weightage": "25",
      "Next Section": "end",
      Question: "Select items to be checked",
      "Question Type": "checkboxes",
      Options: "Engine,Brakes,Tires,Electrical",
      Required: "TRUE",
    },
    {
      "Section Number": "4",
      "Section Title": "Consultation Booking",
      "Section Description": "Speak with an expert",
      "Section Weightage": "25",
      "Next Section": "end",
      Question: "Preferred date for consultation",
      "Question Type": "date",
      Required: "TRUE",
    }
  ];

  const worksheet = styleUtils.json_to_sheet(sampleData, { header: mainHeaders });
  const workbook = styleUtils.book_new();
  styleUtils.book_append_sheet(workbook, worksheet, "Form Import");

  // Apply basic styling to headers
  const range = styleUtils.decode_range(worksheet["!ref"] || "A1:Z1");
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = styleUtils.encode_col(C) + "1";
    if (!worksheet[address]) continue;
    worksheet[address].s = {
      fill: { fgColor: { rgb: "000000" } },
      font: { color: { rgb: "FFFFFF" }, bold: true },
      alignment: { horizontal: "center" }
    };
  }

  writeFile(workbook, "form-import-template-section-linking.xlsx");
}

export async function parseFormWorkbook(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "array" });

  const sheetNames = workbook.SheetNames;

  // Find Parameters sheet
  const parametersSheetIndex = sheetNames.findIndex((name) =>
    name.toLowerCase().includes("parameter")
  );
  const parametersSheet =
    parametersSheetIndex >= 0
      ? workbook.Sheets[sheetNames[parametersSheetIndex]]
      : null;

  // Find Form Template sheet
  const formSheetIndex = sheetNames.findIndex(
    (name) =>
      name.toLowerCase().includes("form") ||
      name.toLowerCase().includes("template")
  );
  const formSheet =
    formSheetIndex >= 0
      ? workbook.Sheets[sheetNames[formSheetIndex]]
      : workbook.Sheets[sheetNames[0]];

  if (!formSheet) {
    throw new Error("Workbook must have a Form Template sheet");
  }

  // Parse parameters from Parameters sheet
  let parametersToCreate: Array<{ name: string; type: "main" | "followup" }> =
    [];
  if (parametersSheet) {
    const parametersRawData = utils.sheet_to_json<Record<string, any>>(
      parametersSheet,
      {
        defval: "",
      }
    );

    // Extract parameters - find the parameter name column (case-insensitive)
    parametersToCreate = parametersRawData
      .filter((row) => {
        // Find the first non-empty value that isn't a header
        const firstValue = Object.values(row)[0]?.toString().trim() || "";
        return (
          firstValue &&
          firstValue.toLowerCase() !== "parameter name" &&
          firstValue !== ""
        );
      })
      .map((row) => {
        // Get the first non-empty value as parameter name
        const paramName = Object.values(row)[0]?.toString().trim() || "";
        // Get the second value as type, default to 'main'
        const typeValue =
          Object.values(row)[1]?.toString().trim().toLowerCase() || "main";

        return {
          name: paramName,
          type: (typeValue === "followup" ? "followup" : "main") as
            | "main"
            | "followup",
        };
      })
      .filter((p) => p.name && p.name.toLowerCase() !== "parameter name"); // Final validation
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
    parametersToCreate,
  };
}

function parseNewTemplateFormat(
  rows: FormRowData[],
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
  const sectionMergingMap = new Map<string, string>(); // Map to store section merging info
  const normalizeQuestionType = (type: string): string => {
    if (!type) return "text";

    const normalizedType = String(type)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ") // normalize multiple spaces to single space
      .replace(/\s*\/\s*/g, ""); // remove slashes and surrounding spaces

    const typeMap: Record<string, string> = {
      // Legacy/UI type names - without spaces/slashes
      shorttext: "text",
      shortint: "text",
      multiplechoice: "radio", // This should be "radio"
      longtext: "paragraph",
      longinput: "paragraph",
      dropdown: "search-select", // Defaulting dropdown to search-select
      checkboxes: "checkbox",
      fileupload: "file",
      "file upload": "file",
      fileuploader: "file",

      // Yes/No variations
      yesnona: "yesNoNA",
      "yes/no/na": "yesNoNA",
      "yes/no/n/a": "yesNoNA",

      // Core types - pass through
      text: "text",
      radio: "radio", // Ensure radio stays radio
      paragraph: "paragraph",
      select: "search-select", // Map select to search-select for better UX
      checkbox: "checkbox",
      file: "file",

      // Add these mappings for common variations
      "multiple choice": "radio",
      "drop down": "search-select",
      "drop-down": "search-select",
      "multi choice": "radio",
      "multi-choice": "radio",

      // New types
      "searchable select": "search-select",
      "search-select": "search-select",
      "searchableselect": "search-select",
      "product nps buckets": "productNPSTGWBuckets",
      "productnpstgwbuckets": "productNPSTGWBuckets",
      "hierarchy": "productNPSTGWBuckets",
    };

    // First try exact match after normalization
    if (typeMap[normalizedType]) {
      console.log(
        `[TYPE MAPPING] "${type}" → "${normalizedType}" → "${typeMap[normalizedType]}"`
      );
      return typeMap[normalizedType];
    }

    // If not found, try with spaces removed entirely
    const noSpaces = normalizedType.replace(/\s/g, "");
    if (typeMap[noSpaces]) {
      console.log(
        `[TYPE MAPPING] "${type}" → "${noSpaces}" → "${typeMap[noSpaces]}"`
      );
      return typeMap[noSpaces];
    }

    console.warn(
      `[TYPE MAPPING] Unknown type: "${type}", defaulting to "text"`
    );
    return "text";
  };
  function parseNestedFollowUps(
    row: FormRowData,
    parentQuestion: FollowUpQuestion,
    parentId: string,
    levelPath: string
  ) {
    console.log(
      `[NESTED] Parsing level ${levelPath} for parent: ${parentQuestion.text}`
    );

    // Find all child columns for this level
    const childPattern = new RegExp(`^FU${levelPath}\\.(\\d+):\\s*(.+)$`);
    const childColumns = Object.keys(row).filter((key) =>
      childPattern.test(key)
    );

    console.log(
      `[NESTED] Found ${childColumns.length} child columns:`,
      childColumns
    );

    if (childColumns.length === 0) return;

    // Group by child number (1, 2, 3, etc.)
    const childGroups = new Map<number, Record<string, string>>();

    childColumns.forEach((column) => {
      const match = column.match(childPattern);
      if (!match) return;

      const childNum = parseInt(match[1]);
      const columnType = match[2].trim(); // "Option", "Question Type", etc.

      if (!childGroups.has(childNum)) {
        childGroups.set(childNum, {});
      }

      const childData = childGroups.get(childNum)!;
      childData[columnType] = row[column]?.toString().trim() || "";
    });

    console.log(`[NESTED] Child groups:`, Array.from(childGroups.entries()));

    // Process each child group
    childGroups.forEach((childData, childNum) => {
      const childOption = childData["Option"];
      const childType = childData["Question Type"];
      const childText = childData["Question Text"];

      console.log(`[NESTED] Processing child ${childNum}:`, {
        childOption,
        childType,
        childText,
      });

      if (!childOption || !childType || !childText) {
        console.warn(`[NESTED] Missing required fields for child ${childNum}`);
        return;
      }

      const childRequired =
        (childData["Required"] || "FALSE").toLowerCase() === "true";
      const childSubParam1 = childData["SubParam1"] || undefined;
      const childSubParam2 = childData["SubParam2"] || undefined;
      const childOptionsStr = childData["Options"] || "";
      const childCorrectAnswer = childData["Correct Answer"] || undefined;

      const childOptions = childOptionsStr
        ? childOptionsStr
            .split(",")
            .map((opt) => opt.trim())
            .filter(Boolean)
        : undefined;

      const childQuestionId = generateId();
      const childQuestion: FollowUpQuestion = {
        id: childQuestionId,
        text: childText,
        type: normalizeQuestionType(childType) as FollowUpQuestion["type"],
        required: childRequired,
        options: childOptions,
        followUpQuestions: [],
        sectionId: parentQuestion.sectionId,
        correctAnswer: childCorrectAnswer,
        showWhen: {
          questionId: parentId,
          value: childOption,
        },
        subParam1: childSubParam1,
        subParam2: childSubParam2,
        allowedFileTypes: undefined,
      };

      // Add to parent's follow-ups
      parentQuestion.followUpQuestions = parentQuestion.followUpQuestions || [];
      parentQuestion.followUpQuestions.push(childQuestion);

      console.log(
        `[NESTED] Added child question: ${childText} to parent: ${parentQuestion.text}`
      );

      // Recursively parse deeper levels
      const nextLevelPath = levelPath
        ? `${levelPath}.${childNum}`
        : childNum.toString();
      parseNestedFollowUps(row, childQuestion, childQuestionId, nextLevelPath);
    });
  }

  // Helper function to find column name (case-insensitive and flexible)
  const findColumnName = (
    availableColumns: string[],
    searchPatterns: string[]
  ): string | null => {
    // First try exact match
    const exactMatch = availableColumns.find((col) =>
      searchPatterns.some((p) => col === p)
    );
    if (exactMatch) return exactMatch;

    // Try case-insensitive match
    const caseInsensitiveMatch = availableColumns.find((col) =>
      searchPatterns.some((p) => col.toLowerCase() === p.toLowerCase())
    );
    if (caseInsensitiveMatch) return caseInsensitiveMatch;

    // Try loose match (contains any search term)
    const looseMatch = availableColumns.find((col) =>
      searchPatterns.some((p) => col.toLowerCase().includes(p.toLowerCase()))
    );
    if (looseMatch) {
      console.log(
        `[Excel Import] Using approximate column match: "${looseMatch}" for "${searchPatterns.join(
          ", "
        )}"`
      );
      return looseMatch;
    }

    return null;
  };

  // Log available columns for debugging
  let mergingColumnName = "Section Merging";
  let nextSectionColumnName = "Next Section";
  if (rows.length > 0) {
    const availableColumns = Object.keys(rows[0]);
    console.log("[Excel Import] Available columns:", availableColumns);

    const foundMergingColumn = findColumnName(availableColumns, [
      "Section Merging",
      "Merge",
      "Merging",
    ]);
    if (foundMergingColumn) {
      mergingColumnName = foundMergingColumn;
      console.log(
        `[Excel Import] "Section Merging" column found: ${mergingColumnName}`
      );
    } else {
      console.warn(
        "[Excel Import] Warning: 'Section Merging' column not found. Make sure your Excel has this column for section merging to work."
      );
    }

    const foundNextSectionColumn = findColumnName(availableColumns, [
      "Next Section",
      "NextSection",
      "NavigateTo",
      "Navigate To",
    ]);
    if (foundNextSectionColumn) {
      nextSectionColumnName = foundNextSectionColumn;
      console.log(
        `[Excel Import] "Next Section" column found: ${nextSectionColumnName}`
      );
    }
  }

  const sectionNavigationMap = new Map<string, string>();

  rows.forEach((row: FormRowData) => {
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
      const sectionMerging = row[mergingColumnName]?.toString().trim() || "";
      const nextSection = row[nextSectionColumnName]?.toString().trim() || "";

      console.log(
        `[Excel Import] Section ${sectionNo}: Title="${sectionTitle}", Merging="${sectionMerging}", NextSection="${nextSection}"`
      );

      if (sectionMerging) {
        sectionMergingMap.set(sectionNo, sectionMerging);
        console.log(
          `[Excel Import] Stored merging data for section ${sectionNo}: "${sectionMerging}"`
        );
      }

      if (nextSection) {
        sectionNavigationMap.set(sectionNo, nextSection);
        console.log(
          `[Excel Import] Stored navigation data for section ${sectionNo}: "${nextSection}"`
        );
      }

      if (!sectionsMap.has(sectionNo)) {
        const newSection = {
          id: generateId(),
          title: sectionTitle || `Section ${sectionNo}`,
          description: sectionDesc || "Section description",
          weightage: sectionWeightage ?? 0,
          questions: [],
          merging: sectionMerging || undefined,
          parentSectionId: undefined,
          isSubsection: false,
        };
        sectionsMap.set(sectionNo, newSection);
        console.log(
          `[Excel Import] Created new section ${sectionNo} with ID: ${
            newSection.id
          }, Merging: ${sectionMerging || "none"}`
        );
      } else if (sectionWeightage !== undefined || sectionMerging) {
        const existingSection = sectionsMap.get(sectionNo);
        if (existingSection) {
          if (sectionWeightage !== undefined) {
            existingSection.weightage = sectionWeightage;
          }
          if (sectionMerging) {
            existingSection.merging = sectionMerging;
            console.log(
              `[Excel Import] Updated merging for section ${sectionNo}: "${sectionMerging}"`
            );
          }
        }
      }
    }

    if (!currentSectionNo) {
      return;
    }

    const section = sectionsMap.get(currentSectionNo);
    if (!section) return;
    const suggestion = row["Suggestion"]?.toString().trim();
    const questionDesc = row["Question Description"]?.toString().trim();
    const questionTypeRaw = row["Question Type"]?.toString().trim() || "text";
    const questionType = normalizeQuestionType(questionTypeRaw);
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
      const isSubParam1Valid = parametersToCreate.some(
        (p) => p.name.toLowerCase() === subParam1.toLowerCase()
      );
      if (!isSubParam1Valid) {
        console.warn(
          `SubParam1 "${subParam1}" not found in parameters. Will be treated as custom value.`
        );
      }
    }

    if (subParam2 && parametersToCreate.length > 0) {
      const isSubParam2Valid = parametersToCreate.some(
        (p) => p.name.toLowerCase() === subParam2.toLowerCase()
      );
      if (!isSubParam2Valid) {
        console.warn(
          `SubParam2 "${subParam2}" not found in parameters. Will be treated as custom value.`
        );
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

    // Parse branching rules for section navigation
    const branchingRules: Array<{
      optionLabel: string;
      targetSectionId: string;
      isOtherOption?: boolean;
    }> = [];

    if (options && options.length > 0) {
      // Parse branching column (format: "2,3,4" where each number is section for each option)
      const branchingStr = row["Branching"]?.toString().trim() || "";
      if (branchingStr) {
        const branchingNumbers = branchingStr
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean);

        options.forEach((option, idx) => {
          const targetSectionNo = branchingNumbers[idx];
          if (targetSectionNo && targetSectionNo !== "0") {
            branchingRules.push({
              optionLabel: option,
              targetSectionId: targetSectionNo,
            });
          }
        });
      }
    }

    const question: FollowUpQuestion = {
      id: questionId,
      text: questionText,
      type: questionType as FollowUpQuestion["type"],
      required: required,
      options: options || undefined,
      description: questionDesc || undefined,
      suggestion: suggestion || undefined,
      subParam1: subParam1 || undefined,
      subParam2: subParam2 || undefined,
      allowedFileTypes: allowedFileTypes,
      followUpQuestions: [],
      sectionId: section.id,
      correctAnswer: correctAnswer || undefined,
      correctAnswers: correctAnswers,
      ...(branchingRules.length > 0 && { branchingRules }),
    };

    // Process level 1 follow-ups
    for (let fuIndex = 1; fuIndex <= 10; fuIndex++) {
      const fuOptionKey = `FU${fuIndex}: Option` as const;
      const fuTypeKey = `FU${fuIndex}: Question Type` as const;
      const fuRequiredKey = `FU${fuIndex}: Required` as const;
      const fuSubParam1Key = `FU${fuIndex}: SubParam1` as const;
      const fuSubParam2Key = `FU${fuIndex}: SubParam2` as const;
      const fuTextKey = `FU${fuIndex}: Question Text` as const;
      const fuOptionsKey = `FU${fuIndex}: Options` as const;
      const fuCorrectAnswerKey = `FU${fuIndex}: Correct Answer` as const;

      // Type-safe property access
      const fuOption = (row[fuOptionKey] as string)?.toString().trim();
      const fuTypeRaw = (row[fuTypeKey] as string)?.toString().trim();
      const fuType = fuTypeRaw ? normalizeQuestionType(fuTypeRaw) : "text";
      const fuText = (row[fuTextKey] as string)?.toString().trim();

      if (fuOption && fuType && fuText) {
        const fuRequiredStr =
          (row[fuRequiredKey] as string)?.toString().trim() || "FALSE";
        const fuRequired = fuRequiredStr.toLowerCase() === "true";
        const fuSubParam1 = (row[fuSubParam1Key] as string)?.toString().trim();
        const fuSubParam2 = (row[fuSubParam2Key] as string)?.toString().trim();
        const fuOptionsStr =
          (row[fuOptionsKey] as string)?.toString().trim() || "";
        const fuCorrectAnswer =
          (row[fuCorrectAnswerKey] as string)?.toString().trim() || "";

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

        // Parse nested follow-ups for this level 1 follow-up
        parseNestedFollowUps(row, followUp, followUpId, fuIndex.toString());

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

  // Create a mapping from section numbers to section IDs for branching
  const sectionNumberToIdMap = new Map<string, string>();
  sections.forEach((section, idx) => {
    const sectionNo = Array.from(sectionsMap.entries()).find(
      ([_, s]) => s.id === section.id
    )?.[0];
    if (sectionNo) {
      sectionNumberToIdMap.set(sectionNo, section.id);
    }
  });

  // Update branching rules to use section IDs instead of section numbers
  sections.forEach((section) => {
    section.questions.forEach((question) => {
      if (
        (question as any).branchingRules &&
        (question as any).branchingRules.length > 0
      ) {
        (question as any).branchingRules = (question as any).branchingRules.map(
          (rule: any) => {
            const sectionId = sectionNumberToIdMap.get(rule.targetSectionId);
            if (sectionId) {
              console.log(
                `[Branching] Mapping section number ${rule.targetSectionId} to ID ${sectionId}`
              );
              return {
                ...rule,
                targetSectionId: sectionId,
              };
            }
            return rule;
          }
        );
      }
    });
  });

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

  // Process section merging
  // Format: "1,2" means section 1 is parent, section 2 is subsection
  console.log(
    `[Section Merging] Processing merging data. Map size: ${sectionMergingMap.size}`
  );
  console.log(
    `[Section Merging] Merging map entries:`,
    Array.from(sectionMergingMap.entries())
  );

  sectionMergingMap.forEach((mergingStr, currentSectionNo) => {
    console.log(
      `[Section Merging] Processing section ${currentSectionNo}: "${mergingStr}"`
    );

    if (!mergingStr) {
      console.log(
        `[Section Merging] Section ${currentSectionNo} has empty merging string, skipping`
      );
      return;
    }

    const sectionNumbers = mergingStr
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

    console.log(
      `[Section Merging] Parsed section numbers: ${sectionNumbers.join(", ")}`
    );

    if (sectionNumbers.length < 2) {
      console.log(
        `[Section Merging] Only ${sectionNumbers.length} section(s) found, need at least 2 for merging`
      );
      return;
    }

    // First section is the parent
    const parentSectionNo = sectionNumbers[0];
    const parentSectionEntry = Array.from(sectionsMap.entries()).find(
      ([sectionNo]) => sectionNo === parentSectionNo
    );
    const parentSection = parentSectionEntry?.[1];

    if (!parentSection) {
      console.warn(
        `[Section Merging] Parent section ${parentSectionNo} not found in sections map`
      );
      return;
    }

    console.log(
      `[Section Merging] Parent section found: ${parentSectionNo} (ID: ${
        parentSection.id
      }), Children: ${sectionNumbers.slice(1).join(", ")}`
    );

    // Set remaining sections as subsections
    for (let i = 1; i < sectionNumbers.length; i++) {
      const childSectionNo = sectionNumbers[i];
      const childSectionEntry = Array.from(sectionsMap.entries()).find(
        ([sectionNo]) => sectionNo === childSectionNo
      );
      const childSection = childSectionEntry?.[1];

      if (childSection) {
        childSection.parentSectionId = parentSection.id;
        childSection.isSubsection = true;
        console.log(
          `[Section Merging] ✓ Set section ${childSectionNo} (ID: ${childSection.id}) as subsection of ${parentSectionNo}`
        );
      } else {
        console.warn(
          `[Section Merging] Child section ${childSectionNo} not found in sections map`
        );
      }
    }
  });

  console.log(
    `[Section Merging] Final sections after merging:`,
    sections.map((s) => ({
      id: s.id,
      title: s.title,
      isSubsection: s.isSubsection,
      parentSectionId: s.parentSectionId,
    }))
  );

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
