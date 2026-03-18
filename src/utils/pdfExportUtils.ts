import html2pdf from "html2pdf.js";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { apiClient } from "../api/client";
import { formatTimestamp } from "./dateUtils";

interface PDFOptions {
  filename: string;
  formTitle: string;
  submittedDate: string;
  sectionStats: Array<{
    id: string;
    title: string;
    yes: number;
    no: number;
    na: number;
    correct: number;
    wrong: number;
    total: number;
    weightage: number;
  }>;
  sectionSummaryRows?: Array<{
    id: string;
    title: string;
    total: number;
    yes: number;
    no: number;
    na: number;
    correct: number;
    wrong: number;
    weightage: number;
    yesPercent: number;
    yesWeighted: number;
    noPercent: number;
    noWeighted: number;
    naPercent: number;
    naWeighted: number;
    correctPercent: number;
    wrongPercent: number;
    hasYesNo?: boolean;
    hasQuiz?: boolean;
  }>;
  sectionQuestionStats?: Record<string, Array<any>>;
  sectionMainParameters?: Record<string, Array<any>>;
  availableSections?: Array<any>;
  form?: any;
  response?: any;
  chartElementIds?: string[];
  type?:
    | "no-only"
    | "yes-only"
    | "both"
    | "na-only"
    | "section"
    | "default"
    | "responses-view"
    | undefined; // Add this new parameter
}

function extractYesNoValues(value: any): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized ? [normalized] : [];
  }
  if (typeof value === "boolean") {
    return [value ? "yes" : "no"];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractYesNoValues(item));
  }
  if (typeof value === "object") {
    return Object.values(value).flatMap((item) => extractYesNoValues(item));
  }
  return [];
}

const isImageUrl = (urlString: string): boolean => {
  if (!urlString || typeof urlString !== "string") return false;
  const url = urlString.toLowerCase().trim();
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".svg",
  ];
  return (
    imageExtensions.some((ext) => url.endsWith(ext)) ||
    url.includes("focus_forms/response_images/") ||
    url.includes("cloudinary.com") ||
    url.includes("googleusercontent.com") ||
    url.includes("blob:") ||
    url.startsWith("data:image/")
  );
};

const renderAnswerHTML = (value: any, color: string = "#1f2937"): string => {
  if (value === null || value === undefined || value === "") {
    return '<span style="color: #9ca3af; font-style: italic;">No response</span>';
  }

  const renderSingleValue = (val: any): string => {
    const strVal = String(val).trim();
    if (isImageUrl(strVal)) {
      return `
        <div style="margin: 5px 0;">
          <img src="${strVal}" 
               style="width: 100px; height: 100px; object-fit: cover; border: 1px solid #e2e8f0; border-radius: 4px;" 
               onerror="this.onerror=null; this.src='https://via.placeholder.com/100?text=Image+Error';">
        </div>`;
    }
    return `<span style="color: ${color}; font-weight: 600;">${strVal}</span>`;
  };

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '<span style="color: #9ca3af; font-style: italic;">No response</span>';
    }
    return `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
        ${value.map((v) => renderSingleValue(v)).join("")}
      </div>`;
  }

  if (typeof value === "object") {
    if (!Object.keys(value).length) {
      return '<span style="color: #9ca3af; font-style: italic;">No response</span>';
    }
    // Check if it's an image object (some structures might have {url: "..."})
    const potentialUrl = value.url || value.imageUrl || value.image;
    if (potentialUrl && isImageUrl(String(potentialUrl))) {
      return renderSingleValue(potentialUrl);
    }
    return `<pre style="font-size: 10px; white-space: pre-wrap; color: #4b5563; margin: 0; text-align: left;">${JSON.stringify(
      value,
      null,
      2,
    )}</pre>`;
  }

  return renderSingleValue(value);
};

function getSectionYesNoStats(form: any, answers: Record<string, any>): any[] {
  if (!form || !form.sections) return [];

  return form.sections
    .map((section: any) => {
      const counts = {
        yes: 0,
        no: 0,
        na: 0,
        total: 0,
        correct: 0,
        wrong: 0,
        answeredCount: 0,
      };
      const weightage = Number(section.weightage) || 0;

      const processQuestion = (question: any) => {
        if (!question || !question.id) return;

        const supportedTypes = [
          "yesNoNA",
          "radio",
          "checkbox",
          "search-select",
          "radio-image",
          "rating",
          "scale",
        ];
        if (!supportedTypes.includes(question.type)) {
          question.followUpQuestions?.forEach(processQuestion);
          return;
        }

        const isCompliance = question.type === "yesNoNA";
        const isAccuracy = !isCompliance;

        const rawValue = answers?.[question.id];
        const normalizedValues = extractYesNoValues(rawValue);
        const hasValue =
          rawValue !== null &&
          rawValue !== undefined &&
          rawValue !== "" &&
          (!Array.isArray(rawValue) || rawValue.length > 0) &&
          (typeof rawValue !== "object" || Object.keys(rawValue).length > 0);

        counts.total += 1;

        if (!hasValue) {
          if (question.required) {
            counts.answeredCount += 1;
            if (isCompliance) {
              counts.no += 1;
            } else {
              counts.wrong += 1;
            }
          }
        } else {
          counts.answeredCount += 1;
          if (isAccuracy) {
            let isCorrect = false;
            const isArray = Array.isArray(rawValue);
            const strValue = isArray
              ? rawValue.join(", ")
              : String(rawValue || "");
            const normalized = strValue.trim().toLowerCase();

            if (question.correctAnswers && question.correctAnswers.length > 0) {
              if (isArray) {
                isCorrect =
                  rawValue.length === question.correctAnswers.length &&
                  rawValue.every((a: any) =>
                    question.correctAnswers!.some(
                      (ca: any) =>
                        String(ca).toLowerCase() === String(a).toLowerCase(),
                    ),
                  );
              } else {
                isCorrect = question.correctAnswers.some(
                  (ca: any) => String(ca).toLowerCase() === normalized,
                );
              }
            } else if (question.correctAnswer) {
              isCorrect =
                String(question.correctAnswer).toLowerCase() === normalized;
            } else {
              // Fallback for accuracy questions without explicit correct answers:
              // If it has a value and it's not "N/A", it's considered "Correct" (Answered)
              const isNA = normalizedValues.some((v) =>
                ["n/a", "na", "not applicable"].includes(v),
              );
              isCorrect = !isNA;
            }

            if (isCorrect) {
              counts.correct += 1;
            } else {
              counts.wrong += 1;
            }
          } else if (isCompliance) {
            const options = question.options || [];
            if (options.length >= 3) {
              const yesOption = String(options[0]).toLowerCase().trim();
              const noOption = String(options[1]).toLowerCase().trim();
              const naOption = String(options[2]).toLowerCase().trim();

              if (normalizedValues.includes(yesOption)) {
                counts.yes += 1;
              } else if (normalizedValues.includes(noOption)) {
                counts.no += 1;
              } else if (normalizedValues.includes(naOption)) {
                counts.na += 1;
              } else {
                counts.yes += 1;
              }
            } else {
              // Fallback to recognized values
              if (normalizedValues.includes("yes")) {
                counts.yes += 1;
              } else if (normalizedValues.includes("no")) {
                counts.no += 1;
              } else if (
                normalizedValues.includes("n/a") ||
                normalizedValues.includes("na") ||
                normalizedValues.includes("not applicable")
              ) {
                counts.na += 1;
              } else {
                counts.yes += 1;
              }
            }
          }
        }

        question.followUpQuestions?.forEach(processQuestion);
      };

      section.questions?.forEach(processQuestion);

      if (!counts.answeredCount && !weightage) {
        return null;
      }

      return {
        id: section.id,
        title: section.title || section.name,
        ...counts,
        weightage,
      };
    })
    .filter((s) => s !== null);
}

function getSectionYesNoQuestionStats(
  section: any,
  answers: Record<string, any>,
): any[] {
  const questionStats: any[] = [];

  const processQuestion = (question: any) => {
    if (!question || !question.id) return;

    const supportedTypes = [
      "yesNoNA",
      "radio",
      "checkbox",
      "search-select",
      "radio-image",
      "rating",
      "scale",
    ];
    if (supportedTypes.includes(question.type)) {
      const rawValue = answers?.[question.id];
      const normalizedValues = extractYesNoValues(rawValue);
      const counts = { yes: 0, no: 0, na: 0, total: 1, correct: 0, wrong: 0 };
      const isCompliance = question.type === "yesNoNA";
      const isAccuracy = !isCompliance;

      const hasValue =
        rawValue !== null &&
        rawValue !== undefined &&
        rawValue !== "" &&
        (!Array.isArray(rawValue) || rawValue.length > 0) &&
        (typeof rawValue !== "object" || Object.keys(rawValue).length > 0);

      if (!hasValue) {
        if (question.required) {
          if (isCompliance) {
            counts.no = 1;
          } else {
            counts.wrong = 1;
          }
        } else {
          // Optional unanswered questions are skipped
          return;
        }
      } else if (isAccuracy) {
        let isCorrect = false;
        const isArray = Array.isArray(rawValue);
        const strValue = isArray ? rawValue.join(", ") : String(rawValue || "");
        const normalized = strValue.trim().toLowerCase();

        if (question.correctAnswers && question.correctAnswers.length > 0) {
          if (isArray) {
            isCorrect =
              rawValue.length === question.correctAnswers.length &&
              rawValue.every((a: any) =>
                question.correctAnswers!.some(
                  (ca: any) =>
                    String(ca).toLowerCase() === String(a).toLowerCase(),
                ),
              );
          } else {
            isCorrect = question.correctAnswers.some(
              (ca: any) => String(ca).toLowerCase() === normalized,
            );
          }
        } else if (question.correctAnswer) {
          isCorrect =
            String(question.correctAnswer).toLowerCase() === normalized;
        } else {
          // Fallback for accuracy questions without explicit correct answers:
          // If it has a value and it's not "N/A", it's considered "Correct" (Answered)
          const isNA = normalizedValues.some((v) =>
            ["n/a", "na", "not applicable"].includes(v),
          );
          isCorrect = !isNA;
        }

        if (isCorrect) {
          counts.correct = 1;
        } else {
          counts.wrong = 1;
        }
      } else if (isCompliance) {
        const options = question.options || [];
        if (options.length >= 3) {
          const yesOption = String(options[0]).toLowerCase().trim();
          const noOption = String(options[1]).toLowerCase().trim();
          const naOption = String(options[2]).toLowerCase().trim();

          if (normalizedValues.includes(yesOption)) {
            counts.yes = 1;
          } else if (normalizedValues.includes(noOption)) {
            counts.no = 1;
          } else if (normalizedValues.includes(naOption)) {
            counts.na = 1;
          } else {
            counts.yes = 1;
          }
        } else {
          if (normalizedValues.includes("yes")) {
            counts.yes = 1;
          } else if (normalizedValues.includes("no")) {
            counts.no = 1;
          } else if (
            normalizedValues.includes("n/a") ||
            normalizedValues.includes("na") ||
            normalizedValues.includes("not applicable")
          ) {
            counts.na = 1;
          } else {
            counts.yes = 1;
          }
        }
      }

      questionStats.push({
        id: question.id,
        title: question.text || question.title || question.label,
        subParam1: question.subParam1,
        hasYesNo: isCompliance,
        isQuiz: isAccuracy,
        ...counts,
      });
    }

    question.followUpQuestions?.forEach(processQuestion);
  };

  section.questions?.forEach(processQuestion);
  return questionStats;
}

export async function exportResponseToPDF(
  response: any,
  form: any,
): Promise<void> {
  if (!response || !form) return;

  const sectionStats = getSectionYesNoStats(form, response.answers || {});
  const questionStats: Record<string, any[]> = {};

  form.sections?.forEach((section: any) => {
    questionStats[section.id] = getSectionYesNoQuestionStats(
      section,
      response.answers || {},
    );
  });

  const filename = `${form.title || "Form"}_Response_${formatTimestamp(
    response.createdAt,
    "file",
  )}.pdf`;

  const options: PDFOptions = {
    filename,
    formTitle: form.title || "Form Response",
    submittedDate: formatTimestamp(response.createdAt),
    sectionStats,
    sectionQuestionStats: questionStats,
    form,
    response,
    availableSections: form.sections || [],
  };

  return generateAndDownloadPDF(options);
}

export async function exportAllResponsesToPDF(
  responses: any[],
  form: any,
): Promise<void> {
  if (!responses || !responses.length || !form) return;

  for (const response of responses) {
    await exportResponseToPDF(response, form);
  }
}

export async function exportResponseToPDFBlob(
  response: any,
  form: any,
  onProgress?: ProgressCallback,
): Promise<{ blob: Blob; filename: string }> {
  try {
    if (!response || !form) throw new Error("Missing response or form");

    const sectionStats = getSectionYesNoStats(form, response.answers || {});
    const questionStats: Record<string, any[]> = {};

    form.sections?.forEach((section: any) => {
      questionStats[section.id] = getSectionYesNoQuestionStats(
        section,
        response.answers || {},
      );
    });

    const filename = `${form.title || "Form"}_Response_${formatTimestamp(
      response.createdAt,
      "file",
    )}.pdf`;

    const options: PDFOptions = {
      filename,
      formTitle: form.title || "Form Response",
      submittedDate: formatTimestamp(response.createdAt),
      sectionStats,
      sectionQuestionStats: questionStats,
      form,
      response,
      availableSections: form.sections || [],
    };

    console.log(`🚀 Starting PDF generation for ${filename}`);
    const blob = await generatePDFOnServer(options, "default", onProgress);
    console.log(`✅ PDF generation complete for ${filename}`);
    return { blob, filename };
  } catch (error) {
    console.error("❌ Error in exportResponseToPDFBlob:", error);
    throw error;
  }
}

