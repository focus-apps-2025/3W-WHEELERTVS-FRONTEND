import * as XLSX from "xlsx";

interface SectionSummaryRow {
  id: string;
  title: string;
  weightage: number;
  yesPercent: number;
  yesWeighted: number;
  noPercent: number;
  noWeighted: number;
  naPercent: number;
  naWeighted: number;
}

interface FormSection {
  id: string;
  title: string;
  description?: string;
  questions?: Array<{
    id: string;
    text: string;
    type: string;
    followUpQuestions?: any[];
  }>;
}

interface FormData {
  _id: string;
  title: string;
  sections?: FormSection[];
  followUpQuestions?: any[];
}

interface ResponseData {
  _id: string;
  formTitle: string;
  createdAt: string;
  answers: Record<string, any>;
  yesNoScore?: {
    yes: number;
    total: number;
  };
}

const { utils, writeFile } = XLSX;

function formatPercentageValue(value: number): string {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

type FormQuestion = {
  id?: string;
  text?: string;
  type?: string;
  fileName?: string;
  name?: string;
  followUpQuestions?: any[];
};

type FormattedAnswer = {
  display: string;
  hyperlink?: string;
};

type HyperlinkEntry = {
  rowIndex: number;
  columnIndex: number;
  target: string;
  display: string;
};

function resolveFileLink(value: any, question?: FormQuestion): { link: string; label: string } | null {
  const labelCandidates = [
    typeof question?.fileName === "string" ? question.fileName : undefined,
    typeof question?.name === "string" ? question.name : undefined,
    typeof question?.text === "string" ? question.text : undefined,
    "View file",
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim().length));
  const fallbackLabel = labelCandidates[0] || "View file";

  const extract = (candidate: any): { link: string; label: string } | null => {
    if (!candidate) {
      return null;
    }
    if (typeof candidate === "string") {
      if (candidate.startsWith("data:") || candidate.startsWith("http")) {
        return { link: candidate, label: fallbackLabel };
      }
      return null;
    }
    if (typeof candidate === "object") {
      const dataValue =
        candidate.data ?? candidate.url ?? candidate.value ?? candidate.file ?? candidate.base64;
      const nameValue =
        candidate.fileName ?? candidate.filename ?? candidate.name ?? fallbackLabel;
      if (
        typeof dataValue === "string" &&
        (dataValue.startsWith("data:") || dataValue.startsWith("http"))
      ) {
        const label = typeof nameValue === "string" && nameValue.trim().length
          ? nameValue
          : fallbackLabel;
        return { link: dataValue, label };
      }
    }
    return null;
  };

  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = extract(item);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  return extract(value);
}

function formatAnswerForExport(value: any, question?: FormQuestion): FormattedAnswer {
  if (value === null || value === undefined) {
    return { display: "No response" };
  }

  const fileLink = resolveFileLink(value, question);
  if (fileLink) {
    return { display: fileLink.label, hyperlink: fileLink.link };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return { display: "No response" };
    }
    return { display: trimmed };
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return { display: String(value) };
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (item === null || item === undefined) {
          return "";
        }
        if (typeof item === "string") {
          return item;
        }
        if (typeof item === "number" || typeof item === "boolean") {
          return String(item);
        }
        if (typeof item === "object") {
          const nestedFile = resolveFileLink(item, question);
          if (nestedFile) {
            return nestedFile.link;
          }
          return JSON.stringify(item);
        }
        return "";
      })
      .map((text) => text.trim())
      .filter((text) => text.length);

    if (!parts.length) {
      return { display: "No response" };
    }

    return { display: parts.join(", ") };
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) {
      return { display: "No response" };
    }
    return { display: JSON.stringify(value) };
  }

  return { display: String(value) };
}

