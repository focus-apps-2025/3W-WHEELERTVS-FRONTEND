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
    "Correct Answer",
    "Correct Answers",
  ];

  const followUpHeaders = [];
  for (let i = 1; i <= 10; i++) {
    followUpHeaders.push(
      `FU${i}: Option`,
      `FU${i}: Question Type`,
      `FU${i}: Required`,
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
    "Type: shortText, longText, multipleChoice, checkboxes, dropdown, yesNoNA",
    "TRUE/FALSE - is this question required?",
    "For multipleChoice/checkboxes/dropdown: option1,option2,option3 (comma-separated)",
    "For quiz: correct answer value",
    "For quiz: multiple correct answers separated by |",
  ];

  for (let i = 1; i <= 10; i++) {
    descriptions.push(
      `Follow-up #${i}: Which option triggers this follow-up (must match main options)`,
      `Follow-up #${i}: Question type`,
      `Follow-up #${i}: Required (TRUE/FALSE)`,
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
    },
    {
      "Section Weightage": "30",
      Question: "Do you have valid identification documents?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
    },
    {
      "Section Weightage": "30",
      Question: "Have you previously used our service before?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
    },
    {
      "Section Weightage": "30",
      Question: "Are you available for a follow-up appointment if needed?",
      "Question Type": "yesNoNA",
      Required: "FALSE",
      Options: "Yes,No,N/A",
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
    },
    {
      "Section Weightage": "40",
      Question: "Did you complete your desired goal with our help?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
    },
    {
      "Section Weightage": "40",
      Question: "Would you recommend us to others?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      "FU1: Option": "Yes",
      "FU1: Question Type": "shortText",
      "FU1: Required": "TRUE",
      "FU1: Question Text": "Which aspect of our service would you highlight?",
      "FU1: Options": "",
      "FU1: Correct Answer": "",
      "FU2: Option": "No",
      "FU2: Question Type": "longText",
      "FU2: Required": "TRUE",
      "FU2: Question Text": "What specific improvements would you suggest?",
      "FU2: Options": "",
      "FU2: Correct Answer": "",
      "FU3: Option": "N/A",
      "FU3: Question Type": "longText",
      "FU3: Required": "FALSE",
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
      "FU1: Option": "Yes",
      "FU1: Question Type": "yesNoNA",
      "FU1: Required": "TRUE",
      "FU1: Question Text": "How soon do you plan to use our service again?",
      "FU1: Options": "Yes,No,N/A",
      "FU1: Correct Answer": "",
      "FU2: Option": "No",
      "FU2: Question Type": "dropdown",
      "FU2: Required": "TRUE",
      "FU2: Question Text":
        "What would change your mind about using our service?",
      "FU2: Options":
        "Better pricing,Improved features,Different support,Other",
      "FU2: Correct Answer": "",
      "FU3: Option": "N/A",
      "FU3: Question Type": "longText",
      "FU3: Required": "FALSE",
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
      "FU1: Option": "Yes",
      "FU1: Question Type": "yesNoNA",
      "FU1: Required": "FALSE",
      "FU1: Question Text": "Are there any remaining concerns?",
      "FU1: Options": "Yes,No,N/A",
      "FU1: Correct Answer": "",
      "FU2: Option": "No",
      "FU2: Question Type": "longText",
      "FU2: Required": "TRUE",
      "FU2: Question Text": "What part of your issue remains unresolved?",
      "FU2: Options": "",
      "FU2: Correct Answer": "",
      "FU3: Option": "N/A",
      "FU3: Question Type": "shortText",
      "FU3: Required": "FALSE",
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
      "FU1: Option": "Yes",
      "FU1: Question Type": "dropdown",
      "FU1: Required": "TRUE",
      "FU1: Question Text": "What type of support do you need?",
      "FU1: Options": "Technical,Training,Consulting,Other",
      "FU1: Correct Answer": "",
      "FU2: Option": "No",
      "FU2: Question Type": "shortText",
      "FU2: Required": "FALSE",
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
      "FU1: Option": "Yes",
      "FU1: Question Type": "multipleChoice",
      "FU1: Required": "TRUE",
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
      "FU1: Option": "Yes",
      "FU1: Question Type": "longText",
      "FU1: Required": "TRUE",
      "FU1: Question Text": "Please share your detailed feedback:",
      "FU1: Options": "",
      "FU1: Correct Answer": "",
      "FU2: Option": "No",
      "FU2: Question Type": "shortText",
      "FU2: Required": "FALSE",
      "FU2: Question Text": "Would you share why?",
      "FU2: Options": "",
      "FU2: Correct Answer": "",
    },
    {
      Question: "Do you consent to data usage for service improvement?",
      "Question Type": "yesNoNA",
      Required: "TRUE",
      Options: "Yes,No,N/A",
      "FU1: Option": "Yes",
      "FU1: Question Type": "shortText",
      "FU1: Required": "FALSE",
      "FU1: Question Text": "What specific area should we improve?",
      "FU1: Options": "",
      "FU1: Correct Answer": "",
    },
    {
      Question: "Is there anything else you'd like to share?",
      "Question Type": "yesNoNA",
      Required: "FALSE",
      Options: "Yes,No,N/A",
      "FU1: Option": "Yes",
      "FU1: Question Type": "longText",
      "FU1: Required": "TRUE",
      "FU1: Question Text": "Please provide additional comments:",
      "FU1: Options": "",
      "FU1: Correct Answer": "",
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
      "Correct Answer": row["Correct Answer"] || "",
      "Correct Answers": row["Correct Answers"] || "",
    };

    for (let i = 1; i <= 10; i++) {
      fullRow[`FU${i}: Option`] = row[`FU${i}: Option`] || "";
      fullRow[`FU${i}: Question Type`] = row[`FU${i}: Question Type`] || "";
      fullRow[`FU${i}: Required`] = row[`FU${i}: Required`] || "";
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

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Form Template");
  writeFile(workbook, "form-import-template-nested-followups.xlsx");
}

export async function parseFormWorkbook(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "array" });

  const sheetNames = workbook.SheetNames;
  const firstSheet = workbook.Sheets[sheetNames[0]];

  if (!firstSheet) {
    throw new Error("Workbook must have at least one sheet");
  }

  const rawData = utils.sheet_to_json<Record<string, any>>(firstSheet, {
    defval: "",
  });

  if (rawData.length === 0) {
    throw new Error("Sheet is empty");
  }

  const dataRows = rawData.slice(3);

  if (dataRows.length === 0) {
    throw new Error(
      "No data rows found. Please add content starting from row 4 (after the example header and descriptions)."
    );
  }

  return parseNewTemplateFormat(dataRows);
}

function parseNewTemplateFormat(
  rows: Record<string, any>[]
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

    const questionId = generateId();
    const question: FollowUpQuestion = {
      id: questionId,
      text: questionText,
      type: questionType as FollowUpQuestion["type"],
      required: required,
      options: options || undefined,
      description: questionDesc || undefined,
      followUpQuestions: [],
      sectionId: section.id,
      correctAnswer: correctAnswer || undefined,
      correctAnswers: correctAnswers,
    };

    for (let fuIndex = 1; fuIndex <= 10; fuIndex++) {
      const fuOptionKey = `FU${fuIndex}: Option`;
      const fuTypeKey = `FU${fuIndex}: Question Type`;
      const fuRequiredKey = `FU${fuIndex}: Required`;
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