export async function exportAllResponsesToZip(
  responses: any[],
  form: any,
  onProgress?: (progress: {
    current: number;
    total: number;
    message: string;
  }) => void,
  checkCancelled?: () => boolean,
): Promise<void> {
  if (!responses || !responses.length || !form) return;

  const zip = new JSZip();
  const total = responses.length;
  let totalProcessedInZip = 0;

  for (let i = 0; i < responses.length; i++) {
    if (checkCancelled && checkCancelled()) {
      console.log("ZIP generation cancelled by user");
      return;
    }
    const response = responses[i];
    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        message: `Generating PDF ${i + 1} of ${total}...`,
      });
    }

    try {
      const { blob, filename } = await exportResponseToPDFBlob(response, form);
      // Ensure unique filename in zip
      let finalFilename = filename;
      let counter = 1;
      while (zip.file(finalFilename)) {
        finalFilename = filename.replace(".pdf", `_${counter}.pdf`);
        counter++;
      }
      zip.file(finalFilename, blob);
      totalProcessedInZip++;

      // Small delay between generations to avoid overwhelming the server
      if (i < responses.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error(
        `Failed to generate PDF for response ${response.id}:`,
        error,
      );
    }
  }

  if (totalProcessedInZip === 0) {
    throw new Error("No responses were processed successfully.");
  }

  if (onProgress) {
    onProgress({
      current: total,
      total,
      message: "Creating ZIP file...",
    });
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${form.title || "Responses"}_Bulk_Download.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatQuestionNumberForDisplay(qNumber: string): string {
  if (!qNumber) return qNumber;

  // Handle formats:
  // "Q3.4" → "S3.Q4"
  // "Q3.4.1" → "S3.Q4.1"
  // "S3.Q4" (already correct) → keep as is

  if (qNumber.startsWith("S")) {
    return qNumber; // Already in correct format
  }

  if (qNumber.startsWith("Q")) {
    // Remove the leading Q
    const rest = qNumber.substring(1);
    // Find the first dot
    const firstDotIndex = rest.indexOf(".");
    if (firstDotIndex > 0) {
      const sectionNum = rest.substring(0, firstDotIndex);
      const questionPart = rest.substring(firstDotIndex + 1);
      return `S${sectionNum}.Q${questionPart}`;
    }
  }

  return qNumber; // Return as is if pattern doesn't match
}
// New function for combined response analysis (shows same question multiple times if has multiple responses)
function generateCombinedResponseAnalysis(
  form: any,
  response: any,
  availableSections: any[],
): string {
  console.log("🔍 Starting COMBINED Response Analysis generation...");

  if (!form || !response || !response.answers) {
    console.log("❌ No form, response, or answers available");
    return "";
  }

  // Build nested structure from flat data
  const nestedForm = buildNestedFormForAnalysis(availableSections);
  const sectionsToUse = nestedForm.sections || [];

  console.log("✅ Built nested form structure");
  console.log(`📊 Sections: ${sectionsToUse.length}`);

  // Collect ALL responses (YES, NO, NA) - a question can appear multiple times
  const allResponses: Array<{
    sectionId: string;
    sectionTitle: string;
    questionId: string;
    questionNumber: string;
    questionText: string;
    response: "YES" | "NO" | "NA";
    followUpQuestions: Array<{
      id: string;
      text: string;
      answer: any;
      number: string;
    }>;
    suggestion: string;
    recommendation?: string;
  }> = [];

  // Recursive function to process questions
  const processQuestion = (
    question: any,
    section: any,
    depth: number = 0,
    sectionIndex: number,
    questionIndex: number,
    followUpPath: number[] = [],
  ) => {
    const answer = response.answers?.[question.id];
    const questionNumber = getQuestionNumber(
      question,
      sectionIndex,
      questionIndex,
      followUpPath,
    );

    // Check for ALL response types for this question
    if (depth === 0) {
      // Check for YES response
      if (isYesResponse(answer)) {
        console.log(
          `\n✅ Found YES response for ${questionNumber}: "${question.text}"`,
        );
        addResponseToCollection(
          question,
          section,
          sectionIndex,
          questionIndex,
          followUpPath,
          "YES",
          answer,
        );
      }

      // Check for NO response
      if (isNoResponse(answer)) {
        console.log(
          `\n✅ Found NO response for ${questionNumber}: "${question.text}"`,
        );
        addResponseToCollection(
          question,
          section,
          sectionIndex,
          questionIndex,
          followUpPath,
          "NO",
          answer,
        );
      }

      // Check for NA response
      if (isNAResponse(answer)) {
        console.log(
          `\n✅ Found NA response for ${questionNumber}: "${question.text}"`,
        );
        addResponseToCollection(
          question,
          section,
          sectionIndex,
          questionIndex,
          followUpPath,
          "NA",
          answer,
        );
      }
    }

    if (question.followUpQuestions && question.followUpQuestions.length > 0) {
      question.followUpQuestions.forEach((fq: any, fqIndex: number) => {
        const newFollowUpPath = [...followUpPath, fqIndex + 1];
        processQuestion(
          fq,
          section,
          depth + 1,
          sectionIndex,
          questionIndex,
          newFollowUpPath,
        );
      });
    }
  };

  // Helper function to add a response to the collection
  const addResponseToCollection = (
    question: any,
    section: any,
    sectionIndex: number,
    questionIndex: number,
    followUpPath: number[],
    responseType: "YES" | "NO" | "NA",
    answer: any,
  ) => {
    const questionNumber = getQuestionNumber(
      question,
      sectionIndex,
      questionIndex,
      followUpPath,
    );

    const followUps: Array<{
      id: string;
      text: string;
      answer: any;
      number: string;
    }> = [];

    const collectFollowUps = (
      questions: any[],
      currentDepth: number,
      parentPath: number[],
    ) => {
      questions.forEach((fq, fqIndex) => {
        const followUpAnswer = response.answers?.[fq.id];
        const fuPath = [...parentPath, fqIndex + 1];
        const followUpNumber = `${questionNumber}.${fqIndex + 1}`;

        const isRealAnswer = checkIfRealAnswer(followUpAnswer, fq.text);

        if (isRealAnswer) {
          console.log(`       ✅ Adding to followUps (has real answer)`);
          followUps.push({
            id: fq.id,
            text: fq.text,
            answer: followUpAnswer,
            number: followUpNumber,
          });
        } else {
          console.log(`       ❌ Skipping follow-up (not a real answer)`);
        }

        if (fq.followUpQuestions && fq.followUpQuestions.length > 0) {
          collectFollowUps(fq.followUpQuestions, currentDepth + 1, fuPath);
        }
      });
    };

    if (question.followUpQuestions && question.followUpQuestions.length > 0) {
      console.log(
        `   📞 Starting to collect follow-ups for: "${question.text}"`,
      );
      collectFollowUps(question.followUpQuestions, 1, []);
    } else {
      console.log(`   ⓘ No follow-up questions found for: "${question.text}"`);
    }

    const suggestion =
      question.suggestion ||
      question.recommendation ||
      question.actionItem ||
      question.correctiveAction ||
      question.guidance ||
      question.notes ||
      question.instruction ||
      "";

    allResponses.push({
      sectionId: section.id,
      sectionTitle: section.title || section.name || "Unknown Section",
      questionId: question.id,
      questionNumber: questionNumber,
      questionText: question.text,
      response: responseType,
      followUpQuestions: followUps,
      suggestion: suggestion,
      recommendation: question.recommendation || question.actionItem,
    });

    console.log(
      `   ✅ Added ${responseType} response with ${followUps.length} follow-up answer(s)`,
    );
  };

  // Process all sections and questions
  console.log(`\n🔍 Processing nested sections for ALL responses...`);
  sectionsToUse.forEach((section, sectionIndex) => {
    console.log(`\n📁 Processing section: "${section.title}"`);
    if (section.questions && section.questions.length > 0) {
      console.log(`   Questions: ${section.questions.length}`);
      section.questions.forEach((question: any, questionIndex: number) => {
        console.log(
          `   Q${sectionIndex + 1}.${
            questionIndex + 1
          }: "${question.text.substring(0, 50)}..."`,
        );
        processQuestion(question, section, 0, sectionIndex, questionIndex, []);
      });
    }
  });

  console.log(`\n📊 Found ${allResponses.length} total responses`);

  if (allResponses.length === 0) {
    return "";
  }

  // Group responses by section
  const responsesBySection = allResponses.reduce(
    (groups: Record<string, any[]>, response) => {
      if (!groups[response.sectionTitle]) {
        groups[response.sectionTitle] = [];
      }
      groups[response.sectionTitle].push(response);
      return groups;
    },
    {},
  );

  // Generate HTML
  let html = "";

  Object.entries(responsesBySection).forEach(
    ([sectionTitle, responses], sectionIndex) => {
      responses.forEach((response, responseIndex) => {
        const responseFollowUps = response.followUpQuestions || [];
        const hasSuggestion =
          response.suggestion && response.suggestion.trim() !== "";

        // Set color based on response type
        let responseColor = "";
        switch (response.response) {
          case "NO":
            responseColor = "red";
            break;
          case "YES":
            responseColor = "black";
            break;
          case "NA":
            responseColor = "#f59e0b";
            break;
        }

        // Use the existing HTML template but remove the ${responseType.toUpperCase()} from the comment
        html += `
<!-- Separate Table for EACH Question -->
<table style="width: 100%; border-collapse: collapse; border: 1px solid #666; margin: -5 0 20px 0; page-break-after: always;">
  
  <!-- SECTION HEADER -->
  <tr style="background: #ffffffff;">
    <td colspan="3" style="border: 1px solid #666; padding: 10px; font-size: 14px; font-weight: 800; color: #1e3a8a;">
        ${sectionTitle} - ${formatQuestionNumberForDisplay(
          response.questionNumber,
        )}
    </td>
  </tr>
  
  <!-- TABLE HEADERS -->
  <tr style="background:#1e3a8a;">
    <td style="border: 1px solid #666; padding: 8px; font-weight: 700; font-size: 11px; width: 15%;background:#1e3a8a; color:#ffffffff">
      Question No
    </td>
    <td style="border: 1px solid #666; padding: 8px; font-weight: 700; font-size: 11px; width: 75%;background:#1e3a8a;color:#ffffffff">
      Question
    </td>
    <td style="border: 1px solid #666; padding: 8px; text-align: center; font-weight: 700; font-size: 11px; width: 10%;background:#1e3a8a;color:#ffffffff">
      Response
    </td>
  </tr>
  
  <!-- MAIN QUESTION ROW -->
  <tr style="background: #ffffff;">
    <td style="border: 1px solid #666; padding: 8px; vertical-align: top; font-size: 10px; font-weight: 600; color: #374151;page-break-inside: avoid;">
      ${formatQuestionNumberForDisplay(response.questionNumber)}
    </td>
    <td style="border: 1px solid #666; padding: 8px; vertical-align: top; font-size: 10px; color: #4b5563; line-height: 1.6;page-break-inside: avoid;">
      ${response.questionText}
    </td>
    <td style="border: 1px solid #666; padding: 8px; vertical-align: middle; text-align: center; font-size: 11px; font-weight: 600; color: ${responseColor};page-break-inside: avoid;">
      ${response.response}
    </td>
  </tr>
`;
        if (responseFollowUps.length > 0) {
          html += `
<!-- FOLLOW-UP SECTION HEADER -->
<tr style="background: #f8fafc;">
  <td colspan="3" style="border: 1px solid #666; padding: 5px; font-size: 12px; font-weight: 700; color: #1e3a8a;">
    Follow-up Questions:
  </td>
</tr>
`;

          // Split follow-up questions into two columns
          const midPoint = Math.ceil(responseFollowUps.length / 2);
          const leftColumnQuestions = responseFollowUps.slice(0, midPoint);
          const rightColumnQuestions = responseFollowUps.slice(midPoint);

          // Start the two-column table
          html += `
<tr style="background: #ffffff;">
  <td colspan="3" style="border: 1px solid #666; padding: 0;">
    <table style="width: 100%; border-collapse: collapse; border: none;">
      <tr>
        <!-- LEFT COLUMN -->
        <td style="width: 50%; padding: 0; border-right: 1px solid #e2e8f0; vertical-align: top;">
          <div style="padding: 10px;">
  `;

          // Display left column questions
          leftColumnQuestions.forEach((fq, index) => {
            const rowBgColor = index % 2 === 0 ? "#ffffff" : "#f8fafc";
            let answerDisplay = "";
            let locationInfo = "";

            try {
              let parsedAnswer = fq.answer;
              if (typeof fq.answer === "string") {
                try {
                  parsedAnswer = JSON.parse(fq.answer);
                } catch (e) {
                  // Not JSON, keep as string
                }
              }

              // Helper function to check if a string is an image URL
              const isImageUrl = (urlString: string): boolean => {
                if (!urlString || typeof urlString !== "string") return false;
                const url = urlString.toLowerCase().trim();
                const imageExtensions = [
                  ".jpg",
                  ".jpeg",
                  ".png",
                  ".gif",
                  ".bmp",
                  ".webp",
                  ".svg",
                  ".jpg?",
                  ".jpeg?",
                  ".png?",
                  ".gif?",
                  ".bmp?",
                  ".webp?",
                  ".svg?",
                  ".jpg&",
                  ".jpeg&",
                  ".png&",
                  ".gif&",
                  ".bmp&",
                  ".webp&",
                  ".svg&",
                ];
                const imageHostingPatterns = [
                  "cloudinary.com",
                  "imgur.com",
                  "images.unsplash.com",
                  "i.imgur.com",
                  "storage.googleapis.com",
                  "amazonaws.com",
                  "/uploads/",
                  "/images/",
                  "/img/",
                  "/media/",
                  "/photos/",
                ];
                const hasImageExtension = imageExtensions.some((ext) =>
                  url.includes(ext),
                );
                const hasImagePattern = imageHostingPatterns.some((pattern) =>
                  url.includes(pattern),
                );
                const isDataUrl = url.startsWith("data:image");
                return hasImageExtension || hasImagePattern || isDataUrl;
              };

              // Function to extract image URLs
              const getImageUrls = (
                answer: any,
              ): Array<{
                url: string;
                location?: any;
                timestamp?: string;
              }> => {
                const images: Array<{
                  url: string;
                  location?: any;
                  timestamp?: string;
                }> = [];
                if (!answer) return images;

                if (typeof answer === "string") {
                  if (isImageUrl(answer)) {
                    images.push({ url: answer });
                  }
                  return images;
                }

                if (Array.isArray(answer)) {
                  answer.forEach((item) => {
                    if (typeof item === "string" && isImageUrl(item)) {
                      images.push({ url: item });
                    } else if (item && typeof item === "object") {
                      const potentialUrl =
                        item.url ||
                        item.imageUrl ||
                        item.image ||
                        item.photo ||
                        item.src;
                      if (potentialUrl && isImageUrl(potentialUrl)) {
                        images.push({
                          url: potentialUrl,
                          location: item.location,
                          timestamp: item.timestamp,
                        });
                      }
                    }
                  });
                  return images;
                }

                if (typeof answer === "object") {
                  const potentialUrl =
                    answer.url ||
                    answer.imageUrl ||
                    answer.image ||
                    answer.photo ||
                    answer.src;
                  if (potentialUrl && isImageUrl(potentialUrl)) {
                    images.push({
                      url: potentialUrl,
                      location: answer.location,
                      timestamp: answer.timestamp,
                    });
                  }
                }
                return images;
              };

              // Check for images
              const imageUrls = getImageUrls(parsedAnswer);

              if (imageUrls.length > 0) {
                const imagesWithLocation = imageUrls.filter(
                  (img) => img.location,
                ).length;

                answerDisplay = `
          <div style="margin-top: 5px;">
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
        `;

                imageUrls.forEach((image, imgIndex) => {
                  answerDisplay += `
            <div style="flex: 0 0 auto; display: flex; flex-direction: column; align-items: center;">
              <img src="${image.url}" 
                   style="width: 80px; height: 80px; object-fit: cover; border: 1px solid #ccc; border-radius: 3px; margin-bottom: 2px;"
                   alt="Evidence ${imgIndex + 1}"
                   onerror="this.onerror=null; this.src='https://via.placeholder.com/70/cccccc/999999?text=Image+Error'; this.style.border='1px solid #dc2626';">
              ${
                image.location
                  ? `
                <div style="font-size: 7px; color: #4b5563; text-align: center; line-height: 1.1; max-width: 70px;">
                  <div style="font-weight: 600;">📍</div>
                  <div>Lat: ${image.location.latitude.toFixed(4)}</div>
                  <div>Long: ${image.location.longitude.toFixed(4)}</div>
                </div>
              `
                  : ""
              }
            </div>
          `;
                });

                answerDisplay += `
            </div>
          </div>
        `;

                if (imagesWithLocation > 0) {
                  locationInfo = `
            <div style="font-size: 8px; color: #4b5563; margin-top: 3px; padding: 3px; background: #f0f9ff; border-radius: 2px;">
              📍 ${imagesWithLocation} of ${imageUrls.length} images have location
            </div>
          `;
                }
              } else if (typeof parsedAnswer === "string") {
                let cleanAnswer = parsedAnswer.trim();
                if (cleanAnswer.includes(fq.text)) {
                  cleanAnswer = cleanAnswer.replace(fq.text, "").trim();
                  cleanAnswer = cleanAnswer.replace(/^[:.\s\-]+/, "");
                }
                answerDisplay =
                  cleanAnswer ||
                  '<span style="color: #9ca3af; font-style: italic; font-size: 9px;">No response</span>';
              } else if (
                parsedAnswer === null ||
                parsedAnswer === undefined ||
                parsedAnswer === ""
              ) {
                answerDisplay =
                  '<span style="color: #9ca3af; font-style: italic; font-size: 9px;">No response</span>';
              } else {
                answerDisplay = String(parsedAnswer);
              }
            } catch (error) {
              console.error("❌ Error processing follow-up answer:", error);
              answerDisplay =
                '<span style="color: #dc2626; font-style: italic; font-size: 9px;">Error processing response</span>';
            }

            html += `
      <div style="margin-bottom: 12px; padding: 8px; background: ${rowBgColor}; border-radius: 4px; border: 1px solid #e2e8f0; page-break-inside: avoid;">
        <div style="font-size: 10px; font-weight: 600; color: #1e40af; margin-bottom: 3px;">
           ${formatQuestionNumberForDisplay(fq.number)} ${fq.text} ?
        </div>
        <div style="font-size: 10px; color: #374151; padding-left: 12px; line-height: 1.4;font-family: Arial, sans-serif;">
           ${answerDisplay}
          ${locationInfo}
        </div>
      </div>
    `;
          });

          html += `
          </div>
        </td>
        
        <!-- RIGHT COLUMN -->
        <td style="width: 50%; padding: 0; vertical-align: top;">
          <div style="padding: 10px;">
  `;

          // Display right column questions
          rightColumnQuestions.forEach((fq, index) => {
            const rowBgColor = index % 2 === 0 ? "#ffffff" : "#f8fafc";
            let answerDisplay = "";
            let locationInfo = "";

            try {
              let parsedAnswer = fq.answer;
              if (typeof fq.answer === "string") {
                try {
                  parsedAnswer = JSON.parse(fq.answer);
                } catch (e) {
                  // Not JSON, keep as string
                }
              }

              // Helper function to check if a string is an image URL
              const isImageUrl = (urlString: string): boolean => {
                if (!urlString || typeof urlString !== "string") return false;
                const url = urlString.toLowerCase().trim();
                const imageExtensions = [
                  ".jpg",
                  ".jpeg",
                  ".png",
                  ".gif",
                  ".bmp",
                  ".webp",
                  ".svg",
                  ".jpg?",
                  ".jpeg?",
                  ".png?",
                  ".gif?",
                  ".bmp?",
                  ".webp?",
                  ".svg?",
                  ".jpg&",
                  ".jpeg&",
                  ".png&",
                  ".gif&",
                  ".bmp&",
                  ".webp&",
                  ".svg&",
                ];
                const imageHostingPatterns = [
                  "cloudinary.com",
                  "imgur.com",
                  "images.unsplash.com",
                  "i.imgur.com",
                  "storage.googleapis.com",
                  "amazonaws.com",
                  "/uploads/",
                  "/images/",
                  "/img/",
                  "/media/",
                  "/photos/",
                ];
                const hasImageExtension = imageExtensions.some((ext) =>
                  url.includes(ext),
                );
                const hasImagePattern = imageHostingPatterns.some((pattern) =>
                  url.includes(pattern),
                );
                const isDataUrl = url.startsWith("data:image");
                return hasImageExtension || hasImagePattern || isDataUrl;
              };

              // Function to extract image URLs
              const getImageUrls = (
                answer: any,
              ): Array<{
                url: string;
                location?: any;
                timestamp?: string;
              }> => {
                const images: Array<{
                  url: string;
                  location?: any;
                  timestamp?: string;
                }> = [];
                if (!answer) return images;

                if (typeof answer === "string") {
                  if (isImageUrl(answer)) {
                    images.push({ url: answer });
                  }
                  return images;
                }

                if (Array.isArray(answer)) {
                  answer.forEach((item) => {
                    if (typeof item === "string" && isImageUrl(item)) {
                      images.push({ url: item });
                    } else if (item && typeof item === "object") {
                      const potentialUrl =
                        item.url ||
                        item.imageUrl ||
                        item.image ||
                        item.photo ||
                        item.src;
                      if (potentialUrl && isImageUrl(potentialUrl)) {
                        images.push({
                          url: potentialUrl,
                          location: item.location,
                          timestamp: item.timestamp,
                        });
                      }
                    }
                  });
                  return images;
                }

                if (typeof answer === "object") {
                  const potentialUrl =
                    answer.url ||
                    answer.imageUrl ||
                    answer.image ||
                    answer.photo ||
                    answer.src;
                  if (potentialUrl && isImageUrl(potentialUrl)) {
                    images.push({
                      url: potentialUrl,
                      location: answer.location,
                      timestamp: answer.timestamp,
                    });
                  }
                }
                return images;
              };

              // Check for images
              const imageUrls = getImageUrls(parsedAnswer);

              if (imageUrls.length > 0) {
                const imagesWithLocation = imageUrls.filter(
                  (img) => img.location,
                ).length;

                answerDisplay = `
          <div style="margin-top: 5px;">
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
        `;

                imageUrls.forEach((image, imgIndex) => {
                  answerDisplay += `
            <div style="flex: 0 0 auto; display: flex; flex-direction: column; align-items: center;">
              <img src="${image.url}" 
                   style="width: 70px; height: 70px; object-fit: cover; border: 1px solid #ccc; border-radius: 3px; margin-bottom: 2px;"
                   alt="Evidence ${imgIndex + 1}"
                   onerror="this.onerror=null; this.src='https://via.placeholder.com/70/cccccc/999999?text=Image+Error'; this.style.border='1px solid #dc2626';">
              ${
                image.location
                  ? `
                <div style="font-size: 7px; color: #4b5563; text-align: center; line-height: 1.1; max-width: 70px;">
                  <div style="font-weight: 600;">📍</div>
                  <div>Lat: ${image.location.latitude.toFixed(4)}</div>
                  <div>Long: ${image.location.longitude.toFixed(4)}</div>
                </div>
              `
                  : ""
              }
            </div>
          `;
                });

                answerDisplay += `
            </div>
          </div>
        `;

                if (imagesWithLocation > 0) {
                  locationInfo = `
            <div style="font-size: 8px; color: #4b5563; margin-top: 3px; padding: 3px; background: #f0f9ff; border-radius: 2px;">
              📍 ${imagesWithLocation} of ${imageUrls.length} images have location
            </div>
          `;
                }
              } else if (typeof parsedAnswer === "string") {
                let cleanAnswer = parsedAnswer.trim();
                if (cleanAnswer.includes(fq.text)) {
                  cleanAnswer = cleanAnswer.replace(fq.text, "").trim();
                  cleanAnswer = cleanAnswer.replace(/^[:.\s\-]+/, "");
                }
                answerDisplay =
                  cleanAnswer ||
                  '<span style="color: #9ca3af; font-style: italic; font-size: 9px;">No response</span>';
              } else if (
                parsedAnswer === null ||
                parsedAnswer === undefined ||
                parsedAnswer === ""
              ) {
                answerDisplay =
                  '<span style="color: #9ca3af; font-style: italic; font-size: 9px;">No response</span>';
              } else {
                answerDisplay = String(parsedAnswer);
              }
            } catch (error) {
              console.error("❌ Error processing follow-up answer:", error);
              answerDisplay =
                '<span style="color: #dc2626; font-style: italic; font-size: 9px;">Error processing response</span>';
            }

            html += `
      <div style="margin-bottom: 12px; padding: 8px; background: ${rowBgColor}; border-radius: 4px; border: 1px solid #e2e8f0; page-break-inside: avoid;">
        <div style="font-size: 10px; font-weight: 600; color: #1e40af; margin-bottom: 3px;">
          ${formatQuestionNumberForDisplay(fq.number)} ${fq.text} ?
        </div>
        <div style="font-size: 10px; color: #374151; padding-left: 12px; line-height: 1.4;font-family:italic;">
          ${answerDisplay}
          ${locationInfo}
        </div>
      </div>
    `;
          });

          html += `
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>
`;
        }

        if (hasSuggestion) {
          html += `
  <!-- SUGGESTION SECTION -->
  <tr style="background: #ffffffff;">
    <td colspan="3" style="border: 1px solid #666; padding: 10px; font-size: 12px; font-weight: 700; color: #1e3a8a;">
      Suggestion/Notes:
    </td>
  </tr>
  
  <tr style="background: #ffffff;">
    <td colspan="3" style="border: 1px solid #666; padding: 10px;">
      <div style="font-size: 10px; line-height: 1.6;" page-break-after:always;>
        <span style="font-weight: 700; color: #1e3a8a;">${formatQuestionNumberForDisplay(
          response.questionNumber,
        )}</span> - ${response.suggestion}
      </div>
    </td>
  </tr>
`;
        }

        html += `
    </td>
  </tr>
</table>
`;
      });
    },
  );

  return html;
}

// Helper function to limit combined response analysis size
function limitCombinedResponseAnalysisSize(
  html: string,
  maxSizeInChars: number = 99999999,
): string {
  return limitResponseAnalysisSize(html, maxSizeInChars);
}

// Update the generateBothResponseAnalysis function
function generateBothResponseAnalysis(
  form: any,
  response: any,
  availableSections: any[],
  maxSize: number = 9999999,
): string {
  const html = generateCombinedResponseAnalysis(
    form,
    response,
    availableSections,
  );
  return limitCombinedResponseAnalysisSize(html, maxSize);
}

function generateResponsesViewAnalysis(form: any, response: any): string {
  if (!form || !response || !response.answers) return "";

  let html = "";

  const sections = form.sections || [];

  sections.forEach((section: any) => {
    const questions = section.questions || [];
    if (questions.length === 0) return;

    html += `
      <div style="margin-top: 30px; margin-bottom: 20px; page-break-inside: avoid;">
        <h3 style="font-size: 16px; font-weight: 700; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; margin-bottom: 15px;">
          ${section.title || "Section"}
        </h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; font-size: 11px;">
          <thead>
            <tr style="background: #1e3a8a;">
              <th style="padding: 10px; text-align: left; font-size: 11px; font-weight: 600; color: white; border: 1px solid #e2e8f0; width: 40%;">Question</th>
              <th style="padding: 10px; text-align: center; font-size: 11px; font-weight: 600; color: white; border: 1px solid #e2e8f0; width: 60%;">Response</th>
            </tr>
          </thead>
          <tbody>
    `;

    questions.forEach((question: any, idx: number) => {
      const answer = response.answers[question.id];
      const hasCorrectAnswer = !!(
        question.correctAnswer ||
        (question.correctAnswers && question.correctAnswers.length > 0)
      );

      const correctAnswerDisplay = hasCorrectAnswer
        ? question.correctAnswers && question.correctAnswers.length > 0
          ? question.correctAnswers.join(", ")
          : String(question.correctAnswer)
        : "";

      const selectedAnswer =
        answer !== undefined
          ? Array.isArray(answer)
            ? answer.join(", ")
            : String(answer)
          : "Not Answered";

      const isArray = Array.isArray(answer);
      const normalized = String(selectedAnswer || "")
        .trim()
        .toLowerCase();

      let isCorrect = false;
      if (hasCorrectAnswer) {
        if (question.correctAnswers && question.correctAnswers.length > 0) {
          if (isArray) {
            isCorrect =
              answer.length === question.correctAnswers.length &&
              answer.every((a: any) =>
                question.correctAnswers!.some(
                  (ca: any) =>
                    String(ca).toLowerCase() === String(a).toLowerCase(),
                ),
              );
          } else {
            isCorrect = question.correctAnswers.some(
              (ca: any) => String(ca).toLowerCase() === normalized,
            );
          }
        } else if (question.correctAnswer) {
          isCorrect =
            String(question.correctAnswer).toLowerCase() === normalized;
        }
      }

      const rowBgColor = idx % 2 === 0 ? "#ffffff" : "#f8fafc";

      let answerColor = "#1e40af";
      if (hasCorrectAnswer) {
        answerColor = isCorrect ? "#059669" : "#dc2626";
      } else {
        const normalizedValue = String(selectedAnswer || "")
          .trim()
          .toLowerCase();
        if (normalizedValue === "yes" || normalizedValue === "y") {
          answerColor = "#059669";
        } else if (normalizedValue === "no" || normalizedValue === "n") {
          answerColor = "#dc2626";
        } else if (
          normalizedValue === "n/a" ||
          normalizedValue === "na" ||
          normalizedValue === "not applicable"
        ) {
          answerColor = "#ca8a04"; // Yellow/Orange
        }
      }

      if (hasCorrectAnswer) {
        html += `
          <tr style="background-color: ${rowBgColor};">
            <td style="padding: 8px; border: 1px solid #e2e8f0; color: #1f2937; font-weight: 500; width: 40%;">
              ${question.text || question.title || "Question"}
            </td>
            <td style="padding: 0; border: 1px solid #e2e8f0; width: 60%;">
              <table style="width: 100%; border-collapse: collapse; margin: 0; border: none;">
                <tr>
                  <td style="padding: 8px; text-align: center; color: #059669; font-weight: 600; width: 50%; border-right: 1px solid #e2e8f0;">
                    ${correctAnswerDisplay}
                  </td>
                  <td style="padding: 8px; text-align: center; width: 50%;">
                    ${renderAnswerHTML(answer, answerColor)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        `;
      } else {
        html += `
          <tr style="background-color: ${rowBgColor};">
            <td style="padding: 8px; border: 1px solid #e2e8f0; color: #1f2937; font-weight: 500; width: 40%;">
              ${question.text || question.title || "Question"}
            </td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; width: 60%;">
              ${renderAnswerHTML(answer, answerColor)}
            </td>
          </tr>
        `;
      }

      // ADDITION: Include synthetic follow-ups in Responses View
      const syntheticKey = `synthetic_${question.id}`;
      const syntheticData = response.answers?.[syntheticKey];
      if (syntheticData && typeof syntheticData === "object") {
        Object.entries(syntheticData).forEach(
          ([fuText, fuData]: [string, any]) => {
            if (fuData.answer) {
              html += `
              <tr style="background-color: ${rowBgColor}; font-style: italic;">
                <td style="padding: 6px 8px 6px 20px; border: 1px solid #e2e8f0; color: #4b5563; font-size: 10px;">
                  <span style="color: #ef4444; font-weight: 600; margin-right: 5px;">FU.S</span> ${fuText}
                </td>
                <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; color: #1e40af; font-size: 10px;">
                  ${renderAnswerHTML(fuData.answer, "#1e40af")}
                </td>
              </tr>
            `;
            }
          },
        );
      }
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  });

  return html;
}

// Add this function at the top of your file
function buildNestedFormForAnalysis(sections: any[]): any {
  console.log("🔄 Building nested form structure for analysis...");

  const nestedSections = sections.map((section) => {
    if (!section.questions || !Array.isArray(section.questions)) {
      return section;
    }

    console.log(`📋 Processing section: "${section.title}"`);
    console.log(`   - Original questions: ${section.questions.length}`);

    // Create a map of all questions by ID
    const questionMap = new Map<string, any>();
    section.questions.forEach((q: any) => {
      questionMap.set(q.id, { ...q, followUpQuestions: [] });
    });

    const mainQuestions: any[] = [];
    const followUpQuestions: any[] = [];

    section.questions.forEach((q: any) => {
      const questionWithShowWhen = q as any;
      if (
        q.parentId ||
        (questionWithShowWhen.showWhen &&
          questionWithShowWhen.showWhen.questionId)
      ) {
        followUpQuestions.push(q);
      } else {
        mainQuestions.push(q);
      }
    });

    console.log(`   - Main questions: ${mainQuestions.length}`);
    console.log(`   - Follow-up questions: ${followUpQuestions.length}`);

    // Attach follow-ups to their parent questions
    followUpQuestions.forEach((followUp: any) => {
      const followUpWithShowWhen = followUp as any;
      const parentId =
        followUp.parentId || followUpWithShowWhen.showWhen?.questionId;

      if (parentId && questionMap.has(parentId)) {
        const parentQuestion = questionMap.get(parentId);
        parentQuestion.followUpQuestions.push({
          ...followUp,
          parentId: parentId,
        });
        console.log(
          `   ✅ Attached follow-up: "${followUp.text}" → parent: "${parentQuestion.text}"`,
        );
      } else {
        console.log(
          `   ❌ Could not find parent for follow-up: "${followUp.text}" (parentId: ${parentId})`,
        );
        // Keep as main question if parent not found
        mainQuestions.push(followUp);
      }
    });

    // Update section with nested structure
    const updatedSection = {
      ...section,
      questions: mainQuestions.map((q: any) => questionMap.get(q.id)),
    };

    console.log(
      `   - Final nested questions: ${updatedSection.questions.length}`,
    );
    updatedSection.questions.forEach((q: any, index: number) => {
      console.log(
        `   - Q${index + 1}: "${q.text}" (${
          q.followUpQuestions.length
        } follow-ups)`,
      );
    });

    return updatedSection;
  });

  const result = { sections: nestedSections };
  console.log("✅ Nested form structure for analysis completed");
  return result;
}

// Helper function to check if answer is N/A
const isNAResponse = (answer: any): boolean => {
  if (typeof answer === "string") {
    const normalized = answer.trim().toLowerCase();
    return (
      normalized === "n/a" ||
      normalized === "na" ||
      normalized === "not applicable"
    );
  }
  if (Array.isArray(answer)) {
    return answer.some((item) => {
      if (typeof item === "string") {
        const normalized = item.trim().toLowerCase();
        return (
          normalized === "n/a" ||
          normalized === "na" ||
          normalized === "not applicable"
        );
      }
      return false;
    });
  }
  return false;
};

// Helper function to check if answer is YES
const isYesResponse = (answer: any): boolean => {
  if (typeof answer === "string") {
    return (
      answer.trim().toUpperCase() === "YES" ||
      answer.trim().toUpperCase() === "Y"
    );
  }
  if (Array.isArray(answer)) {
    return answer.some(
      (item) =>
        typeof item === "string" &&
        (item.trim().toUpperCase() === "YES" ||
          item.trim().toUpperCase() === "Y"),
    );
  }
  return false;
};

// Helper function to check if answer is NO
const isNoResponse = (answer: any): boolean => {
  if (typeof answer === "string") {
    return answer.trim().toUpperCase() === "NO";
  }
  if (Array.isArray(answer)) {
    return answer.some(
      (item) => typeof item === "string" && item.trim().toUpperCase() === "NO",
    );
  }
  return false;
};

// Helper function to generate question numbers
const getQuestionNumber = (
  question: any,
  sectionIndex: number,
  questionIndex: number,
  followUpPath: number[] = [],
): string => {
  const match = question.text?.match(/(Q\d+(?:\.\d+)*)/i);
  if (match) {
    return match[1];
  }

  const idMatch = question.id?.match(/(\d+\.\d+(?:\.\d+)*)/);
  if (idMatch) {
    return `Q${idMatch[1]}`;
  }

  const generateQuestionNumber = (
    sectionIndex: number,
    questionIndex: number,
    followUpPath: number[] = [],
  ): string => {
    let number = `Q${sectionIndex + 1}.${questionIndex + 1}`;
    if (followUpPath.length > 0) {
      number += "." + followUpPath.join(".");
    }
    return number;
  };

  return generateQuestionNumber(sectionIndex, questionIndex, followUpPath);
};

// Helper function to check if it's a real answer
const checkIfRealAnswer = (answer: any, questionText: string): boolean => {
  if (answer === undefined || answer === null || answer === "") {
    return false;
  }

  if (typeof answer === "string") {
    const trimmed = answer.trim();
    if (!trimmed) return false;

    let cleanAnswer = trimmed;
    if (cleanAnswer.toLowerCase().startsWith("sample ")) {
      cleanAnswer = cleanAnswer.substring(7).trim();
    }

    if (cleanAnswer === questionText || cleanAnswer.includes(questionText)) {
      if (cleanAnswer.length > questionText.length) {
        const afterQuestion = cleanAnswer.substring(questionText.length).trim();
        return afterQuestion.length > 0;
      }
      return false;
    }

    return cleanAnswer.length > 0;
  }

  if (Array.isArray(answer)) {
    return (
      answer.length > 0 &&
      answer.some(
        (item) => item && typeof item === "string" && item.trim().length > 0,
      )
    );
  }

  return true;
};

// Generic response analysis generator with size optimization
function generateResponseAnalysis(
  form: any,
  response: any,
  availableSections: any[],
  responseType: "no" | "yes" | "na",
): string {
  console.log(
    `🔍 Starting ${responseType.toUpperCase()} Response Analysis generation...`,
  );

  if (!form || !response || !response.answers) {
    console.log("❌ No form, response, or answers available");
    return "";
  }

  // Build nested structure from flat data
  const nestedForm = buildNestedFormForAnalysis(availableSections);
  const sectionsToUse = nestedForm.sections || [];

  console.log("✅ Built nested form structure");
  console.log(`📊 Sections: ${sectionsToUse.length}`);

  // Collect responses based on type
  const responses: Array<{
    sectionId: string;
    sectionTitle: string;
    questionId: string;
    questionNumber: string;
    questionText: string;
    response: string;
    followUpQuestions: Array<{
      id: string;
      text: string;
      answer: any;
      number: string;
    }>;
    suggestion: string;
    recommendation?: string;
  }> = [];

  // Recursive function to process questions
  const processQuestion = (
    question: any,
    section: any,
    depth: number = 0,
    sectionIndex: number,
    questionIndex: number,
    followUpPath: number[] = [],
  ) => {
    const answer = response.answers?.[question.id];
    let isTargetResponse = false;

    switch (responseType) {
      case "no":
        isTargetResponse = isNoResponse(answer);
        break;
      case "yes":
        isTargetResponse = isYesResponse(answer);
        break;
      case "na":
        isTargetResponse = isNAResponse(answer);
        break;
    }

    const questionNumber = getQuestionNumber(
      question,
      sectionIndex,
      questionIndex,
      followUpPath,
    );

    if (isTargetResponse && depth === 0) {
      console.log(
        `\n✅ Found ${responseType.toUpperCase()} response for ${questionNumber}: "${
          question.text
        }"`,
      );

      const followUps: Array<{
        id: string;
        text: string;
        answer: any;
        number: string;
      }> = [];

      const collectFollowUps = (
        questions: any[],
        currentDepth: number,
        parentPath: number[],
      ) => {
        questions.forEach((fq, fqIndex) => {
          const followUpAnswer = response.answers?.[fq.id];
          const fuPath = [...parentPath, fqIndex + 1];
          const followUpNumber = `${questionNumber}.${fqIndex + 1}`;

          const isRealAnswer = checkIfRealAnswer(followUpAnswer, fq.text);

          if (isRealAnswer) {
            console.log(`       ✅ Adding to followUps (has real answer)`);
            followUps.push({
              id: fq.id,
              text: fq.text,
              answer: followUpAnswer,
              number: followUpNumber,
            });
          } else {
            console.log(`       ❌ Skipping follow-up (not a real answer)`);
          }

          if (fq.followUpQuestions && fq.followUpQuestions.length > 0) {
            collectFollowUps(fq.followUpQuestions, currentDepth + 1, fuPath);
          }
        });
      };

      if (question.followUpQuestions && question.followUpQuestions.length > 0) {
        console.log(
          `   📞 Starting to collect follow-ups for: "${question.text}"`,
        );
        collectFollowUps(question.followUpQuestions, 1, []);
      } else {
        console.log(
          `   ⓘ No follow-up questions found for: "${question.text}"`,
        );
      }

      // ADDITION: Check for synthetic follow-ups from Excel imports
      const syntheticKey = `synthetic_${question.id}`;
      const syntheticData = response.answers?.[syntheticKey];

      if (syntheticData && typeof syntheticData === "object") {
        console.log(
          `   🧪 Found synthetic data for ${question.id}, processing...`,
        );

        Object.entries(syntheticData).forEach(
          ([fuText, fuData]: [string, any]) => {
            // Only add if it's not already there by ID
            const alreadyExists = followUps.some((f) => f.text === fuText);

            if (!alreadyExists && fuData.answer) {
              console.log(`     ✅ Adding synthetic follow-up: "${fuText}"`);
              followUps.push({
                id: `${question.id}_synth_${fuText}`,
                text: fuText,
                answer: fuData.answer,
                number: "FU.S", // Synthetic indicator
              });
            }
          },
        );
      }

      const suggestion =
        question.suggestion ||
        question.recommendation ||
        question.actionItem ||
        question.correctiveAction ||
        question.guidance ||
        question.notes ||
        question.instruction ||
        "";

      responses.push({
        sectionId: section.id,
        sectionTitle: section.title || section.name || "Unknown Section",
        questionId: question.id,
        questionNumber: questionNumber,
        questionText: question.text,
        response: responseType.toUpperCase(),
        followUpQuestions: followUps,
        suggestion: suggestion,
        recommendation: question.recommendation || question.actionItem,
      });

      console.log(
        `   ✅ Added to responses with ${followUps.length} REAL follow-up answer(s)`,
      );
    }

    if (question.followUpQuestions && question.followUpQuestions.length > 0) {
      question.followUpQuestions.forEach((fq: any, fqIndex: number) => {
        const newFollowUpPath = [...followUpPath, fqIndex + 1];
        processQuestion(
          fq,
          section,
          depth + 1,
          sectionIndex,
          questionIndex,
          newFollowUpPath,
        );
      });
    }
  };

  // Process all sections and questions
  console.log(
    `\n🔍 Processing nested sections for ${responseType.toUpperCase()} responses...`,
  );
  sectionsToUse.forEach((section, sectionIndex) => {
    console.log(`\n📁 Processing section: "${section.title}"`);
    if (section.questions && section.questions.length > 0) {
      console.log(`   Questions: ${section.questions.length}`);
      section.questions.forEach((question: any, questionIndex: number) => {
        console.log(
          `   Q${sectionIndex + 1}.${
            questionIndex + 1
          }: "${question.text.substring(0, 50)}..."`,
        );
        processQuestion(question, section, 0, sectionIndex, questionIndex, []);
      });
    }
  });

  console.log(
    `\n📊 Found ${responses.length} ${responseType.toUpperCase()} responses`,
  );

  if (responses.length === 0) {
    return "";
  }

  // Group responses by section
  const responsesBySection = responses.reduce(
    (groups: Record<string, any[]>, response) => {
      if (!groups[response.sectionTitle]) {
        groups[response.sectionTitle] = [];
      }
      groups[response.sectionTitle].push(response);
      return groups;
    },
    {},
  );

  // Generate HTML
  let html = "";
  // Helper function to format question number for display: "Q3.4" → "S3.Q4"

  Object.entries(responsesBySection).forEach(
    ([sectionTitle, responses], sectionIndex) => {
      responses.forEach((response, responseIndex) => {
        const responseFollowUps = response.followUpQuestions || [];
        const hasSuggestion =
          response.suggestion && response.suggestion.trim() !== "";
        const responseColor =
          responseType === "no"
            ? "red"
            : responseType === "yes"
              ? "black"
              : "#f59e0b";

        html += `
<!-- Separate Table for EACH Main Question (${responseType.toUpperCase()} Response) -->
<table style="width: 100%; border-collapse: collapse; border: 1px solid #666; margin: -5 0 20px 0; page-break-after: always;">
  
  <!-- SECTION HEADER -->
  <tr style="background: #ffffffff;">
    <td colspan="3" style="border: 1px solid #666; padding: 10px; font-size: 14px; font-weight: 800; color: #1e3a8a;">
        ${sectionTitle} - ${formatQuestionNumberForDisplay(
          response.questionNumber,
        )}
    </td>
  </tr>
  
  <!-- TABLE HEADERS -->
  <tr style="background:#1e3a8a;">
    <td style="border: 1px solid #666; padding: 8px; font-weight: 700; font-size: 11px; width: 10%;background:#1e3a8a; color:#ffffffff">
      Question No
    </td>
    <td style="border: 1px solid #666; padding: 8px; font-weight: 700; font-size: 11px; width: 80%;background:#1e3a8a;color:#ffffffff">
      Question
    </td>
    <td style="border: 1px solid #666; padding: 8px; text-align: center; font-weight: 700; font-size: 11px; width: 10%;background:#1e3a8a;color:#ffffffff">
      Response
    </td>
  </tr>
  
  <!-- MAIN QUESTION ROW -->
  <tr style="background: #ffffff;">
    <td style="border: 1px solid #666; padding: 8px; vertical-align: top; font-size: 10px; font-weight: 600; color: #374151;page-break-inside: avoid;">
      ${formatQuestionNumberForDisplay(response.questionNumber)}
    </td>
    <td style="border: 1px solid #666; padding: 8px; vertical-align: top; font-size: 10px; color: #4b5563; line-height: 1.6;page-break-inside: avoid;">
      ${response.questionText}
    </td>
    <td style="border: 1px solid #666; padding: 8px; vertical-align: middle; text-align: center; font-size: 11px; font-weight: 600; color: ${responseColor};page-break-inside: avoid;">
      ${response.response}
    </td>
  </tr>
`;

        if (responseFollowUps.length > 0) {
          html += `
<!-- FOLLOW-UP SECTION HEADER -->
<tr style="background: #f8fafc;">
  <td colspan="3" style="border: 1px solid #666; padding: 5px; font-size: 12px; font-weight: 700; color: #1e3a8a;">
    Follow-up Questions:
  </td>
</tr>
`;

          // Split follow-up questions into two columns
          const midPoint = Math.ceil(responseFollowUps.length / 2);
          const leftColumnQuestions = responseFollowUps.slice(0, midPoint);
          const rightColumnQuestions = responseFollowUps.slice(midPoint);

          // Start the two-column table
          html += `
<tr style="background: #ffffff;">
  <td colspan="3" style="border: 1px solid #666; padding: 0;">
    <table style="width: 100%; border-collapse: collapse; border: none;">
      <tr>
        <!-- LEFT COLUMN -->
        <td style="width: 50%; padding: 0; border-right: 1px solid #e2e8f0; vertical-align: top;">
          <div style="padding: 10px;">
  `;

          // Display left column questions
          leftColumnQuestions.forEach((fq, index) => {
            const rowBgColor = index % 2 === 0 ? "#ffffff" : "#f8fafc";
            let answerDisplay = "";
            let locationInfo = "";

            try {
              let parsedAnswer = fq.answer;
              if (typeof fq.answer === "string") {
                try {
                  parsedAnswer = JSON.parse(fq.answer);
                } catch (e) {
                  // Not JSON, keep as string
                }
              }

              // Helper function to check if a string is an image URL
              const isImageUrl = (urlString: string): boolean => {
                if (!urlString || typeof urlString !== "string") return false;
                const url = urlString.toLowerCase().trim();
                const imageExtensions = [
                  ".jpg",
                  ".jpeg",
                  ".png",
                  ".gif",
                  ".bmp",
                  ".webp",
                  ".svg",
                  ".jpg?",
                  ".jpeg?",
                  ".png?",
                  ".gif?",
                  ".bmp?",
                  ".webp?",
                  ".svg?",
                  ".jpg&",
                  ".jpeg&",
                  ".png&",
                  ".gif&",
                  ".bmp&",
                  ".webp&",
                  ".svg&",
                ];
                const imageHostingPatterns = [
                  "cloudinary.com",
                  "imgur.com",
                  "images.unsplash.com",
                  "i.imgur.com",
                  "storage.googleapis.com",
                  "amazonaws.com",
                  "/uploads/",
                  "/images/",
                  "/img/",
                  "/media/",
                  "/photos/",
                ];
                const hasImageExtension = imageExtensions.some((ext) =>
                  url.includes(ext),
                );
                const hasImagePattern = imageHostingPatterns.some((pattern) =>
                  url.includes(pattern),
                );
                const isDataUrl = url.startsWith("data:image");
                return hasImageExtension || hasImagePattern || isDataUrl;
              };

              // Function to extract image URLs
              const getImageUrls = (
                answer: any,
              ): Array<{
                url: string;
                location?: any;
                timestamp?: string;
              }> => {
                const images: Array<{
                  url: string;
                  location?: any;
                  timestamp?: string;
                }> = [];
                if (!answer) return images;

                if (typeof answer === "string") {
                  if (isImageUrl(answer)) {
                    images.push({ url: answer });
                  }
                  return images;
                }

                if (Array.isArray(answer)) {
                  answer.forEach((item) => {
                    if (typeof item === "string" && isImageUrl(item)) {
                      images.push({ url: item });
                    } else if (item && typeof item === "object") {
                      const potentialUrl =
                        item.url ||
                        item.imageUrl ||
                        item.image ||
                        item.photo ||
                        item.src;
                      if (potentialUrl && isImageUrl(potentialUrl)) {
                        images.push({
                          url: potentialUrl,
                          location: item.location,
                          timestamp: item.timestamp,
                        });
                      }
                    }
                  });
                  return images;
                }

                if (typeof answer === "object") {
                  const potentialUrl =
                    answer.url ||
                    answer.imageUrl ||
                    answer.image ||
                    answer.photo ||
                    answer.src;
                  if (potentialUrl && isImageUrl(potentialUrl)) {
                    images.push({
                      url: potentialUrl,
                      location: answer.location,
                      timestamp: answer.timestamp,
                    });
                  }
                }
                return images;
              };

              // Check for images
              const imageUrls = getImageUrls(parsedAnswer);

              if (imageUrls.length > 0) {
                const imagesWithLocation = imageUrls.filter(
                  (img) => img.location,
                ).length;

                answerDisplay = `
          <div style="margin-top: 5px;">
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 0px;">
        `;

                imageUrls.forEach((image, imgIndex) => {
                  answerDisplay += `
            <div style="flex: 0 0 auto; display: flex; flex-direction: column; align-items: center;">
              <img src="${image.url}" 
                   style="width: 80px; height: 80px; object-fit: cover; border: 1px solid #ccc; border-radius: 3px; margin-bottom: 0  px;"
                   alt="Evidence ${imgIndex + 1}"
                   onerror="this.onerror=null; this.src='https://via.placeholder.com/70/cccccc/999999?text=Image+Error'; this.style.border='1px solid #dc2626';">
              ${
                image.location
                  ? `
                <div style="font-size: 7px; color: #4b5563; text-align: center; line-height: 1.1; max-width: 70px;">
                  <div style="font-weight: 600;">📍</div>
                  <div>Lat: ${image.location.latitude.toFixed(4)}</div>
                  <div>Long: ${image.location.longitude.toFixed(4)}</div>
                </div>
              `
                  : ""
              }
            </div>
          `;
                });

                answerDisplay += `
            </div>
          </div>
        `;

                if (imagesWithLocation > 0) {
                  locationInfo = `
            <div style="font-size: 8px; color: #4b5563; margin-top: 3px; padding: 3px; background: #f0f9ff; border-radius: 2px;">
              📍 ${imagesWithLocation} of ${imageUrls.length} images have location
            </div>
          `;
                }
              } else if (typeof parsedAnswer === "string") {
                let cleanAnswer = parsedAnswer.trim();
                if (cleanAnswer.includes(fq.text)) {
                  cleanAnswer = cleanAnswer.replace(fq.text, "").trim();
                  cleanAnswer = cleanAnswer.replace(/^[:.\s\-]+/, "");
                }
                answerDisplay =
                  cleanAnswer ||
                  '<span style="color: #9ca3af; font-style: italic; font-size: 9px;">No response</span>';
              } else if (
                parsedAnswer === null ||
                parsedAnswer === undefined ||
                parsedAnswer === ""
              ) {
                answerDisplay =
                  '<span style="color: #9ca3af; font-style: italic; font-size: 9px;">No response</span>';
              } else {
                answerDisplay = String(parsedAnswer);
              }
            } catch (error) {
              console.error("❌ Error processing follow-up answer:", error);
              answerDisplay =
                '<span style="color: #dc2626; font-style: italic; font-size: 9px;">Error processing response</span>';
            }

            html += `
      <div style="margin-bottom: 2px; padding: 8px; background: ${rowBgColor}; border-radius: 4px; border: 1px solid #e2e8f0; page-break-inside: avoid;">
        <div style="font-size: 10px; font-weight: 600; color: #1e40af; margin-bottom: 3px;">
           ${formatQuestionNumberForDisplay(fq.number)} ${fq.text} ?
        </div>
        <div style="font-size: 10px; color: #374151; padding-left: 12px; line-height: 1.4;font-family: Arial, sans-serif;">
           ${answerDisplay}
          ${locationInfo}
        </div>
      </div>
    `;
          });

          html += `
          </div>
        </td>
        
        <!-- RIGHT COLUMN -->
        <td style="width: 50%; padding: 0; vertical-align: top;">
          <div style="padding: 10px;">
  `;

          // Display right column questions
          rightColumnQuestions.forEach((fq, index) => {
            const rowBgColor = index % 2 === 0 ? "#ffffff" : "#f8fafc";
            let answerDisplay = "";
            let locationInfo = "";

            try {
              let parsedAnswer = fq.answer;
              if (typeof fq.answer === "string") {
                try {
                  parsedAnswer = JSON.parse(fq.answer);
                } catch (e) {
                  // Not JSON, keep as string
                }
              }

              // Helper function to check if a string is an image URL
              const isImageUrl = (urlString: string): boolean => {
                if (!urlString || typeof urlString !== "string") return false;
                const url = urlString.toLowerCase().trim();
                const imageExtensions = [
                  ".jpg",
                  ".jpeg",
                  ".png",
                  ".gif",
                  ".bmp",
                  ".webp",
                  ".svg",
                  ".jpg?",
                  ".jpeg?",
                  ".png?",
                  ".gif?",
                  ".bmp?",
                  ".webp?",
                  ".svg?",
                  ".jpg&",
                  ".jpeg&",
                  ".png&",
                  ".gif&",
                  ".bmp&",
                  ".webp&",
                  ".svg&",
                ];
                const imageHostingPatterns = [
                  "cloudinary.com",
                  "imgur.com",
                  "images.unsplash.com",
                  "i.imgur.com",
                  "storage.googleapis.com",
                  "amazonaws.com",
                  "/uploads/",
                  "/images/",
                  "/img/",
                  "/media/",
                  "/photos/",
                ];
                const hasImageExtension = imageExtensions.some((ext) =>
                  url.includes(ext),
                );
                const hasImagePattern = imageHostingPatterns.some((pattern) =>
                  url.includes(pattern),
                );
                const isDataUrl = url.startsWith("data:image");
                return hasImageExtension || hasImagePattern || isDataUrl;
              };

              // Function to extract image URLs
              const getImageUrls = (
                answer: any,
              ): Array<{
                url: string;
                location?: any;
                timestamp?: string;
              }> => {
                const images: Array<{
                  url: string;
                  location?: any;
                  timestamp?: string;
                }> = [];
                if (!answer) return images;

                if (typeof answer === "string") {
                  if (isImageUrl(answer)) {
                    images.push({ url: answer });
                  }
                  return images;
                }

                if (Array.isArray(answer)) {
                  answer.forEach((item) => {
                    if (typeof item === "string" && isImageUrl(item)) {
                      images.push({ url: item });
                    } else if (item && typeof item === "object") {
                      const potentialUrl =
                        item.url ||
                        item.imageUrl ||
                        item.image ||
                        item.photo ||
                        item.src;
                      if (potentialUrl && isImageUrl(potentialUrl)) {
                        images.push({
                          url: potentialUrl,
                          location: item.location,
                          timestamp: item.timestamp,
                        });
                      }
                    }
                  });
                  return images;
                }

                if (typeof answer === "object") {
                  const potentialUrl =
                    answer.url ||
                    answer.imageUrl ||
                    answer.image ||
                    answer.photo ||
                    answer.src;
                  if (potentialUrl && isImageUrl(potentialUrl)) {
                    images.push({
                      url: potentialUrl,
                      location: answer.location,
                      timestamp: answer.timestamp,
                    });
                  }
                }
                return images;
              };

              // Check for images
              const imageUrls = getImageUrls(parsedAnswer);

              if (imageUrls.length > 0) {
                const imagesWithLocation = imageUrls.filter(
                  (img) => img.location,
                ).length;

                answerDisplay = `
          <div style="margin-top: 5px;">
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
        `;

                imageUrls.forEach((image, imgIndex) => {
                  answerDisplay += `
            <div style="flex: 0 0 auto; display: flex; flex-direction: column; align-items: center;">
              <img src="${image.url}" 
                   style="width: 70px; height: 70px; object-fit: cover; border: 1px solid #ccc; border-radius: 3px; margin-bottom: 2px;"
                   alt="Evidence ${imgIndex + 1}"
                   onerror="this.onerror=null; this.src='https://via.placeholder.com/70/cccccc/999999?text=Image+Error'; this.style.border='1px solid #dc2626';">
              ${
                image.location
                  ? `
                <div style="font-size: 7px; color: #4b5563; text-align: center; line-height: 1.1; max-width: 70px;">
                  <div style="font-weight: 600;">📍</div>
                  <div>Lat: ${image.location.latitude.toFixed(4)}</div>
                  <div>Long: ${image.location.longitude.toFixed(4)}</div>
                </div>
              `
                  : ""
              }
            </div>
          `;
                });

                answerDisplay += `
            </div>
          </div>
        `;

                if (imagesWithLocation > 0) {
                  locationInfo = `
            <div style="font-size: 8px; color: #4b5563; margin-top: 3px; padding: 3px; background: #f0f9ff; border-radius: 2px;">
              📍 ${imagesWithLocation} of ${imageUrls.length} images have location
            </div>
          `;
                }
              } else if (typeof parsedAnswer === "string") {
                let cleanAnswer = parsedAnswer.trim();
                if (cleanAnswer.includes(fq.text)) {
                  cleanAnswer = cleanAnswer.replace(fq.text, "").trim();
                  cleanAnswer = cleanAnswer.replace(/^[:.\s\-]+/, "");
                }
                answerDisplay =
                  cleanAnswer ||
                  '<span style="color: #9ca3af; font-style: italic; font-size: 9px;">No response</span>';
              } else if (
                parsedAnswer === null ||
                parsedAnswer === undefined ||
                parsedAnswer === ""
              ) {
                answerDisplay =
                  '<span style="color: #9ca3af; font-style: italic; font-size: 9px;">No response</span>';
              } else {
                answerDisplay = String(parsedAnswer);
              }
            } catch (error) {
              console.error("❌ Error processing follow-up answer:", error);
              answerDisplay =
                '<span style="color: #dc2626; font-style: italic; font-size: 9px;">Error processing response</span>';
            }

            html += `
      <div style="margin-bottom: 2px; padding: 8px; background: ${rowBgColor}; border-radius: 4px; border: 1px solid #e2e8f0; page-break-inside: avoid;">
        <div style="font-size: 10px; font-weight: 600; color: #1e40af; margin-bottom: 3px;">
          ${formatQuestionNumberForDisplay(fq.number)} ${fq.text} ?  
        </div>
        <div style="font-size: 10px; color: #374151; padding-left: 12px; line-height: 1.4;font-family:italic;">
          ${answerDisplay}
          ${locationInfo}
        </div>
      </div>
    `;
          });

          html += `
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>
`;
        }

        if (hasSuggestion) {
          html += `
  <!-- SUGGESTION SECTION -->
  <tr style="background: #ffffffff;">
    <td colspan="3" style="border: 1px solid #666; padding: 5px; font-size: 12px; font-weight: 700; color: #1e3a8a;">
      Suggestion/Notes: 
    </td>
  </tr>
  
  <tr style="background: #ffffff;">
    <td colspan="3" style="border: 1px solid #666; padding: 10px;">
      <div style="font-size: 10px; line-height: 1.6;" page-break-after:always;>
        <span style="font-weight: 700; color: #1e3a8a;">${response.questionNumber}</span> - ${response.suggestion}
      </div>
    </td>
  </tr>
`;
        }

        html += `
    </td>
  </tr>
</table>
`;
      });
    },
  );

  return html;
}

// Helper function to limit response analysis size
/*function limitResponseAnalysisSize(
  html: string,
  maxSizeInChars: number = 500000
): string {
  if (html.length <= maxSizeInChars) {
    return html;
  }

  console.warn(
    `⚠️ Response analysis exceeds size limit (${html.length} chars). Truncating...`
  );

  const truncated = html.substring(0, maxSizeInChars);
  const lastTableEnd = truncated.lastIndexOf("</table>");

  if (lastTableEnd > 0) {
    return (
      truncated.substring(0, lastTableEnd + 8) +
      `
<table style="width: 100%; border-collapse: collapse; border: 1px solid #666; margin: 20px 0;">
  <tr style="background: #ffffffff;">
    <td colspan="3" style="border: 1px solid #666; padding: 10px; font-size: 12px; font-weight: 700; color: #f59e0b;">
      ⚠️ Response analysis truncated for performance
    </td>
  </tr>
  <tr style="background: #ffffff;">
    <td colspan="3" style="border: 1px solid #666; padding: 10px; font-size: 11px; color: #4b5563; line-height: 1.6;">
      The complete response analysis is very large. For the full analysis, please export individual response types (Yes/No/N/A) separately.
    </td>
  </tr>
</table>
    `
    );
  }

  return (
    truncated +
    `<p style="color: #f59e0b; font-weight: 700; margin-top: 20px;">⚠️ Response analysis was truncated due to size.</p>`
  );
}*/
function limitResponseAnalysisSize(
  html: string,
  maxSizeInChars: number = 99999999,
): string {
  // ✅ NEVER truncate — just log and return full HTML
  if (html.length > 1000000) {
    console.warn(`Large analysis: ${(html.length / 1000000).toFixed(2)}MB`);
  }
  return html; // ← always return full, never slice
}

// Individual response analysis functions (kept for backward compatibility)
function generateNoResponseAnalysis(
  form: any,
  response: any,
  availableSections: any[],
  maxSize: number = 99999999,
): string {
  const html = generateResponseAnalysis(
    form,
    response,
    availableSections,
    "no",
  );
  return limitResponseAnalysisSize(html, maxSize);
}

function generateYesResponseAnalysis(
  form: any,
  response: any,
  availableSections: any[],
  maxSize: number = 99999999,
): string {
  const html = generateResponseAnalysis(
    form,
    response,
    availableSections,
    "yes",
  );
  return limitResponseAnalysisSize(html, maxSize);
}

function generateNAResponseAnalysis(
  form: any,
  response: any,
  availableSections: any[],
  maxSize: number = 99999999,
): string {
  const html = generateResponseAnalysis(
    form,
    response,
    availableSections,
    "na",
  );
  return limitResponseAnalysisSize(html, maxSize);
}

function generatePieChartSVG(
  yesPercent: number,
  noPercent: number,
  naPercent: number,
  overallScore: number,
): string {
  const size = 140;
  const radius = 55;
  const strokeWidth = 25;
  const centerX = size / 2;
  const centerY = size / 2;

  const circumference = 2 * Math.PI * radius;

  // Calculate angles and dash lengths (rest of logic remains the same)
  const totalPercent = yesPercent + noPercent + naPercent;
  const effectiveTotal = totalPercent > 0 ? totalPercent : 100;

  const yesAngle = (yesPercent / effectiveTotal) * 360;
  const noAngle = (noPercent / effectiveTotal) * 360;
  const naAngle = (naPercent / effectiveTotal) * 360;

  const yesDash = (yesAngle / 360) * circumference;
  const noDash = (noAngle / 360) * circumference;
  const naDash = (naAngle / 360) * circumference;

  const yesColor = "rgba(35, 153, 96, 1)";
  const noColor = "rgba(215, 80, 68, 1)";
  const naColor = "#aeb1b5ff";

  // --- Donut Drawing Logic (Unchanged from fix) ---

  const baseTrack = `<circle
        cx="${centerX}" cy="${centerY}" r="${radius}"
        fill="none" stroke="#e0e7ff" stroke-width="${strokeWidth}"
    />`;

  let currentOffset = 0;
  const naSegment =
    naDash > 0
      ? `<circle
        cx="${centerX}" cy="${centerY}" r="${radius}"
        fill="none" stroke="${naColor}" stroke-width="${strokeWidth}"
        stroke-dasharray="${naDash} ${circumference - naDash}"
        stroke-dashoffset="${currentOffset}"
        transform="rotate(-90 ${centerX} ${centerY})"
    />`
      : "";
  currentOffset -= naDash;

  const noSegment =
    noDash > 0
      ? `<circle
        cx="${centerX}" cy="${centerY}" r="${radius}"
        fill="none" stroke="${noColor}" stroke-width="${strokeWidth}"
        stroke-dasharray="${noDash} ${circumference - noDash}"
        stroke-dashoffset="${currentOffset}"
        transform="rotate(-90 ${centerX} ${centerY})"
    />`
      : "";
  currentOffset -= noDash;

  const yesSegment =
    yesDash > 0
      ? `<circle
        cx="${centerX}" cy="${centerY}" r="${radius}"
        fill="none" stroke="${yesColor}" stroke-width="${strokeWidth}"
        stroke-dasharray="${yesDash} ${circumference - yesDash}"
        stroke-dashoffset="${currentOffset}"
        transform="rotate(-90 ${centerX} ${centerY})"
    />`
      : "";

  // --- Score Text Adjustments for Centering ---

  // Line 1: Score (Bigger) - Move up from center
  const scoreTextY = centerY - 5;

  // Line 2: Label (Smaller) - Move down from center
  const labelTextY = centerY + 10;

  const labelFontSize = 10; // Slightly larger for better readability

  return `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display: block; margin: 0 auto;">
            ${baseTrack}
            ${naSegment}
            ${noSegment}
            ${yesSegment}
            
            <text x="${centerX}" y="${scoreTextY}" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="22" font-weight="bold" fill="#1e3a8a">
                ${overallScore.toFixed(0)}%
            </text>
            
            <text x="${centerX}" y="${labelTextY}" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="${labelFontSize}" fill="#3b82f6" font-weight="600">
                Overall Score
            </text>
        </svg>
    `;
}

function generateFirstSectionContent(form: any, response: any): string {
  if (!form?.sections?.[0]) return "";

  const section = form.sections[0];
  const questions = section.questions || [];

  if (questions.length === 0) return "";

  const hasAnswerValue = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  };

  let html = `
    <div style="margin: -2px 0; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <!-- Table Header -->
      <div style="padding: 8px 12px; background: #1e3a8a; text-align: center;">
        <h2 style="font-size: 16px; font-weight: 700; color: white; margin: 0;">
          Basic Information
        </h2>
      </div>

      <!-- Table Content -->
      <div style="padding: 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
  `;

  // Split questions into two columns
  const midPoint = Math.ceil(questions.length / 2);
  const leftColumnQuestions = questions.slice(0, midPoint);
  const rightColumnQuestions = questions.slice(midPoint);

  // Determine the maximum number of rows needed
  const maxRows = Math.max(
    leftColumnQuestions.length,
    rightColumnQuestions.length,
  );

  for (let i = 0; i < maxRows; i++) {
    const leftQuestion = leftColumnQuestions[i];
    const rightQuestion = rightColumnQuestions[i];

    html += `<tr style="border-bottom: ${
      i < maxRows - 1 ? "1px solid #e5e7eb" : "none"
    };">`;

    // Left Column Cell
    html += `<td style="padding: 8px 12px; border-right: 1px solid #e5e7eb; vertical-align: top; width: 50%;">`;
    if (leftQuestion) {
      const answer = response?.answers?.[leftQuestion.id];
      html += `
        <div style="margin-bottom: 4px;">
          <span style="font-weight: 600; color: #111827;">${
            leftQuestion.text || leftQuestion.id
          }</span>
          <span style="color: #374151; margin-left: 4px;">${renderAnswerHTML(
            answer,
          )}</span>
        </div>
      `;

      // Follow-up questions for left column
      if (leftQuestion.followUpQuestions) {
        leftQuestion.followUpQuestions.forEach((followUp: any) => {
          const followAnswer = response?.answers?.[followUp.id];
          if (hasAnswerValue(followAnswer)) {
            html += `
              <div style="margin-top: 4px; padding-left: 8px; border-left: 2px solid #d1d5db;">
                <span style="font-weight: 500; color: #475569; font-size: 11px;">${
                  followUp.text || followUp.id
                }</span>
                <span style="color: #6b7280; font-size: 11px; margin-left: 4px;">${renderAnswerHTML(
                  followAnswer,
                )}</span>
              </div>
            `;
          }
        });
      }
    }
    html += `</td>`;

    // Right Column Cell
    html += `<td style="padding: 8px 12px; vertical-align: top; width: 50%;">`;
    if (rightQuestion) {
      const answer = response?.answers?.[rightQuestion.id];
      html += `
        <div style="margin-bottom: 4px;">
          <span style="font-weight: 600; color: #111827;">${
            rightQuestion.text || rightQuestion.id
          }</span>
          <span style="color: #374151; margin-left: 4px;">${renderAnswerHTML(
            answer,
          )}</span>
        </div>
      `;

      // Follow-up questions for right column
      if (rightQuestion.followUpQuestions) {
        rightQuestion.followUpQuestions.forEach((followUp: any) => {
          const followAnswer = response?.answers?.[followUp.id];
          if (hasAnswerValue(followAnswer)) {
            html += `
              <div style="margin-top: 4px; padding-left: 8px; border-left: 2px solid #d1d5db;">
                <span style="font-weight: 500; color: #475569; font-size: 11px;">${
                  followUp.text || followUp.id
                }</span>
                <span style="color: #6b7280; font-size: 11px; margin-left: 4px;">${renderAnswerHTML(
                  followAnswer,
                )}</span>
              </div>
            `;
          }
        });
      }
    }
    html += `</td>`;

    html += `</tr>`;
  }

  // Close table and container
  html += `
        </table>
      </div>
    </div>
  `;

  return html;
}

function generateScoreSection(sectionStats: any[]): string {
  const totalYes = sectionStats.reduce((sum, stat) => sum + (stat.yes || 0), 0);
  const totalNo = sectionStats.reduce((sum, stat) => sum + (stat.no || 0), 0);
  const totalNA = sectionStats.reduce((sum, stat) => sum + (stat.na || 0), 0);
  const totalCorrect = sectionStats.reduce(
    (sum, stat) => sum + (stat.correct || 0),
    0,
  );
  const totalWrong = sectionStats.reduce(
    (sum, stat) => sum + (stat.wrong || 0),
    0,
  );

  const totalCompliance = totalYes + totalNo + totalNA;
  const totalAccuracy = totalCorrect + totalWrong;
  const grandTotal = totalCompliance + totalAccuracy;

  const yesPercentage =
    totalCompliance > 0 ? (totalYes / totalCompliance) * 100 : 0;
  const noPercentage =
    totalCompliance > 0 ? (totalNo / totalCompliance) * 100 : 0;
  const naPercentage =
    totalCompliance > 0 ? (totalNA / totalCompliance) * 100 : 0;

  const correctPercentage =
    totalAccuracy > 0 ? (totalCorrect / totalAccuracy) * 100 : 0;
  const wrongPercentage =
    totalAccuracy > 0 ? (totalWrong / totalAccuracy) * 100 : 0;

  const hasAccuracy = totalAccuracy > 0;
  const hasCompliance = totalCompliance > 0;

  return `
    <div style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; font-family: 'Segoe UI', sans-serif;">
      <div style="padding: 8px 12px; background: #1e3a8a; text-align: center;">
        <h2 style="font-size: 16px; font-weight: 700; color: white; margin: 0;">
          Performance Summary
        </h2>
      </div>
      <div style="padding: 20px;">
        <div style="display: flex; flex-direction: column; gap: 20px;">
          
          ${
            hasCompliance
              ? `
          <div style="display: flex; align-items: center; gap: 30px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px;">
            <div style="flex-shrink: 0; text-align: center; min-width: 120px;">
              <div style="font-size: 11px; font-weight: 700; color: #1e3a8a; margin-bottom: 5px;">COMPLIANCE</div>
              ${generatePieChartSVG(yesPercentage, noPercentage, naPercentage, yesPercentage)}
            </div>
            <div style="flex: 1;">
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                <div style="text-align: center; padding: 10px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
                  <div style="font-size: 14px; font-weight: 800; color: #166534;">${totalYes}</div>
                  <div style="font-size: 10px; color: #166534; font-weight: 700;">Positive</div>
                  <div style="font-size: 12px; font-weight: 700; color: #166534;">${yesPercentage.toFixed(1)}%</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #fef2f2; border-radius: 6px; border: 1px solid #fecaca;">
                  <div style="font-size: 14px; font-weight: 800; color: #991b1b;">${totalNo}</div>
                  <div style="font-size: 10px; color: #991b1b; font-weight: 700;">Issues</div>
                  <div style="font-size: 12px; font-weight: 700; color: #991b1b;">${noPercentage.toFixed(1)}%</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                  <div style="font-size: 14px; font-weight: 800; color: #475569;">${totalNA}</div>
                  <div style="font-size: 10px; color: #475569; font-weight: 700;">N/A</div>
                  <div style="font-size: 12px; font-weight: 700; color: #475569;">${naPercentage.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>
          `
              : ""
          }

          ${
            hasAccuracy
              ? `
          <div style="display: flex; align-items: center; gap: 30px;">
            <div style="flex-shrink: 0; text-align: center; min-width: 120px;">
              <div style="font-size: 11px; font-weight: 700; color: #1e3a8a; margin-bottom: 5px;">ACCURACY</div>
              ${generatePieChartSVG(correctPercentage, wrongPercentage, 0, correctPercentage)}
            </div>
            <div style="flex: 1;">
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                <div style="text-align: center; padding: 10px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
                  <div style="font-size: 14px; font-weight: 800; color: #166534;">${totalCorrect}</div>
                  <div style="font-size: 10px; color: #166534; font-weight: 700;">Correct</div>
                  <div style="font-size: 12px; font-weight: 700; color: #166534;">${correctPercentage.toFixed(1)}%</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #fef2f2; border-radius: 6px; border: 1px solid #fecaca;">
                  <div style="font-size: 14px; font-weight: 800; color: #991b1b;">${totalWrong}</div>
                  <div style="font-size: 10px; color: #991b1b; font-weight: 700;">Wrong</div>
                  <div style="font-size: 12px; font-weight: 700; color: #991b1b;">${wrongPercentage.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>
          `
              : ""
          }

          <div style="margin-top: 1px; padding-top: 10px; border-top: 1.5px solid #e5e7eb; text-align: center; font-size: 13px; font-weight: 700; color: #374151;">
            Total Parameters Evaluated: <span style="color: #1e3a8a; font-weight: 900; margin-left: 6px;">${grandTotal}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
function generateSectionTables(
  availableSections: any[],
  sectionQuestionStats: Record<string, any[]>,
  sectionMainParameters: Record<string, any[]>,
  sectionChartImages: Record<string, string> = {},
  form?: any,
  response?: any,
): string {
  console.log("🔍 generateSectionTables called with:", {
    availableSectionsCount: availableSections.length,
    sectionQuestionStats: Object.keys(sectionQuestionStats),
    sectionMainParameters: Object.keys(sectionMainParameters),
    hasForm: !!form,
    hasResponse: !!response,
  });

  return availableSections
    .map((section: any, index: number) => {
      const questionStats = sectionQuestionStats[section.id] || [];
      const mainParams = sectionMainParameters[section.id] || [];
      const chartImage = sectionChartImages[section.id];

      console.log(`🔍 Section ${section.id}:`, {
        sectionName: section.name || section.label || section.title,
        questionStatsCount: questionStats.length,
        mainParamsCount: mainParams.length,
        hasChartImage: !!chartImage,
      });

      // FIX: Check if we have any data to show
      const hasQuestionStats = questionStats.length > 0;
      const hasMainParams = mainParams.length > 0;

      if (!hasQuestionStats && !hasMainParams) {
        console.log(`❌ Skipping section ${section.id} - no data`);
        return "";
      }

      const sectionTotals = hasQuestionStats
        ? questionStats.reduce(
            (totals: any, stat: any) => ({
              yes: totals.yes + (stat.yes || 0),
              no: totals.no + (stat.no || 0),
              na: totals.na + (stat.na || 0),
              correct: totals.correct + (stat.correct || 0),
              wrong: totals.wrong + (stat.wrong || 0),
              total: totals.total + (stat.total || 0),
            }),
            { yes: 0, no: 0, na: 0, total: 0, correct: 0, wrong: 0 },
          )
        : { yes: 0, no: 0, na: 0, total: 0, correct: 0, wrong: 0 };

      // Helper function to extract actual values from response
      const extractParameterData = (section: any) => {
        const parameterData: any[] = [];
        const sectionQuestions = section.questions || [];

        let currentParam: any = null;

        sectionQuestions.forEach((question: any) => {
          const answer = response.answers?.[question.id];
          const questionText = question.text || "";

          console.log(
            `🔍 Processing question: "${questionText}" → Answer: "${answer}"`,
          );

          // Check if this is a main parameter question (not a follow-up)
          if (
            !questionText.includes("Remarks") &&
            !questionText.includes("Action Inititated") &&
            !questionText.includes("Reason fo Not OK") &&
            !questionText.includes("Responsible person") &&
            !questionText.includes("Review") &&
            !questionText.includes("Photograph")
          ) {
            // This is a main question - save previous and start new
            if (currentParam) {
              parameterData.push(currentParam);
            }

            // USE EXACTLY WHAT DASHBOARD USES: question.subParam1 || "No parameter set"
            currentParam = {
              subParam1: question.subParam1 || "No parameter set", // EXACT SAME AS DASHBOARD
              remarks: "",
              actionInitiated: "",
              reasonForNotOK: "",
              responsiblePerson: "",
              review: "",
              files: [],
            };

            console.log(
              `✅ Started new parameter: "${
                question.subParam1 || "No parameter set"
              }"`,
            );
          }

          // If we have a current parameter, assign values based on question type
          if (currentParam) {
            if (questionText.includes("Remarks")) {
              currentParam.remarks = answer || "";
              console.log(`📝 Set remarks: "${answer}"`);
            } else if (questionText.includes("Action Inititated")) {
              currentParam.actionInitiated = answer || "";
              console.log(`🎯 Set actionInitiated: "${answer}"`);
            } else if (questionText.includes("Reason fo Not OK")) {
              currentParam.reasonForNotOK = answer || "";
              console.log(`❓ Set reasonForNotOK: "${answer}"`);
            } else if (questionText.includes("Responsible person")) {
              currentParam.responsiblePerson = answer || "";
              console.log(`👤 Set responsiblePerson: "${answer}"`);
            } else if (questionText.includes("Review")) {
              currentParam.review = answer || "";
              console.log(`📋 Set review: "${answer}"`);
            } else if (questionText.includes("Photograph") && answer) {
              if (!currentParam.files) currentParam.files = [];
              currentParam.files.push(answer);
              console.log(`🖼️ Added file: "${answer}"`);
            }
          }
        });

        // Don't forget the last parameter
        if (currentParam) {
          parameterData.push(currentParam);
        }

        console.log(` Final extracted parameters:`, parameterData);
        return parameterData.length > 0 ? parameterData : mainParams;
      };

      // Use extracted data instead of the provided mainParams if available
      const actualParameterData = extractParameterData(section);

      console.log(`📊 Section ${section.id} will show:`, {
        questionStats: questionStats.length,
        parameters: actualParameterData.length,
        hasQuestionStats,
        hasMainParams: actualParameterData.length > 0,
      });

      let html = "";

      // Response Analysis Section - Show if we have question stats
      if (hasQuestionStats) {
        const complianceStats = questionStats.filter((q) => q.hasYesNo);
        const accuracyStats = questionStats.filter((q) => q.isQuiz);

        const hasCompliance = complianceStats.length > 0;
        const hasAccuracy = accuracyStats.length > 0;

        html += `<div class="pdf-section ${
          index > 0 ? "page-break-before" : ""
        }" style="margin-bottom: 40px;">`;

        const sectionDisplayName =
          section.name ||
          section.label ||
          section.title ||
          `Section ${index + 1}`;

        html += `
          <div style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px solid #1e3a8a;"> 
            ${sectionDisplayName} - Response Analysis
          </div>
        `;

        // Chart Container
        html += `
          <div style="margin-bottom: 30px; text-align: center;">
            ${
              chartImage
                ? `
              <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block; width: 100%; max-width: 500px;">
                <div style="font-size: 14px; font-weight: 600; color: #1e3a8a; margin-bottom: 10px;">
                  Response Distribution
                </div>
                <img src="${chartImage}" style="width: 100%; height: auto; max-height: 250px; object-fit: contain;" alt="Response Distribution Chart" />
              </div>
            `
                : ""
            }
          </div>
        `;

        // Compliance Table
        if (hasCompliance) {
          html += `
            <div style="margin-bottom: 25px;">
              <div style="background: #eff6ff; padding: 8px 12px; border-radius: 6px 6px 0 0; border: 1px solid #bfdbfe; border-bottom: none;">
                <h4 style="font-size: 13px; font-weight: 700; color: #1e40af; margin: 0;">Compliance Analysis (Yes/No/NA)</h4>
              </div>
              <table class="section-table" style="width: 100%; border-collapse: collapse; border: 1px solid #bfdbfe; font-size: 10px;">
                <thead>
                  <tr style="background: #1e40af;">
                    <th style="padding: 8px; text-align: left; color: white; border: 1px solid #bfdbfe; width: 40%;">Parameter</th>
                    <th style="padding: 8px; text-align: center; color: white; border: 1px solid #bfdbfe; width: 20%;">Yes</th>
                    <th style="padding: 8px; text-align: center; color: white; border: 1px solid #bfdbfe; width: 20%;">No</th>
                    <th style="padding: 8px; text-align: center; color: white; border: 1px solid #bfdbfe; width: 20%;">N/A</th>
                  </tr>
                </thead>
                <tbody>
                  ${complianceStats
                    .map((stat, i) => {
                      const total =
                        (stat.yes || 0) + (stat.no || 0) + (stat.na || 0);
                      const yesPct =
                        total > 0
                          ? ((stat.yes / total) * 100).toFixed(1)
                          : "0.0";
                      const noPct =
                        total > 0
                          ? ((stat.no / total) * 100).toFixed(1)
                          : "0.0";
                      const naPct =
                        total > 0
                          ? ((stat.na / total) * 100).toFixed(1)
                          : "0.0";
                      const rowBg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
                      return `
                      <tr style="background: ${rowBg};">
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 600;">${stat.subParam1 || stat.title}</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">
                          <div style="font-weight: 700; color: #1e40af;">${stat.yes}</div>
                          <div style="font-size: 8px; color: #64748b;">${yesPct}%</div>
                        </td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">
                          <div style="font-weight: 700; color: #1e40af;">${stat.no}</div>
                          <div style="font-size: 8px; color: #64748b;">${noPct}%</div>
                        </td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">
                          <div style="font-weight: 700; color: #64748b;">${stat.na}</div>
                          <div style="font-size: 8px; color: #64748b;">${naPct}%</div>
                        </td>
                      </tr>
                    `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
          `;
        }

        // Accuracy Table
        if (hasAccuracy) {
          html += `
            <div style="margin-bottom: 25px;">
              <div style="background: #f0fdf4; padding: 8px 12px; border-radius: 6px 6px 0 0; border: 1px solid #bbf7d0; border-bottom: none;">
                <h4 style="font-size: 13px; font-weight: 700; color: #166534; margin: 0;">Accuracy Analysis (Correct/Wrong)</h4>
              </div>
              <table class="section-table" style="width: 100%; border-collapse: collapse; border: 1px solid #bbf7d0; font-size: 10px;">
                <thead>
                  <tr style="background: #166534;">
                    <th style="padding: 8px; text-align: left; color: white; border: 1px solid #bbf7d0; width: 40%;">Parameter</th>
                    <th style="padding: 8px; text-align: center; color: white; border: 1px solid #bbf7d0; width: 30%;">Correct</th>
                    <th style="padding: 8px; text-align: center; color: white; border: 1px solid #bbf7d0; width: 30%;">Wrong</th>
                  </tr>
                </thead>
                <tbody>
                  ${accuracyStats
                    .map((stat, i) => {
                      const total = (stat.correct || 0) + (stat.wrong || 0);
                      const correctPct =
                        total > 0
                          ? ((stat.correct / total) * 100).toFixed(1)
                          : "0.0";
                      const wrongPct =
                        total > 0
                          ? ((stat.wrong / total) * 100).toFixed(1)
                          : "0.0";
                      const rowBg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
                      return `
                      <tr style="background: ${rowBg};">
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 600;">${stat.subParam1 || stat.title}</td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">
                          <div style="font-weight: 700; color: #166534;">${stat.correct}</div>
                          <div style="font-size: 8px; color: #64748b;">${correctPct}%</div>
                        </td>
                        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">
                          <div style="font-weight: 700; color: #991b1b;">${stat.wrong}</div>
                          <div style="font-size: 8px; color: #64748b;">${wrongPct}%</div>
                        </td>
                      </tr>
                    `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
          `;
        }

        html += `</div>`; // Close pdf-section
      }

      // Parameters & Actions Section - Show if we have parameter data
      if (actualParameterData.length > 0) {
        // Pagination for Parameters & Actions table
        const rowsPerPage = 7; // You can adjust this number if needed, or remove the limit entirely
        const parameterChunks = [];

        // Split parameters into chunks if you want pagination, otherwise use single chunk
        for (let i = 0; i < actualParameterData.length; i += rowsPerPage) {
          parameterChunks.push(actualParameterData.slice(i, i + rowsPerPage));
        }

        // Generate table for each chunk
        parameterChunks.forEach((chunk, chunkIndex) => {
          // For first chunk, create the main section
          if (chunkIndex === 0) {
            html += `<div class="pdf-section page-break-before" style="margin-bottom: 40px;">`;

            const sectionDisplayName =
              section.name ||
              section.label ||
              section.title ||
              `Section ${index + 1}`;

            html += `
        <div style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px solid #1e3a8a;">
          ${sectionDisplayName} - Parameters & Actions
        </div>
        <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">
          Comprehensive analysis of parameters with corresponding actions and responsibilities &  Page ${
            chunkIndex + 1
          } of ${parameterChunks.length}
        </p>
      `;
          }
          // For subsequent chunks, create new page with continuation header
          else {
            html += `
        </div> <!-- Close previous pdf-section -->
        <div class="pdf-section page-break-before" style="margin-bottom: 40px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px;">
              ${
                section.name ||
                section.label ||
                section.title ||
                `Section ${index + 1}`
              } - Parameters & Actions (Continued)
            </div>
            <p style="font-size: 12px; color: #64748b;">
              Page ${chunkIndex + 1} of ${parameterChunks.length}
            </p>
          </div>
      `;
          }

          html += `
      <!-- FIXED: Added proper table classes for page break handling -->
      <table class="section-table parameters-table" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; border: 1px solid #e2e8f0;">
        <thead>
          <tr class="table-header" style="background: #1e3a8a;">
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: white; border: none; letter-spacing: 0.5px; width: 20%;">
              Main Parameters
            </th>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: white; border: none; letter-spacing: 0.5px; width: 15%;">
              Remarks
            </th>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: white; border: none; letter-spacing: 0.5px; width: 15%;">
              Action Initiated
            </th>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: white; border: none; letter-spacing: 0.5px; width: 15%;">
              Reason for Not OK
            </th>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: white; border: none; letter-spacing: 0.5px; width: 15%;">
              Responsible Person
            </th>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: white; border: none; letter-spacing: 0.5px; width: 10%;">
              Review
            </th>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: white; border: none; letter-spacing: 0.5px; width: 10%;">
              Photograph
            </th>
          </tr>
        </thead>
        <tbody>
          ${chunk
            .map((param: any, localIndex: number) => {
              const globalIndex = chunkIndex * rowsPerPage + localIndex;
              const isMainParam =
                !param.subParam1?.toLowerCase().includes("follow-up") &&
                !param.subParam1?.toLowerCase().includes("followup") &&
                !param.subParam1?.toLowerCase().includes("sub-parameter");

              const rowBgColor = isMainParam
                ? globalIndex % 2 === 0
                  ? "#ffffff"
                  : "#f8fafc"
                : globalIndex % 2 === 0
                  ? "#f0f9ff"
                  : "#e0f2fe";

              const paramColor = isMainParam ? "#1e293b" : "#0369a1";
              const fontWeight = isMainParam ? "600" : "500";
              const borderLeft = isMainParam ? "none" : "3px solid #0ea5e9";

              // Helper function to display actual values or "Not provided"
              const displayValue = (
                value: any,
                defaultValue: string = "Not provided",
              ) => {
                if (value === null || value === undefined || value === "") {
                  return `<span style="color: #9ca3af; font-style: italic;">${defaultValue}</span>`;
                }
                // Truncate very long values to prevent overflow
                const strValue = String(value);
                return strValue.length > 100
                  ? strValue.substring(0, 100) + "..."
                  : strValue;
              };

              // FIXED: Added proper table cell classes
              return `<tr class="table-row" style="page-break-after:avoid;">
                  <td class="table-cell" style="padding: 10px; font-size: 11px; color: ${paramColor}; font-weight: ${fontWeight}; border-left: ${borderLeft}; background-color: ${rowBgColor};">
                    <div style="display: flex; align-items: center; gap: 4px;">
                      <span>${param.subParam1 || "No parameter"}</span>
                      ${
                        !isMainParam
                          ? '<span style="font-size: 9px; color: #0ea5e9; background: #f0f9ff; padding: 1px 4px; border-radius: 3px; border: 1px solid #bae6fd; font-weight: 500;">Follow-up</span>'
                          : ""
                      }
                    </div>
                  </td>
                  <td class="table-cell" style="padding: 10px; font-size: 11px; color: #374151; background-color: ${rowBgColor};">
                    ${displayValue(param.remarks, "Not provided")}
                  </td> 
                  <td class="table-cell" style="padding: 10px; font-size: 11px; color: #374151; background-color: ${rowBgColor};">
                    ${displayValue(param.actionInitiated, "Not provided")}
                  </td>
                  <td class="table-cell" style="padding: 10px; font-size: 11px; color: #374151; background-color: ${rowBgColor};">
                    ${displayValue(param.reasonForNotOK, "Not applicable")}
                  </td>
                  <td class="table-cell" style="padding: 10px; font-size: 11px; color: #374151; background-color: ${rowBgColor};">
                    ${displayValue(param.responsiblePerson, "Not assigned")}
                  </td>
                  <td class="table-cell" style="padding: 10px; font-size: 11px; color: #374151; background-color: ${rowBgColor};">
                    ${displayValue(param.review, "Pending")}
                  </td>
                  <td class="table-cell" style="padding: 10px; font-size: 11px; color: #374151; text-align: center; background-color: ${rowBgColor};">
                    ${
                      param.files && param.files.length > 0
                        ? `<span style="color: #059669; font-weight: 600;">${param.files.length} file(s)</span>`
                        : '<span style="color: #6b7280; font-style: italic;">No files</span>'
                    }
                  </td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    `;

          // Close the current pdf-section
          html += `</div>`;
        });
      }

      console.log(
        ` Generated HTML for section ${section.id}: ${html.length} characters`,
      );
      return html;
    })
    .join("");
}

interface PDFOptions {
  filename: string;
  formTitle: string;
  submittedDate: string;
  sectionStats: Array<{
    id: string;
    title: string;
    yes: number;
    no: number;
    na: number;
    correct: number;
    wrong: number;
    total: number;
    weightage: number;
  }>;
  sectionSummaryRows?: Array<{
    id: string;
    title: string;
    total: number;
    yes: number;
    no: number;
    na: number;
    correct: number;
    wrong: number;
    weightage: number;
    yesPercent: number;
    yesWeighted: number;
    noPercent: number;
    noWeighted: number;
    naPercent: number;
    naWeighted: number;
    correctPercent: number;
    wrongPercent: number;
    hasYesNo?: boolean;
    hasQuiz?: boolean;
  }>;
  sectionQuestionStats?: Record<string, Array<any>>;
  sectionMainParameters?: Record<string, Array<any>>;
  availableSections?: Array<any>;
  form?: any;
  response?: any;
  chartElementIds?: string[];
}
async function getLogoAsBase64(): Promise<string> {
  // Try multiple possible paths
  const possiblePaths = [
    "/assets/logo.png",
    "./assets/logo.png",
    "assets/logo.png",
    "/Logo.png",
    "./Logo.png",
    "Logo.png",
    "/images/Logo.png",
    "./images/Logo.png",
    "images/Logo.png",
    "/img/Logo.png",
    "./img/Logo.png",
    "img/Logo.png",
  ];

  for (const logoPath of possiblePaths) {
    try {
      console.log(`🔄 Trying to load logo from: ${logoPath}`);
      const response = await fetch(logoPath);

      if (response.ok) {
        console.log(`✅ SUCCESS: Found logo at ${logoPath}`);
        const blob = await response.blob();

        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            console.log(
              `📸 Logo loaded successfully, base64 length: ${base64.length}`,
            );
            resolve(base64);
          };
          reader.readAsDataURL(blob);
        });
      } else {
        console.log(`❌ Failed to load from ${logoPath}: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Error loading from ${logoPath}:`, error);
    }
  }

  console.warn("⚠️ No custom logo found, falling back to default logo");
  try {
    const defaultLogoPath = "/logoimages/logo.jpeg";
    const response = await fetch(defaultLogoPath);
    
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          console.log(
            `📸 Default logo loaded successfully, base64 length: ${base64.length}`,
          );
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });
    }
  } catch (error) {
    console.log(`❌ Error loading default logo:`, error);
  }

  return "";
}
// Add this function (generateTableBarChart)
function generateTableBarChart(
  yesPercent: number,
  noPercent: number,
  naPercent: number,
): string {
  const totalWidth = 200;
  const yesWidth = (yesPercent / 100) * totalWidth;
  const noWidth = (noPercent / 100) * totalWidth;
  const naWidth = (naPercent / 100) * totalWidth;

  return `
    <div style="position: relative; width: ${totalWidth}px; height: 20px; background: #f1f5f9; border-radius: 3px; overflow: hidden; border: 1px solid #e2e8f0;">
      ${
        yesPercent > 0
          ? `
        <div style="position: absolute; left: 0; width: ${yesWidth}px; height: 100%; background: #10b981; display: flex; align-items: center; justify-content: center;">
          ${
            yesPercent >= 15
              ? `<span style="color: white; font-size: 8px; font-weight: bold; text-shadow: 0 0 2px rgba(0,0,0,0.5);">${yesPercent.toFixed(
                  0,
                )}%</span>`
              : ""
          }
        </div>
      `
          : ""
      }
      ${
        noPercent > 0
          ? `
        <div style="position: absolute; left: ${yesWidth}px; width: ${noWidth}px; height: 100%; background: #ef4444; display: flex; align-items: center; justify-content: center;">
          ${
            noPercent >= 15
              ? `<span style="color: white; font-size: 8px; font-weight: bold; text-shadow: 0 0 2px rgba(0,0,0,0.5);">${noPercent.toFixed(
                  0,
                )}%</span>`
              : ""
          }
        </div>
      `
          : ""
      }
      ${
        naPercent > 0
          ? `
        <div style="position: absolute; left: ${
          yesWidth + noWidth
        }px; width: ${naWidth}px; height: 100%; background: #9ca3af; display: flex; align-items: center; justify-content: center;">
          ${
            naPercent >= 15
              ? `<span style="color: white; font-size: 8px; font-weight: bold; text-shadow: 0 0 2px rgba(0,0,0,0.5);">${naPercent.toFixed(
                  0,
                )}%</span>`
              : ""
          }
        </div>
      `
          : ""
      }
      
      <!-- Fallback labels for small segments -->
      ${
        yesPercent > 0 && yesPercent < 15
          ? `
        <div style="position: absolute; left: 2px; top: 1px;">
          <span style="color: #059669; font-size: 7px; font-weight: bold; background: rgba(255,255,255,0.8); padding: 1px 2px; border-radius: 1px;">${yesPercent.toFixed(
            0,
          )}%</span>
        </div>
      `
          : ""
      }
      ${
        noPercent > 0 && noPercent < 15
          ? `
        <div style="position: absolute; left: ${yesWidth + 2}px; top: 1px;">
          <span style="color: #dc2626; font-size: 7px; font-weight: bold; background: rgba(255,255,255,0.8); padding: 1px 2px; border-radius: 1px;">${noPercent.toFixed(
            0,
          )}%</span>
        </div>
      `
          : ""
      }
      ${
        naPercent > 0 && naPercent < 15
          ? `
        <div style="position: absolute; left: ${
          yesWidth + noWidth + 2
        }px; top: 1px;">
          <span style="color: #6b7280; font-size: 7px; font-weight: bold; background: rgba(255,255,255,0.8); padding: 1px 2px; border-radius: 1px;">${naPercent.toFixed(
            0,
          )}%</span>
        </div>
      `
          : ""
      }
    </div>
  `;
}

// Add these helper functions (they should already exist somewhere in your code)
function getTypeColor(type: string): string {
  switch (type) {
    case "no-only":
      return "#dc2626";
    case "yes-only":
      return "#059669";
    case "na-only":
      return "#f59e0b";
    case "both":
      return "#1e3a8a";
    case "section":
      return "#7c3aed";
    case "responses-view":
      return "#0891b2";
    default:
      return "#1e3a8a";
  }
}

function getPDFTypeDisplayName(type: string): string {
  switch (type) {
    case "no-only":
      return "NO Response Analysis Only";
    case "yes-only":
      return "YES Response Analysis Only";
    case "na-only":
      return "N/A Response Analysis Only";
    case "both":
      return "BOTH NO, YES & N/A Response Analysis";
    case "section":
      return "Section-wise Analysis Only";
    case "responses-view":
      return "Form Responses Detail";
    default:
      return "Standard Report";
  }
}

function getExclusionNote(type: string): string {
  switch (type) {
    case "no-only":
      return "YES, N/A analysis and Section tables excluded in this NO-only report";
    case "yes-only":
      return "NO, N/A analysis and Section tables excluded in this YES-only report";
    case "na-only":
      return "NO, YES analysis and Section tables excluded in this N/A-only report";
    case "section":
      return "Individual response analysis tables (NO, YES, N/A) excluded in this section-only report";
    case "responses-view":
      return "Score analysis and detailed section tables excluded in this responses detail report";
    default:
      return "";
  }
}

function getPDFTypeSuffix(type: string): string {
  switch (type) {
    case "no-only":
      return "NO_Analysis_Only";
    case "yes-only":
      return "YES_Analysis_Only";
    case "na-only":
      return "NA_Analysis_Only";
    case "both":
      return "BOTH_Complete";
    case "section":
      return "Section_Only";
    case "responses-view":
      return "Responses_Detail";
    default:
      return "Standard";
  }
}
export async function generateAndDownloadPDF(
  options: PDFOptions,
  type?:
    | "no-only"
    | "yes-only"
    | "both"
    | "na-only"
    | "section"
    | "default"
    | "responses-view",
  onProgress?: ProgressCallback, // Add this parameter
): Promise<void> {
  const pdfType = type || "default";

  try {
    // Track initial progress
    if (onProgress) {
      onProgress({
        stage: "uploading",
        percentage: 0,
        message: "Preparing PDF data...",
      });
    }

    // Try server-side first
    const pdfBlob = await generatePDFOnServer(options, pdfType, onProgress);

    // Download the blob
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${options.filename}_${getPDFTypeSuffix(pdfType)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to generate PDF:", error);

    if (onProgress) {
      onProgress({
        stage: "complete",
        percentage: 0,
        message: `Error: ${error.message}`,
      });
    }

    // If server fails, show user-friendly message
    if (error.message?.includes("too large")) {
      alert(
        "Document is too large for server processing. Please try exporting smaller reports or contact support.",
      );
    } else {
      alert(
        `PDF generation failed: ${error.message}. Please try again or contact support.`,
      );
    }

    throw error;
  }
}

// Update these convenience functions
export async function generateNoOnlyPDF(
  options: Omit<PDFOptions, "type">,
  onProgress?: ProgressCallback,
): Promise<void> {
  return generateAndDownloadPDF(
    { ...options, type: "no-only" },
    "no-only",
    onProgress,
  );
}

export async function generateYesOnlyPDF(
  options: Omit<PDFOptions, "type">,
  onProgress?: ProgressCallback,
): Promise<void> {
  return generateAndDownloadPDF(
    { ...options, type: "yes-only" },
    "yes-only",
    onProgress,
  );
}

export async function generateNAOnlyPDF(
  options: Omit<PDFOptions, "type">,
  onProgress?: ProgressCallback,
): Promise<void> {
  return generateAndDownloadPDF(
    { ...options, type: "na-only" },
    "na-only",
    onProgress,
  );
}

export async function generateBothPDF(
  options: Omit<PDFOptions, "type">,
  onProgress?: ProgressCallback,
): Promise<void> {
  return generateAndDownloadPDF(
    { ...options, type: "both" },
    "both",
    onProgress,
  );
}

export async function generateSectionOnlyPDF(
  options: Omit<PDFOptions, "type">,
  onProgress?: ProgressCallback,
): Promise<void> {
  return generateAndDownloadPDF(
    { ...options, type: "section" },
    "section",
    onProgress,
  );
}

export async function generateFullPDF(
  options: Omit<PDFOptions, "type">,
  onProgress?: ProgressCallback,
): Promise<void> {
  return generateAndDownloadPDF(
    { ...options, type: "default" },
    "default",
    onProgress,
  );
}

// Server-side PDF generation function

// Add progress callback type
export type ProgressCallback = (progress: {
  stage: "uploading" | "generating" | "downloading" | "complete";
  percentage: number;
  message?: string;
}) => void;

export async function generatePDFOnServer(
  options: PDFOptions,
  type: string = "default",
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const htmlContent = await generateCompleteHTMLForServer(options, type);

  // Progress tracking with continuous interpolation
  let targetPercentage = 0;
  let currentPercentage = 0;
  let currentStage: "uploading" | "generating" | "downloading" | "complete" =
    "uploading";
  let currentMessage = "Starting...";
  let interpolationId: number | null = null;

  const startInterpolation = () => {
    if (interpolationId) {
      clearInterval(interpolationId);
      interpolationId = null;
    }

    // Only animate if we're not at target and not complete
    if (currentStage !== "complete" && currentPercentage < 100) {
      interpolationId = window.setInterval(() => {
        // Calculate increment based on distance to target
        const diff = targetPercentage - currentPercentage;
        let increment = 0.5; // Default slow increment

        if (diff > 0) {
          // When we have a target, move toward it
          if (diff > 20) increment = 2;
          else if (diff > 10) increment = 1.5;
          else if (diff > 5) increment = 1;
          else increment = 0.5;

          currentPercentage = Math.min(
            currentPercentage + increment,
            targetPercentage,
          );
        } else {
          // If we've reached target but not at 100, continue slowly
          // This prevents getting stuck
          increment = 0.2;
          currentPercentage = Math.min(currentPercentage + increment, 99); // Cap at 99 until complete

          // If we're stuck at target for too long, slowly increase target
          if (currentPercentage >= targetPercentage - 1) {
            targetPercentage = Math.min(targetPercentage + 5, 99);
          }
        }

        if (onProgress) {
          onProgress({
            stage: currentStage,
            percentage: Math.round(currentPercentage),
            message: currentMessage,
          });
        }

        // Don't stop interpolation until we're complete
        // Keep it running continuously
        if (currentPercentage >= 100) {
          if (interpolationId) {
            clearInterval(interpolationId);
            interpolationId = null;
          }
        }
      }, 50); // Update every 50ms
    }
  };

  const updateProgress = (
    stage: "uploading" | "generating" | "downloading" | "complete",
    percentage: number,
    message?: string,
  ) => {
    if (!onProgress) return;

    // Update state
    if (stage !== "complete") {
      currentStage = stage;
    }

    if (percentage > targetPercentage) {
      targetPercentage = percentage;
    }

    if (message) currentMessage = message;

    // If complete, handle specially
    if (stage === "complete") {
      if (interpolationId) {
        clearInterval(interpolationId);
        interpolationId = null;
      }
      targetPercentage = 100;
      currentPercentage = 100;
      onProgress({ stage, percentage: 100, message });
      return;
    }

    // Update immediately if we're close
    if (Math.abs(currentPercentage - percentage) < 2) {
      currentPercentage = percentage;
      onProgress({ stage, percentage, message });
    }

    // Always ensure interpolation is running
    if (!interpolationId) {
      startInterpolation();
    }
  };

  // Start interpolation immediately
  startInterpolation();

  // Initial progress
  updateProgress("uploading", 5, "Initializing...");

  try {
    // Stage 1: Uploading (0-30%)
    await new Promise((resolve) => setTimeout(resolve, 200));
    updateProgress("uploading", 10, "Preparing HTML content...");

    await new Promise((resolve) => setTimeout(resolve, 300));
    updateProgress("uploading", 20, "Processing content...");

    await new Promise((resolve) => setTimeout(resolve, 300));
    updateProgress("uploading", 30, "Sending to server...");

    // Stage 2: Generating (30-70%)
    updateProgress("generating", 35, "Server processing started...");

    // Keep progress moving during server processing
    const generatingInterval = window.setInterval(() => {
      if (currentStage === "generating" && currentPercentage < 70) {
        // Slowly increase target during generation phase
        targetPercentage = Math.min(targetPercentage + 2, 70);
      }
    }, 800);

    // Also update with specific messages
    const generatingMessages = [
      { delay: 400, percent: 40, message: "Processing pages..." },
      { delay: 800, percent: 45, message: "Building layout..." },
      { delay: 1200, percent: 50, message: "Rendering content..." },
      { delay: 1600, percent: 55, message: "Optimizing PDF..." },
      { delay: 2000, percent: 60, message: "Finalizing generation..." },
    ];

    generatingMessages.forEach((update) => {
      setTimeout(() => {
        if (currentStage === "generating") {
          updateProgress("generating", update.percent, update.message);
        }
      }, update.delay);
    });

    // Call the API - this returns a Blob directly
    updateProgress("generating", 65, "Generating PDF...");

    const blob = await apiClient.generatePDF({
      htmlContent: htmlContent,
      filename: `${options.filename}_${getPDFTypeSuffix(type)}.pdf`,
      format: "custom",
      compressed: true,
    });

    // Clear generation interval
    clearInterval(generatingInterval);

    // Stage 3: Downloading (70-100%)
    // Since we already have the blob, simulate download progress
    updateProgress("downloading", 70, "Processing PDF...");
    await new Promise((resolve) => setTimeout(resolve, 300));
    updateProgress("downloading", 85, "Finalizing...");
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Ensure we reach 100%
    updateProgress("complete", 100, "PDF ready!");

    // Final cleanup
    if (interpolationId) {
      clearInterval(interpolationId);
      interpolationId = null;
    }

    return blob;
  } catch (error) {
    // Clean up on error
    if (interpolationId) {
      clearInterval(interpolationId);
      interpolationId = null;
    }

    console.error("❌ Server PDF generation failed:", error);
    throw error;
  }
}

// Helper function to convert image URL to base64
async function imageUrlToBase64(url: string): Promise<string> {
  if (!url || !isImageUrl(url) || url.startsWith("data:")) return url;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn(`Failed to convert image to base64: ${url}`, error);
    return url;
  }
}

// Recursively process an object to convert all image URLs to base64
async function processObjectImages(obj: any): Promise<any> {
  if (!obj) return obj;

  if (typeof obj === "string") {
    if (isImageUrl(obj)) {
      return await imageUrlToBase64(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return await Promise.all(obj.map((item) => processObjectImages(item)));
  }

  if (typeof obj === "object") {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = await processObjectImages(obj[key]);
      }
    }
    return newObj;
  }

  return obj;
}

// ✅ NEW: Fetch only image URLs to base64, skip all other answers
async function convertImageAnswersToBase64(
  answers: Record<string, any>,
): Promise<Record<string, any>> {
  // Step 1: Collect all unique image URLs from answers
  const imageUrlMap = new Map<string, string>(); // url → base64

  const collectImageUrls = (val: any): string[] => {
    if (!val) return [];
    if (
      typeof val === "string" &&
      isImageUrl(val) &&
      !val.startsWith("data:")
    ) {
      return [val];
    }
    if (Array.isArray(val)) return val.flatMap(collectImageUrls);
    if (typeof val === "object")
      return Object.values(val).flatMap(collectImageUrls);
    return [];
  };

  const allImageUrls = [
    ...new Set(Object.values(answers).flatMap(collectImageUrls)),
  ];

  console.log(`🖼️ Found ${allImageUrls.length} unique images to convert`);

  if (allImageUrls.length === 0) return answers;

  // Step 2: Fetch images in parallel (max 5 at a time to avoid overload)
  const BATCH_SIZE = 5;
  for (let i = 0; i < allImageUrls.length; i += BATCH_SIZE) {
    const batch = allImageUrls.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (url) => {
        try {
          const response = await fetch(url, { credentials: "include" }); // ✅ includes auth cookies
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          imageUrlMap.set(url, base64);
          console.log(`✅ Converted: ${url.substring(0, 60)}...`);
        } catch (err) {
          console.warn(`⚠️ Failed to convert image: ${url}`, err);
          imageUrlMap.set(url, url); // fallback: keep original URL
        }
      }),
    );

    console.log(
      `📸 Image batch ${Math.floor(i / BATCH_SIZE) + 1} done (${Math.min(i + BATCH_SIZE, allImageUrls.length)}/${allImageUrls.length})`,
    );
  }

  // Step 3: Replace all image URLs in answers with their base64 versions
  const replaceImageUrls = (val: any): any => {
    if (!val) return val;
    if (typeof val === "string") {
      return imageUrlMap.has(val) ? imageUrlMap.get(val)! : val;
    }
    if (Array.isArray(val)) return val.map(replaceImageUrls);
    if (typeof val === "object") {
      const result: any = {};
      for (const key of Object.keys(val)) {
        result[key] = replaceImageUrls(val[key]);
      }
      return result;
    }
    return val;
  };

  const processedAnswers: Record<string, any> = {};
  for (const [key, val] of Object.entries(answers)) {
    processedAnswers[key] = replaceImageUrls(val);
  }

  console.log(
    `✅ Image conversion complete: ${imageUrlMap.size} images converted`,
  );
  return processedAnswers;
}
// Helper function to generate complete HTML for server
async function generateCompleteHTMLForServer(
  options: PDFOptions,
  type: string = "default",
): Promise<string> {
  console.log("🔄 Generating complete HTML for server...");

  const {
    filename,
    formTitle,
    submittedDate,
    sectionStats = [],
    sectionQuestionStats = {},
    sectionMainParameters = {},
    availableSections = [],
    form,
    response: originalResponse,
  } = options;

  // Pre-process response to convert all image URLs to base64 for server-side PDF generation
  console.log("📸 Pre-processing images in response...");
  const processedAnswers = await convertImageAnswersToBase64(
    originalResponse?.answers || {},
  );

  const response = {
    ...originalResponse,
    answers: processedAnswers,
  };

  console.log("✅ Image pre-processing complete");

  // 1. Capture chart images
  const sectionChartImages: Record<string, string> = {};
  console.log("📊 Capturing chart images...");

  // Note: This requires html2canvas which only works in browser
  // For server-side, we'll use SVG charts instead
  for (const section of availableSections) {
    try {
      const chartId = `section-chart-${section.id}`;
      const chartElement = document.getElementById(chartId);
      if (chartElement) {
        const canvas = await html2canvas(chartElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
        });
        sectionChartImages[section.id] = canvas.toDataURL("image/png");
        console.log(`✅ Captured chart for section ${section.id}`);
      }
    } catch (error) {
      console.warn(
        `⚠️ Could not capture chart for section ${section.id}:`,
        error,
      );
    }
  }

  // 2. Get logo
  const logoBase64 = await getLogoAsBase64();
  console.log(`📸 Logo loaded: ${logoBase64 ? "Yes" : "No"}`);

  // 3. Calculate totals
  const totalYes = sectionStats.reduce((sum, stat) => sum + stat.yes, 0);
  const totalNo = sectionStats.reduce((sum, stat) => sum + stat.no, 0);
  const totalNA = sectionStats.reduce((sum, stat) => sum + stat.na, 0);
  const totalQuestions = sectionStats.reduce(
    (sum, stat) => sum + stat.total,
    0,
  );

  const yesPercentage =
    totalQuestions > 0 ? (totalYes / totalQuestions) * 100 : 0;
  const noPercentage =
    totalQuestions > 0 ? (totalNo / totalQuestions) * 100 : 0;
  const naPercentage =
    totalQuestions > 0 ? (totalNA / totalQuestions) * 100 : 0;
  const overallScore = yesPercentage;

  console.log(
    `📊 Calculated scores: Yes ${yesPercentage.toFixed(
      1,
    )}%, No ${noPercentage.toFixed(1)}%, NA ${naPercentage.toFixed(1)}%`,
  );

  // 4. Generate response analysis based on type
  let responseAnalysisHTML = "";

  console.log(`🔍 Generating response analysis for type: ${type}`);

  switch (type) {
    case "no-only":
      responseAnalysisHTML = generateNoResponseAnalysis(
        form,
        response,
        form?.sections || [],
        1000000,
      );
      break;
    case "yes-only":
      responseAnalysisHTML = generateYesResponseAnalysis(
        form,
        response,
        form?.sections || [],
        1000000,
      );
      break;
    case "na-only":
      responseAnalysisHTML = generateNAResponseAnalysis(
        form,
        response,
        form?.sections || [],
        1000000,
      );
      break;
    case "both":
      responseAnalysisHTML = generateBothResponseAnalysis(
        form,
        response,
        form?.sections || [],
        1000000,
      );
      break;
    case "section":
      responseAnalysisHTML = "";
      break;
    case "responses-view":
      responseAnalysisHTML = generateResponsesViewAnalysis(form, response);
      break;
    default:
      responseAnalysisHTML = generateNoResponseAnalysis(
        form,
        response,
        form?.sections || [],
        1000000,
      );
  }

  console.log(
    `📄 Response analysis generated: ${responseAnalysisHTML.length} chars`,
  );

  // 5. Generate other sections
  const firstSectionHTML = generateFirstSectionContent(form, response);
  const scoreSectionHTML = generateScoreSection(sectionStats);

  let sectionTablesHTML = "";
  if (type === "default" || type === "section") {
    sectionTablesHTML = generateSectionTables(
      availableSections,
      sectionQuestionStats,
      sectionMainParameters,
      sectionChartImages,
      form,
      response,
    );
  }

  console.log(`📋 Section tables generated: ${sectionTablesHTML.length} chars`);

  // 6. Generate section table for overview
  let tableHeaders = "";
  let tableRows = "";

  const hasWeightage = sectionStats.some((stat) => stat.weightage > 0);
  const hasAccuracyOverall = sectionStats.some(
    (stat) => stat.correct > 0 || stat.wrong > 0,
  );

  if (sectionStats.length > 0) {
    tableHeaders = `
      <th style="padding: 10px; text-align: left; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Section</th>
      <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Total</th>
      <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Yes</th>
      <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">No</th>
      <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">N/A</th>
      ${
        hasAccuracyOverall
          ? `
        <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Correct</th>
        <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Wrong</th>
      `
          : ""
      }
      ${
        hasWeightage
          ? `
        <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Weightage</th>
      `
          : ""
      }
      <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Visualization</th>
    `;

    tableRows = sectionStats
      .map((section, index) => {
        const totalCompliance =
          (section.yes || 0) + (section.no || 0) + (section.na || 0);
        const totalAccuracy = (section.correct || 0) + (section.wrong || 0);

        const yesPercent =
          totalCompliance > 0 ? (section.yes / totalCompliance) * 100 : 0;
        const noPercent =
          totalCompliance > 0 ? (section.no / totalCompliance) * 100 : 0;
        const naPercent =
          totalCompliance > 0 ? (section.na / totalCompliance) * 100 : 0;

        const correctPercent =
          totalAccuracy > 0 ? (section.correct / totalAccuracy) * 100 : 0;
        const wrongPercent =
          totalAccuracy > 0 ? (section.wrong / totalAccuracy) * 100 : 0;

        const rowBgColor = index % 2 === 0 ? "#ffffff" : "#f8fafc";

        return `
        <tr style="background-color: ${rowBgColor};">
          <td style="padding: 8px; font-size: 10px; font-weight: 600; color: #1e293b; border: 1px solid #e5e7eb;">
            <div style="font-weight: 700;">${section.title}</div>
          </td>
          <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
            <div style="font-weight: 700; color: #1e40af;">${section.total}</div>
          </td>
          <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
            <div style="font-weight: 700; color: #059669;">${section.yes}</div>
            <div style="font-size: 9px; color: #059669;">${yesPercent.toFixed(1)}%</div>
          </td>
          <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
            <div style="font-weight: 700; color: #dc2626;">${section.no}</div>
            <div style="font-size: 9px; color: #dc2626;">${noPercent.toFixed(1)}%</div>
          </td>
          <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
            <div style="font-weight: 700; color: #6b7280;">${section.na}</div>
            <div style="font-size: 9px; color: #6b7280;">${naPercent.toFixed(1)}%</div>
          </td>
          ${
            hasAccuracyOverall
              ? `
            <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
              <div style="font-weight: 700; color: #166534;">${section.correct || 0}</div>
              <div style="font-size: 9px; color: #166534;">${correctPercent.toFixed(1)}%</div>
            </td>
            <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
              <div style="font-weight: 700; color: #991b1b;">${section.wrong || 0}</div>
              <div style="font-size: 9px; color: #991b1b;">${wrongPercent.toFixed(1)}%</div>
            </td>
          `
              : ""
          }
          ${
            hasWeightage
              ? `
            <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
              <div style="font-weight: 700; color: #7c3aed;">${section.weightage}%</div>
            </td>
          `
              : ""
          }
          <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">
            ${generateTableBarChart(yesPercent, noPercent, naPercent)}
          </td>
        </tr>
      `;
      })
      .join("");
  }

  // 7. Create the complete HTML
  let completeHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${filename}</title>
  <style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: #ffffff;
    padding: 20px;
    color: #1f2937;
    line-height: 1.4;
    font-size: 12px;
  }
  
  .container {
    max-width: 100%;
    margin: 0 auto;
    background: white;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 3px solid #1e3a8a;
  }
  
  .header-content {
    flex: 1;
  }
  
  .header h1 {
    font-size: 20px;
    font-weight: 700;
    color: #1e3a8a;
    margin-bottom: 4px;
  }
  
  .header p {
    font-size: 11px;
    color: #64748b;
    margin: 0;
  }
  
  .logo-container {
    flex-shrink: 0;
    margin-left: 20px;
    text-align: right;
    min-width: 120px;
  }

  .logo-img {
    width: 150px;
    height: 50px;
    object-fit: contain;
  }
  .section-table {
  page-break-inside: auto;
  border-collapse: collapse;
}

.table-row {
  page-break-inside: avoid;
  page-break-after: auto;
}

.table-cell {
  page-break-inside: auto;
  page-break-before: auto;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.table-header {
  page-break-inside: avoid;
}

.parameters-table {
  table-layout: fixed;
  width: 100%;
}

.page-break-before {
  page-break-before: always;
}

  .table-title {
    font-size: 16px;
    font-weight: 700;
    color: #1e3a8a;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 2px solid #e5e7eb;
  }
  
  .performance-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #e5e7eb;
    font-size: 10px;
    /* FIX: Allow table to break naturally */
    page-break-inside: auto;
  }
  
  /* FIXED: Better table row handling for page breaks */
  .performance-table tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  
  /* FIXED: Allow table cells to break across pages */
  .performance-table td,
  .performance-table th {
    page-break-inside: auto;
    page-break-before: auto;
  }
  
  .table-legend {
    display: flex;
    gap: 15px;
    margin-top: 10px;
    padding: 8px;
    background: #f8fafc;
    border-radius: 4px;
    font-size: 10px;
    justify-content: center;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  
  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
  }
  
  .legend-yes { background: #10b981; }
  .legend-no { background: #ef4444; }
  .legend-na { background: #9ca3af; }
  
  .footer {
    margin-top: 30px;
    padding-top: 15px;
    border-top: 1px solid #e5e7eb;
    font-size: 10px;
    color: #6b7280;
    text-align: center;
  }
  
  /* FIXED: Improved section handling */
  .pdf-section {
    margin-bottom: 40px;
    /* Allow sections to break naturally */
    page-break-inside: auto;
  }
  
  /* FIXED: Force page break only when explicitly needed */
  .force-page-break {
    page-break-before: always;
    
  }
  
  /* FIXED: Better table handling in sections */
  .section-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    border: 1px solid #e2e8f0;
    /* Allow table to break across pages */
    page-break-inside: auto;
  }
  
  .section-table tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  
  .section-table td,
  .section-table th {
    page-break-inside: auto;
    page-break-before: auto;
    /* Ensure content can wrap */
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  
  @media print {
    body {
      padding: 10px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    /* FIXED: Better print handling for tables */
    table {
      page-break-inside: auto !important;
    }
    
    tr {
      page-break-inside: avoid !important;
      page-break-after: auto !important;
    }
    
    td, th {
      page-break-inside: auto !important;
      page-break-before: auto !important;
    }
    
    .pdf-section {
      page-break-inside: auto !important;
    }
    
    /* Prevent small elements from breaking */
    .no-break {
      page-break-inside: avoid;
    }
    .table-cell {
    page-break-inside: auto !important;
    page-break-before: auto !important;
  }
  
  .table-row {
    page-break-inside: avoid !important;
  }

  }
</style>
</head>
<body>
  <div class="container">
    <!-- PAGE 1: Header + Basic Information + Performance Summary -->
    <div class="first-page">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <h1 class="form-title">${formTitle || "Form Report"}</h1>
          <p>Submitted on ${submittedDate}</p>
          ${
            type !== "default"
              ? `<p style="font-size: 10px; color: ${getTypeColor(
                  type,
                )}; font-weight: 600; margin-top: 2px;">${getPDFTypeDisplayName(
                  type,
                )}</p>`
              : ""
          }
        </div>
        <div class="logo-container">
          ${
            logoBase64
              ? `
            <img src="${logoBase64}" class="logo-img" alt="Company Logo" />
          `
              : `
            <div style="width: 100px; height: 40px; background: #f1f5f9; border: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 9px; text-align: center; border-radius: 3px;">
              Logo
            </div>
          `
          }
        </div>
      </div>

      <!-- Basic Information Section -->
      <div class="compact-section">
        ${firstSectionHTML}
      </div>
      
      <!-- Performance Summary Section -->
      <div class="compact-section">
        ${scoreSectionHTML}
      </div>
    </div>
  `;

  const showOverallTable =
    type === "both" ||
    type === "default" ||
    type === "section" ||
    type === "no-only" ||
    type === "yes-only" ||
    type === "na-only" ||
    type === "na";

  if (showOverallTable) {
    completeHTML += `
    <!-- PAGE 2: Overall Section Performance -->
    <div class="page-break-before">
      <div class="table-container">
        <div class="table-title">Overall Section Performance</div>
        <table class="performance-table">
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="table-legend">
          <div class="legend-item">
            <div class="legend-color legend-yes"></div>
            <span>Yes (Y%) - Green</span>
          </div>
          <div class="legend-item">
            <div class="legend-color legend-no"></div>
            <span>No (N%) - Red</span>
          </div>
          <div class="legend-item">
            <div class="legend-color legend-na"></div>
            <span>N/A (N/A%) - Gray</span>
          </div>
        </div>
      </div>
    </div>
    `;
  }

  // Add Response Analysis Section (if not section type)
  if (responseAnalysisHTML && type !== "section") {
    completeHTML += `
    <!-- Response Analysis Section -->
    <div class="${showOverallTable ? "page-break-before" : ""}">
      <div class="table-container">
        ${responseAnalysisHTML}
      </div>
    </div>
    `;
  }

  // Add Section Tables ONLY for specific types
  if (sectionTablesHTML) {
    completeHTML += sectionTablesHTML;
  }

  // Add Footer
  completeHTML += `
    <!-- Footer -->
    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()} • Total Assessment Score: ${overallScore.toFixed(
        1,
      )}% • PDF Type: ${getPDFTypeDisplayName(type)}</p>
      ${
        type === "no-only" ||
        type === "yes-only" ||
        type === "na-only" ||
        type === "na" ||
        type === "section"
          ? `<p style="font-size: 9px; color: #6b7280;">Note: ${getExclusionNote(
              type,
            )}</p>`
          : ""
      }
    </div>
  </div>
</body>
</html>
`;

  console.log(`✅ Generated complete HTML: ${completeHTML.length} characters`);
  return completeHTML;
}
