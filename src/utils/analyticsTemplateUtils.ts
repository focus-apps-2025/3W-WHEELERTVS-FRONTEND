import type { Section, FollowUpQuestion } from "../components/analytics/FormAnalyticsDashboard";
import * as XLSX from "xlsx";

const { utils, writeFile, read } = XLSX;

export interface Form {
  title: string;
  sections: Section[];
}

export interface AnalyticsTemplateData {
  form: Form;
  questions: QuestionWithMetadata[];
}

export interface QuestionWithMetadata {
  id: string;
  text: string;
  type: string;
  section?: string;
  options?: string[];
  required?: boolean;
  followUpOf?: string;
}

export interface ImportedAnswerRow {
  rowIndex: number;
  questionId: string;
  questionText: string;
  questionType: string;
  answer: unknown;
  isValid: boolean;
  errors: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  rowsWithErrors: ImportedAnswerRow[];
  validRows: ImportedAnswerRow[];
}

function flattenQuestions(
  questions: FollowUpQuestion[],
  parentId?: string
): QuestionWithMetadata[] {
  const flattened: QuestionWithMetadata[] = [];

  questions.forEach((question) => {
    flattened.push({
      id: question.id,
      text: question.text,
      type: question.type,
      options: question.options,
      required: question.required,
      followUpOf: parentId,
    });

    if (question.followUpQuestions && question.followUpQuestions.length > 0) {
      flattened.push(
        ...flattenQuestions(question.followUpQuestions, question.id)
      );
    }
  });

  return flattened;
}

export function generateAnalyticsTemplate(form: Form): AnalyticsTemplateData {
  if (!form.sections || form.sections.length === 0) {
    throw new Error("Form has no sections");
  }

  const questions: QuestionWithMetadata[] = [];
  const data: Array<Record<string, string | number>> = [];

  form.sections.forEach((section: Section) => {
    section.questions.forEach((question: FollowUpQuestion) => {
      const flatQuestions = [
        {
          id: question.id,
          text: question.text,
          type: question.type,
          section: section.title,
          options: question.options,
          required: question.required,
        },
        ...flattenQuestions(question.followUpQuestions || [], question.id),
      ];

      flatQuestions.forEach((q) => {
        questions.push(q);
        const row: Record<string, string> = {
          "Question ID": q.id,
          Section: q.section || section.title,
          Question: q.text,
          "Question Type": q.type,
          Options: q.options?.join(" | ") || "",
          Required: q.required ? "Yes" : "No",
          "Follow-up Of": q.followUpOf || "",
          Answer: "",
        };
        data.push(row);
      });
    });
  });

  const headers = [
    "Question ID",
    "Section",
    "Question",
    "Question Type",
    "Options",
    "Required",
    "Follow-up Of",
    "Answer",
  ];

  const worksheet = utils.json_to_sheet(data, { header: headers });
  worksheet["!cols"] = [
    { wch: 20 },
    { wch: 20 },
    { wch: 40 },
    { wch: 15 },
    { wch: 30 },
    { wch: 10 },
    { wch: 15 },
    { wch: 30 },
  ];

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Answers");

  const fileName = `${(form.title || "form")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}-analytics-template.xlsx`;

  writeFile(workbook, fileName);

  return { form, questions };
}

export async function parseAnalyticsWorkbook(
  file: File,
  form: Form
): Promise<ImportedAnswerRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "array" });

  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) {
    throw new Error("Workbook has no sheets");
  }

  const rawData = utils.sheet_to_json<Record<string, string>>(worksheet, {
    defval: "",
  });

  if (rawData.length === 0) {
    throw new Error("No answer data found in the file");
  }

  const questions: QuestionWithMetadata[] = [];
  const questionMap = new Map<string, QuestionWithMetadata>();

  form.sections.forEach((section: Section) => {
    section.questions.forEach((question: FollowUpQuestion) => {
      const flatQuestions = [
        {
          id: question.id,
          text: question.text,
          type: question.type,
          section: section.title,
          options: question.options,
          required: question.required,
        },
        ...flattenQuestions(question.followUpQuestions || [], question.id),
      ];

      flatQuestions.forEach((q) => {
        questions.push(q);
        questionMap.set(q.id, q);
      });
    });
  });

  const rows: ImportedAnswerRow[] = [];

  rawData.forEach((row, index) => {
    const questionId = row["Question ID"]?.toString().trim();
    const answerValue = row["Answer"]?.toString().trim();
    const questionType = row["Question Type"]?.toString().trim();
    const questionText = row["Question"]?.toString().trim();

    if (!questionId || !answerValue) {
      return;
    }

    const question = questionMap.get(questionId);
    const errors: string[] = [];

    if (!question) {
      errors.push(`Question ID "${questionId}" not found in form`);
    }

    const importedRow: ImportedAnswerRow = {
      rowIndex: index + 2,
      questionId,
      questionText: questionText || "",
      questionType: questionType || "",
      answer: answerValue,
      isValid: errors.length === 0,
      errors,
    };

    rows.push(importedRow);
  });

  return rows;
}

