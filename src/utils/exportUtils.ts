import { utils, writeFile, read } from "xlsx";
import type { Question, Response } from "../types";
import type { FollowUpQuestion, Section } from "../types/forms";

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

  // Parse linkedSection format like "2:Yes,3:No,4:Maybe Later"
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
  const headers = [
    "Form Title",
    "Form Description",
    "Section Number",
    "Section Title",
    "Section Description",
    "Question",
    "Question Description",
    "Question Type",
    "Required",
    "Options",
    "Option Notes",
    "Section Navigation",
    "Follow up Option",
    "Parent Question",
    "Follow Up Trigger",
    "Correct Answer",
    "Correct Answers",
  ];

  const descriptions = [
    "Name of the form",
    "Overview/purpose of the form",
    "Which section (1, 2, 3...)",
    "Title of the section",
    "Description of what this section covers",
    "The question text to ask",
    "Additional details about the question",
    "Type: shortText, longText, multipleChoice, checkboxes, dropdown, yesNoNA (or Yes / No / N/A)",
    "TRUE/FALSE - is this question required?",
    "For multipleChoice/checkboxes/dropdown: option1,option2,option3 (comma-separated)",
    "Notes about the options",
    "JUST NUMBERS! e.g., 2;3;4 (section numbers by semicolon). Position matches options.",
    "YES/NO - does this option trigger follow-up?",
    "Text of parent question if this is a follow-up question",
    "Which parent option triggers this follow-up? (must match exactly, case-sensitive)",
    "For quiz: correct answer value",
    "For quiz: multiple correct answers separated by |",
  ];

  // ROW 1: Headers
  const headerRow = headers.reduce((obj, header) => {
    obj[header] = header;
    return obj;
  }, {} as Record<string, string>);

  // ROW 2: Descriptions
  const descriptionRow = headers.reduce((obj, header, idx) => {
    obj[header] = descriptions[idx];
    return obj;
  }, {} as Record<string, string>);

  // ROW 3: Empty separator
  const separatorRow = headers.reduce((obj, header) => {
    obj[header] = "";
    return obj;
  }, {} as Record<string, string>);

  // ROW 4+: Example data
  const templateData: Record<string, any>[] = [
    headerRow,
    descriptionRow,
    separatorRow,
  ];

  const formTitle = "Comprehensive Assessment Form";
  const formDesc =
    "Complete form with 5 sections covering different question types";

  const sections = [
    {
      no: "1",
      title: "Section 1: Basic Information",
      desc: "Collect basic details and preferences",
      questions: [
        {
          q: "Do you have a valid ID?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: true,
          parent: "",
          trigger: "",
        },
        {
          q: "Have you used our service before?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: true,
          parent: "",
          trigger: "",
        },
        {
          q: "Are you a new customer?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: true,
          parent: "",
          trigger: "",
        },
        {
          q: "Do you have an account with us?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: false,
          parent: "",
          trigger: "",
        },
        {
          q: "Would you like to receive updates?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: false,
          parent: "",
          trigger: "",
        },
      ],
    },
    {
      no: "2",
      title: "Section 2: Product/Service Evaluation",
      desc: "Evaluate your satisfaction and experience",
      questions: [
        {
          q: "How satisfied are you with the product quality?",
          type: "dropdown",
          opts: "Very Satisfied,Satisfied,Neutral,Dissatisfied,Very Dissatisfied",
          required: true,
          parent: "",
          trigger: "",
        },
        {
          q: "Does the product meet your expectations?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: true,
          parent: "",
          trigger: "",
        },
        {
          q: "What specific improvements would you suggest?",
          type: "longText",
          opts: "",
          required: false,
          parent: "Does the product meet your expectations?",
          trigger: "No",
        },
        {
          q: "Select all features you find useful",
          type: "checkboxes",
          opts: "Easy to Use,Fast Performance,Good Design,Reliable,Cost Effective",
          required: false,
          parent: "",
          trigger: "",
        },
        {
          q: "Would you recommend this to others?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: true,
          parent: "",
          trigger: "",
        },
        {
          q: "Why would you recommend it?",
          type: "longText",
          opts: "",
          required: false,
          parent: "Would you recommend this to others?",
          trigger: "Yes",
        },
        {
          q: "Why not? What would convince you?",
          type: "longText",
          opts: "",
          required: false,
          parent: "Would you recommend this to others?",
          trigger: "No",
        },
        {
          q: "Which pricing tier interests you?",
          type: "multipleChoice",
          opts: "Basic,Standard,Premium,Enterprise",
          required: false,
          parent: "",
          trigger: "",
        },
        {
          q: "How many users will your organization have?",
          type: "dropdown",
          opts: "1-10,11-50,51-100,100+",
          required: false,
          parent: "Which pricing tier interests you?",
          trigger: "Enterprise",
        },
      ],
    },
    {
      no: "3",
      title: "Section 3: Customer Support Experience",
      desc: "Feedback on support services",
      questions: [
        {
          q: "Did you contact our support team?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: true,
          parent: "",
          trigger: "",
        },
        {
          q: "How would you rate their responsiveness?",
          type: "dropdown",
          opts: "Very Fast,Fast,Acceptable,Slow,Very Slow",
          required: false,
          parent: "Did you contact our support team?",
          trigger: "Yes",
        },
        {
          q: "Did they resolve your issue?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: false,
          parent: "Did you contact our support team?",
          trigger: "Yes",
        },
        {
          q: "How would you prefer to contact support?",
          type: "checkboxes",
          opts: "Phone,Email,Live Chat,Social Media,In-Person",
          required: true,
          parent: "",
          trigger: "",
        },
        {
          q: "What channel did you use?",
          type: "multipleChoice",
          opts: "Phone,Email,Live Chat,Social Media,In-Person",
          required: false,
          parent: "",
          trigger: "",
        },
        {
          q: "Was the support representative knowledgeable?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: false,
          parent: "",
          trigger: "",
        },
        {
          q: "Any suggestions for improving support?",
          type: "longText",
          opts: "",
          required: false,
          parent: "",
          trigger: "",
        },
      ],
    },
    {
      no: "4",
      title: "Section 4: Purchase & Billing",
      desc: "Questions about purchasing and billing experience",
      questions: [
        {
          q: "Have you made a purchase?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: true,
          parent: "",
          trigger: "",
        },
        {
          q: "How many times have you purchased?",
          type: "dropdown",
          opts: "1 time,2-3 times,4-5 times,6+ times",
          required: false,
          parent: "Have you made a purchase?",
          trigger: "Yes",
        },
        {
          q: "What prevented you from purchasing?",
          type: "longText",
          opts: "",
          required: false,
          parent: "Have you made a purchase?",
          trigger: "No",
        },
        {
          q: "Was the checkout process easy?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: false,
          parent: "",
          trigger: "",
        },
        {
          q: "Which payment methods do you prefer?",
          type: "checkboxes",
          opts: "Credit Card,Debit Card,PayPal,Bank Transfer,Digital Wallet",
          required: true,
          parent: "",
          trigger: "",
        },
        {
          q: "How did you hear about us?",
          type: "multipleChoice",
          opts: "Search Engine,Social Media,Friend/Family,Advertisement,Other",
          required: true,
          parent: "",
          trigger: "",
        },
        {
          q: "Please specify the source",
          type: "shortText",
          opts: "",
          required: false,
          parent: "How did you hear about us?",
          trigger: "Other",
        },
        {
          q: "Are you interested in our newsletter?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: false,
          parent: "",
          trigger: "",
        },
      ],
    },
    {
      no: "5",
      title: "Section 5: Overall Feedback & Future",
      desc: "Summary feedback and future engagement",
      questions: [
        {
          q: "Overall, how would you rate your experience?",
          type: "dropdown",
          opts: "Excellent,Very Good,Good,Fair,Poor",
          required: true,
          parent: "",
          trigger: "",
        },
        {
          q: "Would you use our service again?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: true,
          parent: "",
          trigger: "",
        },
        {
          q: "What would make you return?",
          type: "longText",
          opts: "",
          required: false,
          parent: "Would you use our service again?",
          trigger: "No",
        },
        {
          q: "Any additional feedback or suggestions?",
          type: "longText",
          opts: "",
          required: false,
          parent: "",
          trigger: "",
        },
        {
          q: "May we contact you for follow-up?",
          type: "yesNoNA",
          opts: "Yes,No,N/A",
          required: false,
          parent: "",
          trigger: "",
        },
      ],
    },
  ];

  sections.forEach((section) => {
    section.questions.forEach((q, idx) => {
      templateData.push({
        "Form Title": section === sections[0] && idx === 0 ? formTitle : "",
        "Form Description":
          section === sections[0] && idx === 0 ? formDesc : "",
        "Section Number": idx === 0 ? section.no : "",
        "Section Title": idx === 0 ? section.title : "",
        "Section Description": idx === 0 ? section.desc : "",
        Question: q.q,
        "Question Description": "",
        "Question Type": q.type,
        Required: q.required ? "TRUE" : "FALSE",
        Options: q.opts,
        "Option Notes": "",
        "Section Navigation": "",
        "Follow up Option": q.parent ? "Yes" : "No",
        "Parent Question": q.parent,
        "Follow Up Trigger": q.trigger,
        "Correct Answer": "",
        "Correct Answers": "",
      });
    });
  });

  const worksheet = utils.json_to_sheet(templateData, {
    header: headers,
  });

  // Set column widths for better readability
  worksheet["!cols"] = headers.map(() => ({ wch: 25 }));

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Form Template");
  writeFile(workbook, "form-import-template-5sections.xlsx");
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

  // Skip the first 3 rows (header, descriptions, separator)
  // Only process data starting from row 4
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
    const parentQuestionText = row["Parent Question"]?.toString().trim();

    if (!questionText) {
      return;
    }

    if (sectionNo) {
      currentSectionNo = sectionNo;
      if (!sectionsMap.has(sectionNo)) {
        sectionsMap.set(sectionNo, {
          id: generateId(),
          title: sectionTitle || `Section ${sectionNo}`,
          description: sectionDesc || "Section description",
          questions: [],
        });
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
    const optionsNotes = row["Option Notes"]?.toString().trim() || "";
    const linkedSection = row["Section Navigation"]?.toString().trim();
    const followUpOption = row["Follow up Option"]?.toString().trim() || "Yes";
    const triggerOption = row["Follow Up Trigger"]?.toString().trim();
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

    // Parse section branching for each option
    const branchingRules: Array<{
      optionLabel: string;
      targetSectionId: string;
    }> = [];

    if (options && options.length > 0) {
      options.forEach((option, index) => {
        const optionNumber = index + 1;
        const sectionColumn = `Option ${optionNumber} →`;
        const targetSection = row[sectionColumn]?.toString().trim();

        if (targetSection && targetSection !== "") {
          // Find the target section by title or number
          let targetSectionId = null;

          // First try to find by section number
          if (/^\d+$/.test(targetSection)) {
            const sectionNo = parseInt(targetSection);
            const targetSectionObj = Array.from(sectionsMap.values()).find(
              (s) =>
                s.title === `Section ${sectionNo}` ||
                s.title.includes(`Section ${sectionNo}`)
            );
            if (targetSectionObj) {
              targetSectionId = targetSectionObj.id;
            }
          }

          // If not found by number, try to find by title
          if (!targetSectionId) {
            const targetSectionObj = Array.from(sectionsMap.values()).find(
              (s) => s.title.toLowerCase() === targetSection.toLowerCase()
            );
            if (targetSectionObj) {
              targetSectionId = targetSectionObj.id;
            }
          }

          // If still not found, create a new section with the specified title
          if (!targetSectionId) {
            const newSectionId = generateId();
            sectionsMap.set(sectionsMap.size + 1, {
              id: newSectionId,
              title: targetSection,
              description: `Auto-created section for branching`,
              questions: [],
            });
            targetSectionId = newSectionId;
          }

          if (targetSectionId) {
            branchingRules.push({
              optionLabel: option,
              targetSectionId: targetSectionId,
            });
          }
        }
      });
    }

    const questionId = generateId();
    const question: FollowUpQuestion = {
      id: questionId,
      text: questionText,
      type: questionType as FollowUpQuestion["type"],
      required: required,
      options: options || undefined,
      description: questionDesc || optionsNotes || undefined,
      followUpQuestions: [],
      sectionId: section.id,
      branchingRules: branchingRules.length > 0 ? branchingRules : undefined,
      correctAnswer: correctAnswer || undefined,
      correctAnswers: correctAnswers,
    };

    // If this is a followup question
    if (parentQuestionText) {
      const parentQuestion = questionMap.get(parentQuestionText);
      if (parentQuestion && triggerOption) {
        question.showWhen = {
          questionId: parentQuestion.id,
          value: triggerOption,
        };
        parentQuestion.followUpQuestions.push(question);
      }
    } else {
      // Regular question
      section.questions.push(question);
      questionMap.set(questionText, question);
    }

    if (linkedSection) {
      const links = linkedSection.split(",").map((s) => s.trim());
      links.forEach((link) => {
        const [sectionNo, option] = link.split(":").map((s) => s.trim());
        sectionLinkMap.set(sectionNo, {
          questionId,
          option: option || followUpOption,
        });
      });
    }
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