function buildResponsesSheetContent(
  response: ResponseData,
  form: FormData
): { data: any[][]; links: HyperlinkEntry[] } {
  const rows: any[][] = [];
  const links: HyperlinkEntry[] = [];

  const pushRow = (
    values: any[],
    hyperlink?: { columnIndex: number; target: string; display: string }
  ) => {
    rows.push(values);
    if (hyperlink) {
      links.push({
        rowIndex: rows.length - 1,
        columnIndex: hyperlink.columnIndex,
        target: hyperlink.target,
        display: hyperlink.display,
      });
    }
  };

  pushRow(["Section", "Question", "Answer"]);

  if (form.sections) {
    form.sections.forEach((section) => {
      const sectionTitle = section.title || "Untitled Section";
      const sectionDesc = section.description || "";

      pushRow([sectionTitle, "", ""]);

      if (sectionDesc) {
        pushRow([sectionDesc, "", ""]);
      }

      const questions = section.questions || [];
      questions.forEach((question, qIndex) => {
        const answer = response.answers[question.id];
        const questionLevel = `Q${qIndex + 1}`;
        const questionText = question.text || "Untitled Question";
        const formatted = formatAnswerForExport(answer, question);

        pushRow(
          [
            "",
            `${questionLevel}. ${questionText}`,
            formatted.display,
          ],
          formatted.hyperlink
            ? {
                columnIndex: 2,
                target: formatted.hyperlink,
                display: formatted.display,
              }
            : undefined
        );

        if (question.followUpQuestions && question.followUpQuestions.length > 0) {
          question.followUpQuestions.forEach((followUp: any, fIndex: number) => {
            const followAnswer = response.answers[followUp.id];
            const followUpText = followUp.text || "Untitled Follow-up";
            const formattedFollow = formatAnswerForExport(followAnswer, followUp);

            pushRow(
              [
                "",
                `  └─ Q${qIndex + 1}.${fIndex + 1}. ${followUpText}`,
                formattedFollow.display,
              ],
              formattedFollow.hyperlink
                ? {
                    columnIndex: 2,
                    target: formattedFollow.hyperlink,
                    display: formattedFollow.display,
                  }
                : undefined
            );
          });
        }
      });
    });
  }

  if (form.followUpQuestions?.length) {
    pushRow(["Form Follow-up Questions", "", ""]);
    form.followUpQuestions.forEach((followUp: any, index: number) => {
      const answer = response.answers[followUp.id];
      const followUpText = followUp.text || "Untitled Follow-up";
      const formatted = formatAnswerForExport(answer, followUp);

      pushRow(
        [
          "",
          `FQ${index + 1}. ${followUpText}`,
          formatted.display,
        ],
        formatted.hyperlink
          ? {
              columnIndex: 2,
              target: formatted.hyperlink,
              display: formatted.display,
            }
          : undefined
      );
    });
  }

  return { data: rows, links };
}

function applyHyperlinks(sheet: XLSX.WorkSheet, links: HyperlinkEntry[]): void {
  links.forEach(({ rowIndex, columnIndex, target, display }) => {
    const cellAddress = utils.encode_cell({ r: rowIndex, c: columnIndex });
    const existingCell = sheet[cellAddress] as XLSX.CellObject | undefined;
    const cellObject: XLSX.CellObject = existingCell ?? { t: "s", v: display };
    cellObject.v = display;
    cellObject.t = "s";
    cellObject.l = { Target: target, Tooltip: display };
    sheet[cellAddress] = cellObject;
  });
}

export function generateResponseExcelReport(
  response: ResponseData,
  form: FormData,
  sectionSummaryRows: SectionSummaryRow[]
): void {
  const workbook = utils.book_new();

  const dashboardData: any[] = [];
  dashboardData.push(["Dashboard Report"]);
  dashboardData.push([]);
  dashboardData.push(["Form", response.formTitle]);
  dashboardData.push(["Submitted", new Date(response.createdAt).toLocaleString()]);
  if (response.yesNoScore) {
    dashboardData.push([
      "Overall Score",
      `${response.yesNoScore.yes}/${response.yesNoScore.total}`,
    ]);
  }
  dashboardData.push([]);
  dashboardData.push([
    "Section",
    "Yes %",
    "No %",
    "N/A %",
    "Weightage",
    "Yes % × Weightage",
    "No % × Weightage",
    "N/A % × Weightage",
  ]);

  sectionSummaryRows.forEach((row) => {
    dashboardData.push([
      row.title,
      formatPercentageValue(row.yesPercent),
      formatPercentageValue(row.noPercent),
      formatPercentageValue(row.naPercent),
      formatPercentageValue(row.weightage),
      formatPercentageValue(row.yesWeighted),
      formatPercentageValue(row.noWeighted),
      formatPercentageValue(row.naWeighted),
    ]);
  });

  const dashboardSheet = utils.aoa_to_sheet(dashboardData);
  dashboardSheet["!cols"] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];

  utils.book_append_sheet(workbook, dashboardSheet, "Dashboard");

  const { data: responsesData, links: responsesLinks } = buildResponsesSheetContent(
    response,
    form
  );

  const responsesSheet = utils.aoa_to_sheet(responsesData);
  responsesSheet["!cols"] = [{ wch: 25 }, { wch: 45 }, { wch: 40 }];
  applyHyperlinks(responsesSheet, responsesLinks);

  utils.book_append_sheet(workbook, responsesSheet, "Responses");

  const fileName = `${response.formTitle.replace(/\s+/g, "_")}_${new Date()
    .toISOString()
    .split("T")[0]}.xlsx`;
  writeFile(workbook, fileName);
}