export function validateImportedAnswers(
  rows: ImportedAnswerRow[],
  form: Form
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rowsWithErrors: ImportedAnswerRow[] = [];
  const validRows: ImportedAnswerRow[] = [];

  const questionMap = new Map<string, QuestionWithMetadata>();

  form.sections.forEach((section: Section) => {
    section.questions.forEach((question: FollowUpQuestion) => {
      const flatQuestions = [
        {
          id: question.id,
          text: question.text,
          type: question.type,
          options: question.options,
          required: question.required,
        },
        ...flattenQuestions(question.followUpQuestions || [], question.id),
      ];

      flatQuestions.forEach((q) => {
        questionMap.set(q.id, q);
      });
    });
  });

  rows.forEach((row) => {
    const question = questionMap.get(row.questionId);

    if (!question) {
      row.errors.push(`Question ID "${row.questionId}" not found`);
      row.isValid = false;
      rowsWithErrors.push(row);
      return;
    }

    const validationErrors = validateAnswer(row.answer, question);
    if (validationErrors.length > 0) {
      row.errors.push(...validationErrors);
      row.isValid = false;
      rowsWithErrors.push(row);
    } else {
      validRows.push(row);
    }
  });

  return {
    isValid: rowsWithErrors.length === 0,
    errors: errors,
    warnings: warnings,
    rowsWithErrors,
    validRows,
  };
}

function validateAnswer(answer: unknown, question: QuestionWithMetadata): string[] {
  const errors: string[] = [];
  const answerStr = String(answer).trim().toLowerCase();

  if (question.type === "yesNoNA") {
    const validOptions = ["yes", "no", "n/a", "na"];
    if (!validOptions.includes(answerStr)) {
      errors.push(
        `For yesNoNA question, answer must be one of: ${validOptions.join(", ")}`
      );
    }
  } else if (
    question.type === "multipleChoice" ||
    question.type === "dropdown"
  ) {
    if (question.options && question.options.length > 0) {
      const validOptions = question.options.map((opt) => opt.toLowerCase());
      if (!validOptions.includes(answerStr)) {
        errors.push(
          `Answer must be one of: ${question.options.join(", ")}`
        );
      }
    }
  } else if (question.type === "number" || question.type === "rating") {
    const num = Number(answer);
    if (isNaN(num)) {
      errors.push("Answer must be a number");
    }
  } else if (question.type === "email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(answer))) {
      errors.push("Answer must be a valid email address");
    }
  } else if (question.type === "url") {
    try {
      new URL(String(answer));
    } catch {
      errors.push("Answer must be a valid URL");
    }
  }

  return errors;
}

export function formatImportedAnswersForResponse(
  rows: ImportedAnswerRow[],
  form: Form
): Record<string, unknown> {
  const answers: Record<string, unknown> = {};

  const questionMap = new Map<string, QuestionWithMetadata>();

  form.sections.forEach((section: Section) => {
    section.questions.forEach((question: FollowUpQuestion) => {
      const flatQuestions = [
        {
          id: question.id,
          text: question.text,
          type: question.type,
          options: question.options,
        },
        ...flattenQuestions(question.followUpQuestions || [], question.id),
      ];

      flatQuestions.forEach((q) => {
        questionMap.set(q.id, q);
      });
    });
  });

  rows.forEach((row) => {
    const question = questionMap.get(row.questionId);
    if (!question) return;

    let formattedAnswer: unknown = row.answer;

    if (question.type === "number" || question.type === "rating") {
      formattedAnswer = Number(row.answer);
    } else if (question.type === "checkboxes") {
      formattedAnswer = String(row.answer)
        .split("|")
        .map((a) => a.trim())
        .filter(Boolean);
    } else if (
      question.type === "yesNoNA" ||
      question.type === "multipleChoice"
    ) {
      formattedAnswer = String(row.answer).toLowerCase();
    }

    answers[row.questionId] = formattedAnswer;
  });

  return answers;
}
