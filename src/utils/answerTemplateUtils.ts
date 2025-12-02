import type { Question, FollowUpQuestion, Section } from "../types";
import * as XLSX from "xlsx";

const { utils, writeFile, read } = XLSX;

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

export function generateAnswerTemplate(form: Question) {
  if (!form.sections || form.sections.length === 0) {
    throw new Error("Form has no sections");
  }

  const headers: string[] = [
    "Section",
    "Question Type",
    "Main/Follow-up",
    "Question",
    "Options",
    "Answer",
  ];
  const data: Record<string, any>[] = [];

  const isFollowUpQuestion = (question: FollowUpQuestion): boolean => {
    return !!(question.parentId || question.showWhen?.questionId);
  };

  const flattenQuestions = (questions: FollowUpQuestion[]): FollowUpQuestion[] => {
    const flattened: FollowUpQuestion[] = [];
    questions.forEach((q) => {
      flattened.push(q);
      if (q.followUpQuestions && q.followUpQuestions.length > 0) {
        flattened.push(...flattenQuestions(q.followUpQuestions));
      }
    });
    return flattened;
  };

  form.sections.forEach((section, sectionIdx) => {
    const allQuestions = flattenQuestions(section.questions);
    allQuestions.forEach((question) => {
      const row: Record<string, string | number | boolean> = {
        Section: section.title || `Section ${sectionIdx + 1}`,
        "Question Type": question.type,
        "Main/Follow-up": isFollowUpQuestion(question) ? "Follow-up" : "Main",
        Question: question.text,
        Options: question.options?.join("|") || "",
        Answer: "",
      };
      data.push(row);
    });
  });

  const worksheet = utils.json_to_sheet(data, { header: headers });
  worksheet["!cols"] = headers.map(() => ({ wch: 30 }));

  for (let i = 0; i <= data.length; i++) {
    const isHeader = i === 0;
    const rowNum = i + 1;

    for (let j = 0; j < headers.length; j++) {
      const cellRef = String.fromCharCode(65 + j) + rowNum;

      if (isHeader) {
        worksheet[cellRef].fill = { fgColor: { rgb: "4472C4" } };
        worksheet[cellRef].font = { bold: true, color: { rgb: "FFFFFF" } };
        worksheet[cellRef].alignment = {
          horizontal: "center",
          vertical: "center",
        };
      } else if (i > 0) {
        const isFollowUp =
          data[i - 1]["Main/Follow-up"] === "Follow-up";
        worksheet[cellRef].fill = {
          fgColor: { rgb: isFollowUp ? "FFF2CC" : "D9E8F5" },
        };
        worksheet[cellRef].alignment = { horizontal: "left", vertical: "top" };
      }
    }
  }

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Answers");
  writeFile(
    workbook,
    `${(form.title || "form")
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()}-answers.xlsx`
  );
}

export interface ParsedAnswers {
  [questionId: string]: any;
}

export async function parseAnswerWorkbook(
  file: File,
  form: Question
): Promise<ParsedAnswers> {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "array" });

  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) {
    throw new Error("Workbook has no sheets");
  }

  const rawData = utils.sheet_to_json<Record<string, any>>(worksheet, {
    defval: "",
  });

  if (rawData.length === 0) {
    throw new Error("No answer data found in the file");
  }

  const answers: ParsedAnswers = {};
  
  const flattenQuestions = (questions: FollowUpQuestion[]): FollowUpQuestion[] => {
    const flattened: FollowUpQuestion[] = [];
    questions.forEach((q) => {
      flattened.push(q);
      if (q.followUpQuestions && q.followUpQuestions.length > 0) {
        flattened.push(...flattenQuestions(q.followUpQuestions));
      }
    });
    return flattened;
  };

  const questionMap = new Map<string, string>();
  form.sections.forEach((section) => {
    const allQuestions = flattenQuestions(section.questions);
    allQuestions.forEach((question) => {
      questionMap.set(question.text.toLowerCase().trim(), question.id);
    });
  });

  rawData.forEach((row: Record<string, unknown>) => {
    const questionText = (row["Question"] as string | undefined)?.toString().trim().toLowerCase();
    const answerValue = (row["Answer"] as string | undefined)?.toString().trim();

    if (questionText && answerValue) {
      const questionId = questionMap.get(questionText);
      if (questionId) {
        answers[questionId] = answerValue;
      }
    }
  });

  return answers;
}

export function formatAnswersForSubmission(
  form: Question,
  parsedAnswers: ParsedAnswers
) {
  const answers: Record<string, any> = {};

  const flattenQuestions = (questions: FollowUpQuestion[]): FollowUpQuestion[] => {
    const flattened: FollowUpQuestion[] = [];
    questions.forEach((q) => {
      flattened.push(q);
      if (q.followUpQuestions && q.followUpQuestions.length > 0) {
        flattened.push(...flattenQuestions(q.followUpQuestions));
      }
    });
    return flattened;
  };

  form.sections.forEach((section) => {
    const allQuestions = flattenQuestions(section.questions);
    allQuestions.forEach((question) => {
      const answerValue = parsedAnswers[question.id];
      if (answerValue !== undefined) {
        if (question.type === "checkboxes" && typeof answerValue === "string") {
          answers[question.id] = answerValue
            .split("|")
            .map((a) => a.trim())
            .filter(Boolean);
        } else if (question.type === "multipleChoice") {
          answers[question.id] = answerValue;
        } else if (question.type === "number" || question.type === "rating") {
          answers[question.id] = parseNumber(answerValue) || answerValue;
        } else {
          answers[question.id] = answerValue;
        }
      }
    });
  });

  return { answers };
}