function createExcelWorkbook(
  response: ResponseData,
  form: FormData,
  sectionSummaryRows: SectionSummaryRow[]
): Blob {
  const workbook = XLSX.utils.book_new();

  const dashboardData: any[] = [];
  dashboardData.push(["Dashboard Report"]);
  dashboardData.push([]);
  dashboardData.push(["Form", response.formTitle]);
  dashboardData.push(["Submitted", new Date(response.createdAt).toLocaleString()]);
  if (response.yesNoScore) {
    dashboardData.push([
      "Overall Score",
      `${response.yesNoScore.yes}/${response.yesNoScore.total}`,
    ]);
  }
  dashboardData.push([]);
  dashboardData.push([
    "Section",
    "Yes %",
    "No %",
    "N/A %",
    "Weightage",
    "Yes % × Weightage",
    "No % × Weightage",
    "N/A % × Weightage",
  ]);

  sectionSummaryRows.forEach((row) => {
    dashboardData.push([
      row.title,
      formatPercentageValue(row.yesPercent),
      formatPercentageValue(row.noPercent),
      formatPercentageValue(row.naPercent),
      formatPercentageValue(row.weightage),
      formatPercentageValue(row.yesWeighted),
      formatPercentageValue(row.noWeighted),
      formatPercentageValue(row.naWeighted),
    ]);
  });

  const dashboardSheet = XLSX.utils.aoa_to_sheet(dashboardData);
  dashboardSheet["!cols"] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(workbook, dashboardSheet, "Dashboard");

  const { data: responsesData, links: responsesLinks } = buildResponsesSheetContent(
    response,
    form
  );

  const responsesSheet = XLSX.utils.aoa_to_sheet(responsesData);
  responsesSheet["!cols"] = [{ wch: 25 }, { wch: 45 }, { wch: 40 }];
  applyHyperlinks(responsesSheet, responsesLinks);

  XLSX.utils.book_append_sheet(workbook, responsesSheet, "Responses");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function sendResponseExcelViaEmail(
  response: ResponseData,
  form: FormData,
  sectionSummaryRows: SectionSummaryRow[],
  recipientEmail: string
): Promise<{ success: boolean; blob: Blob; fallback?: boolean }> {
  try {
    const blob = createExcelWorkbook(response, form, sectionSummaryRows);
    const fileName = `${response.formTitle.replace(/\s+/g, "_")}_Report.xlsx`;

    const formData = new FormData();
    formData.append("email", recipientEmail);
    formData.append("subject", `Response Report: ${response.formTitle}`);
    formData.append("file", blob, fileName);
    formData.append("responseId", response._id);

    const token = localStorage.getItem("auth_token");

    console.log("📨 Sending email report to:", recipientEmail);
    console.log("📄 File size:", blob.size, "bytes");
    
    const API_BASE_URL = "http://localhost:5000/api";
    const response_obj = await fetch(`${API_BASE_URL}/mail/send-response-report`, {
      method: "POST",
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    console.log("📤 Response status:", response_obj.status);

    if (!response_obj.ok) {
      const errorData = await response_obj.json().catch(() => ({}));
      console.error("❌ Server error response:", errorData);
      throw new Error(`Server error: ${response_obj.status} - ${errorData.message || 'Unknown error'}`);
    }

    const result = await response_obj.json();
    console.log("✅ Email sent successfully:", result);
    return { success: true, blob };
  } catch (error) {
    console.error("❌ Email send error:", error);
    return { success: false, blob: new Blob(), fallback: true };
  }
}
