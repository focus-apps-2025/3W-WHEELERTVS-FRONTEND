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

  const responsesData: any[] = [];
  responsesData.push(["Section", "Question", "Answer"]);

  if (form.sections) {
    form.sections.forEach((section) => {
      const sectionTitle = section.title || "Untitled Section";
      const sectionDesc = section.description || "";

      responsesData.push([sectionTitle, "", ""]);
      
      if (sectionDesc) {
        responsesData.push([sectionDesc, "", ""]);
      }

      const questions = section.questions || [];
      questions.forEach((question, qIndex) => {
        const answer = response.answers[question.id];
        const questionLevel = `Q${qIndex + 1}`;
        const questionText = question.text || "Untitled Question";
        const answerText = answer ? String(answer) : "No response";

        responsesData.push([
          "",
          `${questionLevel}. ${questionText}`,
          answerText
        ]);

        if (question.followUpQuestions && question.followUpQuestions.length > 0) {
          question.followUpQuestions.forEach((followUp: any, fIndex: number) => {
            const followAnswer = response.answers[followUp.id];
            const followUpText = followUp.text || "Untitled Follow-up";
            const followUpLevel = `Q${qIndex + 1}.${fIndex + 1}`;
            const followUpAnswer = followAnswer ? String(followAnswer) : "No response";
            
            responsesData.push([
              "",
              `  └─ Q${qIndex + 1}.${fIndex + 1}. ${followUpText}`,
              followUpAnswer
            ]);
          });
        }
      });
    });
  }

  if (form.followUpQuestions?.length) {
    responsesData.push(["Form Follow-up Questions", "", ""]);
    form.followUpQuestions.forEach((followUp: any, index: number) => {
      const answer = response.answers[followUp.id];
      const followUpText = followUp.text || "Untitled Follow-up";
      const answerText = answer ? String(answer) : "No response";
      
      responsesData.push([
        "",
        `FQ${index + 1}. ${followUpText}`,
        answerText
      ]);
    });
  }

  const responsesSheet = utils.aoa_to_sheet(responsesData);
  responsesSheet["!cols"] = [{ wch: 25 }, { wch: 45 }, { wch: 40 }];

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

  const responsesData: any[] = [];
  responsesData.push(["Section", "Question", "Answer"]);

  if (form.sections) {
    form.sections.forEach((section) => {
      const sectionTitle = section.title || "Untitled Section";
      const sectionDesc = section.description || "";

      responsesData.push([sectionTitle, "", ""]);
      
      if (sectionDesc) {
        responsesData.push([sectionDesc, "", ""]);
      }

      const questions = section.questions || [];
      questions.forEach((question, qIndex) => {
        const answer = response.answers[question.id];
        const questionLevel = `Q${qIndex + 1}`;
        const questionText = question.text || "Untitled Question";
        const answerText = answer ? String(answer) : "No response";

        responsesData.push([
          "",
          `${questionLevel}. ${questionText}`,
          answerText
        ]);

        if (question.followUpQuestions && question.followUpQuestions.length > 0) {
          question.followUpQuestions.forEach((followUp: any, fIndex: number) => {
            const followAnswer = response.answers[followUp.id];
            const followUpText = followUp.text || "Untitled Follow-up";
            const followUpAnswer = followAnswer ? String(followAnswer) : "No response";
            
            responsesData.push([
              "",
              `  └─ Q${qIndex + 1}.${fIndex + 1}. ${followUpText}`,
              followUpAnswer
            ]);
          });
        }
      });
    });
  }

  if (form.followUpQuestions?.length) {
    responsesData.push(["Form Follow-up Questions", "", ""]);
    form.followUpQuestions.forEach((followUp: any, index: number) => {
      const answer = response.answers[followUp.id];
      const followUpText = followUp.text || "Untitled Follow-up";
      const answerText = answer ? String(answer) : "No response";
      
      responsesData.push([
        "",
        `FQ${index + 1}. ${followUpText}`,
        answerText
      ]);
    });
  }

  const responsesSheet = XLSX.utils.aoa_to_sheet(responsesData);
  responsesSheet["!cols"] = [{ wch: 25 }, { wch: 45 }, { wch: 40 }];

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
