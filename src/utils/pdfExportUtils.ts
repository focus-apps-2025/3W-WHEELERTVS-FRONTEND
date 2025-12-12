import html2pdf from "html2pdf.js";
import html2canvas from "html2canvas";

// Function to capture chart as base64 image
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
    total: number;
    weightage: number;
  }>;
  sectionSummaryRows?: Array<{
    id: string;
    title: string;
    weightage: number;
    yesPercent: number;
    yesWeighted: number;
    noPercent: number;
    noWeighted: number;
    naPercent: number;
    naWeighted: number;
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
    | undefined; // Add this new parameter
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
          `   ✅ Attached follow-up: "${followUp.text}" → parent: "${parentQuestion.text}"`
        );
      } else {
        console.log(
          `   ❌ Could not find parent for follow-up: "${followUp.text}" (parentId: ${parentId})`
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
      `   - Final nested questions: ${updatedSection.questions.length}`
    );
    updatedSection.questions.forEach((q: any, index: number) => {
      console.log(
        `   - Q${index + 1}: "${q.text}" (${
          q.followUpQuestions.length
        } follow-ups)`
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
          item.trim().toUpperCase() === "Y")
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
      (item) => typeof item === "string" && item.trim().toUpperCase() === "NO"
    );
  }
  return false;
};

// Helper function to generate question numbers
const getQuestionNumber = (
  question: any,
  sectionIndex: number,
  questionIndex: number,
  followUpPath: number[] = []
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
    followUpPath: number[] = []
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
        (item) => item && typeof item === "string" && item.trim().length > 0
      )
    );
  }

  return true;
};

// Generic response analysis generator
function generateResponseAnalysis(
  form: any,
  response: any,
  availableSections: any[],
  responseType: "no" | "yes" | "na"
): string {
  console.log(
    `🔍 Starting ${responseType.toUpperCase()} Response Analysis generation...`
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
    followUpPath: number[] = []
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
      followUpPath
    );

    if (isTargetResponse && depth === 0) {
      console.log(
        `\n✅ Found ${responseType.toUpperCase()} response for ${questionNumber}: "${
          question.text
        }"`
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
        parentPath: number[]
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
          `   📞 Starting to collect follow-ups for: "${question.text}"`
        );
        collectFollowUps(question.followUpQuestions, 1, []);
      } else {
        console.log(
          `   ⓘ No follow-up questions found for: "${question.text}"`
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
        `   ✅ Added to responses with ${followUps.length} REAL follow-up answer(s)`
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
          newFollowUpPath
        );
      });
    }
  };

  // Process all sections and questions
  console.log(
    `\n🔍 Processing nested sections for ${responseType.toUpperCase()} responses...`
  );
  sectionsToUse.forEach((section, sectionIndex) => {
    console.log(`\n📁 Processing section: "${section.title}"`);
    if (section.questions && section.questions.length > 0) {
      console.log(`   Questions: ${section.questions.length}`);
      section.questions.forEach((question: any, questionIndex: number) => {
        console.log(
          `   Q${sectionIndex + 1}.${
            questionIndex + 1
          }: "${question.text.substring(0, 50)}..."`
        );
        processQuestion(question, section, 0, sectionIndex, questionIndex, []);
      });
    }
  });

  console.log(
    `\n📊 Found ${responses.length} ${responseType.toUpperCase()} responses`
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
    {}
  );

  // Generate HTML
  let html = "";

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
<table style="width: 100%; border-collapse: collapse; border: 1px solid #666; margin: ${
          responseIndex === 0 ? "0" : "20px"
        } 0 20px 0;">
  
  <!-- SECTION HEADER -->
  <tr style="background: #ffffffff;">
    <td colspan="3" style="border: 1px solid #666; padding: 10px; font-size: 14px; font-weight: 800; color: #1e3a8a;">
      ${sectionTitle} - ${response.questionNumber}
    </td>
  </tr>
  
  <!-- TABLE HEADERS -->
  <tr style="background:#1e3a8a;">
    <td style="border: 1px solid #666; padding: 8px; font-weight: 700; font-size: 11px; width: 15%;background:#1e3a8a; color:#ffffffff">
      Question No
    </td>
    <td style="border: 1px solid #666; padding: 8px; font-weight: 700; font-size: 11px; width: 60%;background:#1e3a8a;color:#ffffffff">
      Question
    </td>
    <td style="border: 1px solid #666; padding: 8px; text-align: center; font-weight: 700; font-size: 11px; width: 25%;background:#1e3a8a;color:#ffffffff">
      Response
    </td>
  </tr>
  
  <!-- MAIN QUESTION ROW -->
  <tr style="background: #ffffff;">
    <td style="border: 1px solid #666; padding: 8px; vertical-align: top; font-size: 10px; font-weight: 600; color: #374151;">
      ${response.questionNumber || "N/A"}
    </td>
    <td style="border: 1px solid #666; padding: 8px; vertical-align: top; font-size: 12px; color: #4b5563; line-height: 1.6;">
      ${response.questionText}
    </td>
    <td style="border: 1px solid #666; padding: 8px; vertical-align: middle; text-align: center; font-size: 11px; font-weight: 600; color: ${responseColor};">
      ${response.response}
    </td>
  </tr>
`;

        if (responseFollowUps.length > 0) {
          html += `
 <!-- FOLLOW-UP SECTION HEADER -->
  <tr style="background: #f8fafc;">
    <td colspan="3" style="border: 1px solid #666; padding: 10px; font-size: 12px; font-weight: 700; color: #1e3a8a;">
      Follow-up Questions:
    </td>
  </tr>
`;

          // Display follow-up questions for THIS main question only
          responseFollowUps.forEach((fq, fqIndex) => {
            const rowBgColor = fqIndex % 2 === 0 ? "#ffffff" : "#f8fafc";
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

                // Common image extensions (including with query params)
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

                // Check for image extensions
                const hasImageExtension = imageExtensions.some((ext) =>
                  url.includes(ext)
                );

                // Check for common image hosting patterns
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

                const hasImagePattern = imageHostingPatterns.some((pattern) =>
                  url.includes(pattern)
                );

                // Check for data URLs
                const isDataUrl = url.startsWith("data:image");

                return hasImageExtension || hasImagePattern || isDataUrl;
              };

              // Function to extract image URLs from various formats
              const getImageUrls = (
                answer: any
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

                // Case 1: String (could be URL or data URL)
                if (typeof answer === "string") {
                  if (isImageUrl(answer)) {
                    images.push({ url: answer });
                  }
                  return images;
                }

                // Case 2: Array
                if (Array.isArray(answer)) {
                  answer.forEach((item) => {
                    if (typeof item === "string" && isImageUrl(item)) {
                      images.push({ url: item });
                    } else if (item && typeof item === "object") {
                      // Try to find image URL in object
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

                // Case 3: Object
                if (typeof answer === "object") {
                  // Try to find image URL in object
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
                // Count images with location data
                const imagesWithLocation = imageUrls.filter(
                  (img) => img.location
                ).length;

                answerDisplay = `
                <div style="margin-top: 5px;">
                  <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 10px;">
              `;

                // Create image grid
                imageUrls.forEach((image, imgIndex) => {
                  answerDisplay += `
                  <div style="flex: 0 0 auto; display: flex; flex-direction: column; align-items: center;">
                    <img src="${image.url}" 
                         style="width: 100px; height: 100px; object-fit: cover; border: 1px solid #999; border-radius: 3px; margin-bottom: 5px;"
                         alt="Evidence photo ${imgIndex + 1}"
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/100/cccccc/999999?text=Image+Error'; this.style.border='1px solid #dc2626';">
                    
                    <!-- Image number -->
                    <div style="font-size: 9px; color: #666; margin-bottom: 2px; font-weight: 600;">
                      Image ${imgIndex + 1}
                    </div>
                    
                    <!-- Location info (only if exists for this image) -->
                    ${
                      image.location
                        ? `
                    <div style="font-size: 8px; color: #4b5563; text-align: center; line-height: 1.2; max-width: 100px;">
                      <div style="font-weight: 600; margin-bottom: 1px;">📍 Location:</div>
                      <div>Lat: ${image.location.latitude.toFixed(6)}</div>
                      <div>Long: ${image.location.longitude.toFixed(6)}</div>
                      <div>Acc: ±${image.location.accuracy}m</div>
                      ${
                        image.timestamp
                          ? `<div style="margin-top: 2px;">🕒 ${new Date(
                              image.timestamp
                            ).toLocaleString()}</div>`
                          : ""
                      }
                    </div>
                    `
                        : ``
                    }
                  </div>
                `;
                });

                answerDisplay += `
                  </div>
                </div>
              `;

                // Add summary if images have location
                if (imagesWithLocation > 0) {
                  locationInfo = `
                  <div style="font-size: 9px; color: #4b5563; margin-top: 5px; padding: 5px; background: #f0f9ff; border-radius: 3px;">
                    📍 ${imagesWithLocation} out of ${imageUrls.length} images have location data
                  </div>
                `;
                }
              } else if (typeof parsedAnswer === "string") {
                // Plain text answer
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
  <tr style="background: ${rowBgColor};">
    <td colspan="3" style="border: 1px solid #666; padding: 10px;">
      <div style="font-size: 10px; font-weight: 600; color: #595a5bff; margin-bottom: 8px;">
        ${fq.number} ${fq.text} ?
      </div>
      <div style="font-size: 11px; color: #151617ff; padding-left: 18px; line-height: 1.5;">
        Answer: ${answerDisplay}
        ${locationInfo}
      </div>
    </td>
  </tr>
`;
          });
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
    }
  );

  return html;
}

// Individual response analysis functions (kept for backward compatibility)
function generateNoResponseAnalysis(
  form: any,
  response: any,
  availableSections: any[]
): string {
  return generateResponseAnalysis(form, response, availableSections, "no");
}

function generateYesResponseAnalysis(
  form: any,
  response: any,
  availableSections: any[]
): string {
  return generateResponseAnalysis(form, response, availableSections, "yes");
}

function generateNAResponseAnalysis(
  form: any,
  response: any,
  availableSections: any[]
): string {
  return generateResponseAnalysis(form, response, availableSections, "na");
}

function generatePieChartSVG(
  yesPercent: number,
  noPercent: number,
  naPercent: number,
  overallScore: number
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

async function captureChartAsImage(chartElementId: string): Promise<string> {
  const chartElement = document.getElementById(chartElementId);
  if (!chartElement) {
    console.error(`Chart element with id ${chartElementId} not found`);
    return "";
  }

  try {
    const canvas = await html2canvas(chartElement, {
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
    });
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("Error capturing chart:", error);
    return "";
  }
}

function generateFirstSectionContent(form: any, response: any): string {
  if (!form?.sections?.[0]) return "";

  const section = form.sections[0];
  const questions = section.questions || [];

  if (questions.length === 0) return "";

  // Helper functions
  const renderAnswerDisplay = (value: any): string => {
    if (value === null || value === undefined) {
      return '<span style="color: #9ca3af; font-style: italic;">No response</span>';
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed
        ? trimmed
        : '<span style="color: #9ca3af; font-style: italic;">No response</span>';
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '<span style="color: #9ca3af; font-style: italic;">No response</span>';
      }
      return value.join(", ");
    }

    if (typeof value === "object") {
      if (!Object.keys(value).length) {
        return '<span style="color: #9ca3af; font-style: italic;">No response</span>';
      }
      return `<pre style="font-size: 11px; white-space: pre-wrap; color: #4b5563; margin: 0;">${JSON.stringify(
        value,
        null,
        2
      )}</pre>`;
    }

    return String(value);
  };

  const hasAnswerValue = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  };

  let html = `
    <div style="margin: 1px 0; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
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
    rightColumnQuestions.length
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
          <span style="color: #374151; margin-left: 4px;">${renderAnswerDisplay(
            answer
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
                <span style="color: #6b7280; font-size: 11px; margin-left: 4px;">${renderAnswerDisplay(
                  followAnswer
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
          <span style="color: #374151; margin-left: 4px;">${renderAnswerDisplay(
            answer
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
                <span style="color: #6b7280; font-size: 11px; margin-left: 4px;">${renderAnswerDisplay(
                  followAnswer
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
  const totalYes = sectionStats.reduce((sum, stat) => sum + stat.yes, 0);
  const totalNo = sectionStats.reduce((sum, stat) => sum + stat.no, 0);
  const totalNA = sectionStats.reduce((sum, stat) => sum + stat.na, 0);
  const totalQuestions = sectionStats.reduce(
    (sum, stat) => sum + stat.total,
    0
  );

  const yesPercentage =
    totalQuestions > 0 ? (totalYes / totalQuestions) * 100 : 0;
  const noPercentage =
    totalQuestions > 0 ? (totalNo / totalQuestions) * 100 : 0;
  const naPercentage =
    totalQuestions > 0 ? (totalNA / totalQuestions) * 100 : 0;
  const overallScore = yesPercentage;

  return `
    <div style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; font-family: 'Segoe UI', sans-serif;">
      <div style="padding: 8px 12px; background: #1e3a8a; text-align: center;">
        <h2 style="font-size: 16px; font-weight: 700; color: white; margin: 0;">
          Performance Summary
        </h2>
      </div>
      <div style="padding: 20px;">
        <div style="display: flex; align-items: center; gap: 40px;">
          <div style="flex-shrink: 0; text-align: center; min-width: 140px;">
            ${generatePieChartSVG(
              yesPercentage,
              noPercentage,
              naPercentage,
              overallScore
            )}
          </div>
          <div style="flex: 1;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
              <!-- Positive Responses -->
              <div style="text-align: center; padding: 18px; background: #c7d2fe; border-radius: 10px; border: 1.5px solid rgba(35, 153, 96, 1);">
                <div style="font-size: 18px; font-weight: 900; color: rgba(35, 153, 96, 1)">${totalYes}</div>
                <div style="font-size: 12px; color: rgba(35, 153, 96, 1); font-weight: 700;">Positive</div>
                <div style="font-size: 15px; font-weight: 700; color: rgba(35, 153, 96, 1);">${yesPercentage.toFixed(
                  1
                )}%</div>
              </div>
              <!-- Issues Identified -->
              <div style="text-align: center; padding: 18px; background: #bfdbfe; border-radius: 10px; border: 1.5px solid rgba(215, 80, 68, 1);">
                <div style="font-size: 18px; font-weight: 900; color: rgba(215, 80, 68, 1);">${totalNo}</div>
                <div style="font-size: 12px; color: rgba(215, 80, 68, 1); font-weight: 700;">Issues</div>
                <div style="font-size: 15px; font-weight: 700; color: rgba(215, 80, 68, 1);">${noPercentage.toFixed(
                  1
                )}%</div>
              </div>
              <!-- Not Applicable -->
              <div style="text-align: center; padding: 18px; background: #dbeafe; border-radius: 10px; border: 1.5px solid #aeb1b5ff;">
                <div style="font-size: 18px; font-weight: 900; color: #aeb1b5ff;">${totalNA}</div>
                <div style="font-size: 12px; color: #aeb1b5ff; font-weight: 700;">N/A</div>
                <div style="font-size: 15px; font-weight: 700; color: #aeb1b5ff;">${naPercentage.toFixed(
                  1
                )}%</div>
              </div>
            </div>
            <!-- Total Questions -->
            <div style="margin-top: 22px; padding-top: 12px; border-top: 1.5px solid #e5e7eb; text-align: center; font-size: 14px; font-weight: 700; color: #374151; letter-spacing: 0.5px; text-transform: uppercase;">
              Total Questions: <span style="color: #2563eb; font-weight: 900; margin-left: 6px;">${totalQuestions}</span>
            </div>
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
  response?: any
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
              yes: totals.yes + stat.yes,
              no: totals.no + stat.no,
              na: totals.na + stat.na,
              total: totals.total + stat.total,
            }),
            { yes: 0, no: 0, na: 0, total: 0 }
          )
        : { yes: 0, no: 0, na: 0, total: 0 };

      // Helper function to extract actual values from response
      const extractParameterData = (section: any) => {
        const parameterData: any[] = [];
        const sectionQuestions = section.questions || [];

        let currentParam: any = null;

        sectionQuestions.forEach((question: any) => {
          const answer = response.answers?.[question.id];
          const questionText = question.text || "";

          console.log(
            `🔍 Processing question: "${questionText}" → Answer: "${answer}"`
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
              }"`
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
        const yesPercent =
          sectionTotals.total > 0
            ? (sectionTotals.yes / sectionTotals.total) * 100
            : 0;
        const noPercent =
          sectionTotals.total > 0
            ? (sectionTotals.no / sectionTotals.total) * 100
            : 0;
        const naPercent =
          sectionTotals.total > 0
            ? (sectionTotals.na / sectionTotals.total) * 100
            : 0;

        // Pagination logic - split questions into chunks of max 7
        const questionsPerPage = 8;
        const questionChunks = [];

        for (let i = 0; i < questionStats.length; i += questionsPerPage) {
          questionChunks.push(questionStats.slice(i, i + questionsPerPage));
        }

        // Generate content for each chunk
        questionChunks.forEach((chunk, chunkIndex) => {
          // For first chunk, create the main section with chart
          if (chunkIndex === 0) {
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
        <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">
          Detailed breakdown of responses with performance metrics & Page ${
            chunkIndex + 1
          } of ${questionChunks.length} - Questions ${
              chunkIndex * questionsPerPage + 1
            } to ${Math.min(
              chunkIndex * questionsPerPage + questionsPerPage,
              questionStats.length
            )}
        </p>

        
        <!-- Chart and Question Parameter Table Side by Side -->
        <div style="display: flex; gap: 20px; margin-bottom: 30px; align-items: flex-start;">
          <!-- Chart Container (Left Side) -->
          <div style="flex: 1; min-width: 300px;">
            ${
              chartImage
                ? `
              <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <div style="font-size: 14px; font-weight: 600; color: #1e3a8a; margin-bottom: 10px; text-align: center;">
                  Response Distribution
                </div>
                <img src="${chartImage}" style="width: 100%; height: auto; max-height: 250px; object-fit: contain;" alt="Response Distribution Chart" />
              </div>
            `
                : `
              <div style="background: #f8fafc; padding: 40px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">
                Chart not available
              </div>
            `
            }
          </div>
          
          <!-- Question Parameter Table (Right Side) -->
          <div style="flex: 1; min-width: 300px;">
      `;
          }
          // For subsequent chunks, create new page with centered table
          else {
            html += `
        </div></div></div> <!-- Close previous containers properly -->
        <div class="pdf-section page-break-before" style="margin-bottom: 40px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px;">
              ${
                section.name ||
                section.label ||
                section.title ||
                `Section ${index + 1}`
              } - Response Analysis (Continued)
            </div>
            <p style="font-size: 12px; color: #64748b;">
              Page ${chunkIndex + 1} of ${questionChunks.length} - Questions ${
              chunkIndex * questionsPerPage + 1
            } to ${Math.min(
              chunkIndex * questionsPerPage + questionsPerPage,
              questionStats.length
            )}
            </p>
          </div>
          <!-- Centered table container -->
          <div style="display: flex; justify-content: center;">
            <div style="width: 100%; max-width: 800px;">
      `;
          }

          // Generate the table for current chunk
          html += `
      <table class="section-table" style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; font-size: 11px;">
        <thead>
          <tr style="background: #1e3a8a;">
            <th style="padding: 10px; text-align: left; font-size: 11px; font-weight: 600; color: white; border: 1px solid #e2e8f0;">Question Parameter</th>
            <th style="padding: 10px; text-align: center; font-size: 11px; font-weight: 600; color: white; border: 1px solid #e2e8f0;">Yes</th>
            <th style="padding: 10px; text-align: center; font-size: 11px; font-weight: 600; color: white; border: 1px solid #e2e8f0;">No</th>
            <th style="padding: 10px; text-align: center; font-size: 11px; font-weight: 600; color: white; border: 1px solid #e2e8f0;">N/A</th>
            <th style="padding: 10px; text-align: center; font-size: 11px; font-weight: 600; color: white; border: 1px solid #e2e8f0;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${chunk
            .map((stat: any, localIndex: number) => {
              const globalIndex = chunkIndex * questionsPerPage + localIndex;
              const isMainQuestion =
                !stat.subParam1?.toLowerCase().includes("follow-up") &&
                !stat.subParam1?.toLowerCase().includes("followup") &&
                !stat.subParam1?.toLowerCase().includes("additional") &&
                !stat.subParam1?.toLowerCase().includes("sub-parameter");

              const rowBgColor = globalIndex % 2 === 0 ? "#ffffff" : "#f8fafc";
              const questionColor = isMainQuestion ? "#1e293b" : "#0369a1";
              const fontWeight = isMainQuestion ? "600" : "500";

              // Calculate percentages for this specific question

              return `<tr class="table-row">
              <td class="table-cell" style="padding: 8px; font-size: 10px; color: ${questionColor}; font-weight: ${fontWeight}; border: 1px solid #e2e8f0; background-color: ${rowBgColor};">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span title="${stat.subParam1 || "No parameter"}">${(
                stat.subParam1 || "No parameter"
              ).substring(0, 35)}${
                (stat.subParam1 || "").length > 35 ? "..." : ""
              }</span>
                  ${
                    !isMainQuestion
                      ? '<span style="font-size: 8px; color: #0ea5e9; background: #f0f9ff; padding: 1px 4px; border-radius: 2px; border: 1px solid #bae6fd; font-weight: 500;">F</span>'
                      : ""
                  }
                </div>
              </td>
              
              <!-- Yes Column: Count + Percentage -->
              <td class="table-cell" style="padding: 8px; text-align: center; border: 1px solid #e2e8f0; background-color: ${rowBgColor};">
                <div style="font-weight: 700; color: #059669;">${stat.yes}</div>
                <div style="font-size: 9px; color: #059669; font-weight: 600;">${yesPercent.toFixed(
                  1
                )}%</div>
              </td>
              
              <!-- No Column: Count + Percentage -->
              <td class="table-cell" style="padding: 8px; text-align: center; border: 1px solid #e2e8f0; background-color: ${rowBgColor};">
                <div style="font-weight: 700; color: #dc2626;">${stat.no}</div>
                <div style="font-size: 9px; color: #dc2626; font-weight: 600;">${noPercent.toFixed(
                  1
                )}%</div>
              </td>
              
              <!-- N/A Column: Count + Percentage -->
              <td class="table-cell" style="padding: 8px; text-align: center; border: 1px solid #e2e8f0; background-color: ${rowBgColor};">
                <div style="font-weight: 700; color: #6b7280;">${stat.na}</div>
                <div style="font-size: 9px; color: #6b7280; font-weight: 600;">${naPercent.toFixed(
                  1
                )}%</div>
              </td>
              
              <!-- Total Column: Count + "Responses" label -->
              <td class="table-cell" style="padding: 8px; text-align: center; border: 1px solid #e2e8f0; background-color: ${rowBgColor};">
                <div style="font-weight: 700; color: #1e40af;">${
                  stat.total
                }</div>
                <div style="font-size: 9px; color: #6b7280; font-weight: 600;">Responses</div>
              </td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>
      
    `;

          // Close containers properly for each chunk
          if (chunkIndex === 0) {
            // For first chunk, close the table container and flex container
            html += `
          </div>
        </div>
      </div> <!-- Close pdf-section -->
      `;
          } else {
            // For subsequent chunks, close the centered containers and pdf-section
            html += `
          </div>
        </div>
      </div> <!-- Close pdf-section -->
      `;
          }
        });
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
                defaultValue: string = "Not provided"
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
        ` Generated HTML for section ${section.id}: ${html.length} characters`
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
    total: number;
    weightage: number;
  }>;
  sectionSummaryRows?: Array<{
    id: string;
    title: string;
    weightage: number;
    yesPercent: number;
    yesWeighted: number;
    noPercent: number;
    noWeighted: number;
    naPercent: number;
    naWeighted: number;
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
              `📸 Logo loaded successfully, base64 length: ${base64.length}`
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

  // If no logo found, return empty string so no image shows
  console.warn("⚠️ No logo found in any path, image will be empty");
  return "";
}

export async function generateAndDownloadPDF(
  options: PDFOptions
): Promise<void> {
  const {
    filename,
    formTitle,
    submittedDate,
    sectionStats,
    sectionQuestionStats = {},
    sectionMainParameters = {},
    availableSections = [],
    form,
    response,
    chartElementIds = [],
    type = "default", // Default to current behavior
  } = options;

  // Capture chart images first (only needed if we're showing section tables or section type)
  const sectionChartImages: Record<string, string> = {};
  const logoBase64 = await getLogoAsBase64();

  // Determine if we need to capture charts
  const needsCharts =
    type === "both" || type === "default" || type === "section";
  if (needsCharts) {
    for (const section of availableSections) {
      const chartId = `section-chart-${section.id}`;
      const chartImage = await captureChartAsImage(chartId);
      if (chartImage) {
        sectionChartImages[section.id] = chartImage;
      }
    }
  }

  // Calculate basic information
  const totalYes = sectionStats.reduce((sum, stat) => sum + stat.yes, 0);
  const totalNo = sectionStats.reduce((sum, stat) => sum + stat.no, 0);
  const totalNA = sectionStats.reduce((sum, stat) => sum + stat.na, 0);
  const totalQuestions = sectionStats.reduce(
    (sum, stat) => sum + stat.total,
    0
  );

  const yesPercentage =
    totalQuestions > 0 ? (totalYes / totalQuestions) * 100 : 0;
  const noPercentage =
    totalQuestions > 0 ? (totalNo / totalQuestions) * 100 : 0;
  const naPercentage =
    totalQuestions > 0 ? (totalNA / totalQuestions) * 100 : 0;
  const overallScore = yesPercentage;

  // Check if we need to show weightage columns (only for types that show section tables)
  let hasWeightage = false;
  const showSectionTable =
    type === "both" || type === "default" || type === "section";
  if (showSectionTable) {
    hasWeightage = sectionStats.some((stat) => {
      let weightage = stat.weightage;
      if (typeof weightage === "string") weightage = parseFloat(weightage);
      return Number.isFinite(weightage) && weightage > 0;
    });
  }

  // Prepare section data for table and charts (only for types that show section tables)
  let sectionData: any[] = [];
  let tableHeaders = "";
  let tableRows = "";

  if (showSectionTable) {
    sectionData = sectionStats.map((stat) => {
      const yesPercent = stat.total ? (stat.yes / stat.total) * 100 : 0;
      const noPercent = stat.total ? (stat.no / stat.total) * 100 : 0;
      const naPercent = stat.total ? (stat.na / stat.total) * 100 : 0;

      let weightage = stat.weightage;
      if (typeof weightage === "string") weightage = parseFloat(weightage);
      weightage = Number.isFinite(weightage) ? weightage : 0;
      if (weightage > 0 && weightage < 1) weightage = weightage * 100;

      const yesWeighted = (yesPercent * weightage) / 100;
      const noWeighted = (noPercent * weightage) / 100;
      const naWeighted = (naPercent * weightage) / 100;

      return {
        ...stat,
        yesPercent,
        noPercent,
        naPercent,
        weightage,
        yesWeighted,
        noWeighted,
        naWeighted,
      };
    });

    const generateTableBarChart = (
      yesPercent: number,
      noPercent: number,
      naPercent: number
    ): string => {
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
                      0
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
                      0
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
                      0
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
                0
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
                0
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
                0
              )}%</span>
            </div>
          `
              : ""
          }
        </div>
      `;
    };

    // Generate table HTML with new columns
    tableHeaders = `
      <th style="padding: 10px; text-align: left; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Section</th>
      <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Total</th>
      <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Yes</th>
      <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">No</th>
      <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">N.A</th>
      ${
        hasWeightage
          ? `
        <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">W%</th>
        <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">YW%</th>
        <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">NW%</th>
        <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">N/AW%</th>
      `
          : ""
      }
      <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Visualization</th>
    `;

    tableRows = sectionData
      .map((section, index) => {
        const rowBgColor = index % 2 === 0 ? "#ffffff" : "#f8fafc";

        // Calculate percentages
        const yesPercent =
          section.total > 0 ? (section.yes / section.total) * 100 : 0;
        const noPercent =
          section.total > 0 ? (section.no / section.total) * 100 : 0;
        const naPercent =
          section.total > 0 ? (section.na / section.total) * 100 : 0;

        // Calculate weighted percentages
        const yesWeighted = (yesPercent * section.weightage) / 100;
        const noWeighted = (noPercent * section.weightage) / 100;
        const naWeighted = (naPercent * section.weightage) / 100;

        return `
        <tr style="background-color: ${rowBgColor};">
          <!-- Section Column: Shows section name with weightage below it -->
          <td style="padding: 8px; font-size: 10px; font-weight: 600; color: #1e293b; border: 1px solid #e5e7eb;">
            <div style="font-weight: 700; margin-bottom: 2px;">${
              section.title
            }</div>
            <div style="font-size: 9px; color: #6b7280; font-weight: 500;">
              Weightage: ${section.weightage.toFixed(1)}%
            </div>
          </td>
          <!-- Total Column: Total count + "Responses" label -->
          <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
            <div style="font-weight: 700; color: #1e40af;">${
              section.total
            }</div>
            <div style="font-size: 9px; color: #6b7280; font-weight: 600;">Responses</div>
          </td>
          
          <!-- Yes Column: Count + Percentage (e.g., "42" + "100.0%") -->
          <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
            <div style="font-weight: 700; color: #059669;">${section.yes}</div>
            <div style="font-size: 9px; color: #059669; font-weight: 600;">${yesPercent.toFixed(
              1
            )}%</div>
          </td>
          
          <!-- No Column: Count + Percentage (e.g., "0" + "0.0%") -->
          <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
            <div style="font-weight: 700; color: #dc2626;">${section.no}</div>
            <div style="font-size: 9px; color: #dc2626; font-weight: 600;">${noPercent.toFixed(
              1
            )}%</div>
          </td>
          
          <!-- N.A Column: Count + Percentage (e.g., "0" + "0.0%") -->
          <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
            <div style="font-weight: 700; color: #6b7280;">${section.na}</div>
            <div style="font-size: 9px; color: #6b7280; font-weight: 600;">${naPercent.toFixed(
              1
            )}%</div>
          </td>
          
          ${
            hasWeightage
              ? `
            <!-- Weightage Columns (if applicable): W%, YW%, NW%, N/AW% -->
            <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #1e40af; border: 1px solid #e5e7eb;">${section.weightage.toFixed(
              1
            )}</td>
            <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #059669; border: 1px solid #e5e7eb;">${yesWeighted.toFixed(
              1
            )}</td>
            <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #dc2626; border: 1px solid #e5e7eb;">${noWeighted.toFixed(
              1
            )}</td>
            <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #6b7280; border: 1px solid #e5e7eb;">${naWeighted.toFixed(
              1
            )}</td>
          `
              : ""
          }
          
          <!-- Visualization: The bar chart -->
          <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">
            ${generateTableBarChart(yesPercent, noPercent, naPercent)}
          </td>
        </tr>
      `;
      })
      .join("");
  }

  // Generate content based on selected type
  const firstSectionHTML = generateFirstSectionContent(form, response);
  const scoreSectionHTML = generateScoreSection(sectionStats);

  let responseAnalysisHTML = "";
  let responseAnalysisTitle = "";

  // Generate response analysis based on type
  switch (type) {
    case "no-only":
      responseAnalysisHTML = generateNoResponseAnalysis(
        form,
        response,
        form.sections || []
      );
      responseAnalysisTitle = "NO Response Analysis Only";
      break;
    case "yes-only":
      responseAnalysisHTML = generateYesResponseAnalysis(
        form,
        response,
        form.sections || []
      );
      responseAnalysisTitle = "YES Response Analysis Only";
      break;
    case "na-only":
      responseAnalysisHTML = generateNAResponseAnalysis(
        form,
        response,
        form.sections || []
      );
      responseAnalysisTitle = "N/A Response Analysis Only";
      break;
    case "both":
      responseAnalysisHTML =
        generateNoResponseAnalysis(form, response, form.sections || []) +
        generateYesResponseAnalysis(form, response, form.sections || []) +
        generateNAResponseAnalysis(form, response, form.sections || []);
      responseAnalysisTitle = "BOTH NO, YES & N/A Response Analysis";
      break;
    case "section":
      responseAnalysisHTML = ""; // No individual response analysis for section type
      responseAnalysisTitle = "Section-wise Analysis Only";
      break;
    default:
      // Current behavior: NO analysis only (backward compatibility)
      responseAnalysisHTML = generateNoResponseAnalysis(
        form,
        response,
        form.sections || []
      );
      responseAnalysisTitle = "Response Analysis";
  }

  // Generate section tables ONLY for specific types
  let sectionTablesHTML = "";
  if (type === "default" || type === "section") {
    sectionTablesHTML = generateSectionTables(
      availableSections,
      sectionQuestionStats,
      sectionMainParameters,
      sectionChartImages,
      form,
      response
    );
  }

  // Create HTML for PDF with conditional content based on type
  let htmlContent = `
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
          <h1>3W Audit Point for Service and Assessment Report</h1>
          <p>Submitted on ${submittedDate}</p>
          ${
            type !== "default"
              ? `<p style="font-size: 10px; color: ${getTypeColor(
                  type
                )}; font-weight: 600; margin-top: 2px;">${responseAnalysisTitle}</p>`
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

  // Add Overall Section Performance table for specific types
  const showOverallTable =
    type === "both" ||
    type === "default" ||
    type === "section" ||
    type === "no-only" ||
    type === "yes-only" ||
    type === "na-only" ||
    type === "na";

  if (showOverallTable) {
    htmlContent += `
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
    htmlContent += `
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
    htmlContent += sectionTablesHTML;
  }

  // Add Footer
  htmlContent += `
    <!-- Footer -->
    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()} • Total Assessment Score: ${overallScore.toFixed(
    1
  )}% • PDF Type: ${getPDFTypeDisplayName(type)}</p>
      ${
        type === "no-only" ||
        type === "yes-only" ||
        type === "na-only" ||
        type === "na" ||
        type === "section"
          ? `<p style="font-size: 9px; color: #6b7280;">Note: ${getExclusionNote(
              type
            )}</p>`
          : ""
      }
    </div>
  </div>
</body>
</html>
`;

  // Helper function to get type color
  function getTypeColor(type: string): string {
    switch (type) {
      case "no-only":
        return "#dc2626";
      case "yes-only":
        return "#059669";
      case "na-only":
      case "na":
        return "#f59e0b";
      case "both":
        return "#1e3a8a";
      case "section":
        return "#7c3aed";
      default:
        return "#1e3a8a";
    }
  }

  // Helper function to get PDF type display name
  function getPDFTypeDisplayName(type: string): string {
    switch (type) {
      case "no-only":
        return "NO Response Analysis Only";
      case "yes-only":
        return "YES Response Analysis Only";
      case "na-only":
      case "na":
        return "N/A Response Analysis Only";
      case "both":
        return "BOTH NO, YES & N/A Response Analysis";
      case "section":
        return "Section-wise Analysis Only";
      default:
        return "Standard Report";
    }
  }

  // Helper function to get exclusion note
  function getExclusionNote(type: string): string {
    switch (type) {
      case "no-only":
        return "YES, N/A analysis and Section tables excluded in this NO-only report";
      case "yes-only":
        return "NO, N/A analysis and Section tables excluded in this YES-only report";
      case "na-only":
      case "na":
        return "NO, YES analysis and Section tables excluded in this N/A-only report";
      case "section":
        return "Individual response analysis tables (NO, YES, N/A) excluded in this section-only report";
      default:
        return "";
    }
  }

  // Helper function to get PDF type suffix
  function getPDFTypeSuffix(type: string): string {
    switch (type) {
      case "no-only":
        return "NO_Analysis_Only";
      case "yes-only":
        return "YES_Analysis_Only";
      case "na-only":
      case "na":
        return "NA_Analysis_Only";
      case "both":
        return "BOTH_Complete";
      case "section":
        return "Section_Only";
      default:
        return "Standard";
    }
  }

  const element = document.createElement("div");
  element.innerHTML = htmlContent;

  const opt = {
    margin: 10,
    filename: `${filename.replace(".pdf", "")}_${getPDFTypeSuffix(type)}.pdf`,
    image: {
      type: "jpeg",
      quality: 0.98,
    },
    html2canvas: {
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
    },
    jsPDF: {
      orientation: "landscape",
      unit: "mm",
      format: [279.4, 157.1],
      compress: true,
    },
    pagebreak: {
      mode: ["css", "legacy"],
      before: ".page-break-before",
    },
  };

  return new Promise<void>((resolve, reject) => {
    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => {
        resolve();
      })
      .catch((error: Error) => {
        console.error("PDF generation error:", error);
        reject(error);
      });
  });
}

// Update these convenience functions
export async function generateNoOnlyPDF(
  options: Omit<PDFOptions, "type">
): Promise<void> {
  return generateAndDownloadPDF({ ...options, type: "no-only" });
}

export async function generateYesOnlyPDF(
  options: Omit<PDFOptions, "type">
): Promise<void> {
  return generateAndDownloadPDF({ ...options, type: "yes-only" });
}

export async function generateNAOnlyPDF(
  options: Omit<PDFOptions, "type">
): Promise<void> {
  return generateAndDownloadPDF({ ...options, type: "na-only" });
}

export async function generateBothPDF(
  options: Omit<PDFOptions, "type">
): Promise<void> {
  return generateAndDownloadPDF({ ...options, type: "both" });
}

export async function generateSectionOnlyPDF(
  options: Omit<PDFOptions, "type">
): Promise<void> {
  return generateAndDownloadPDF({ ...options, type: "section" });
}

export async function generateFullPDF(
  options: Omit<PDFOptions, "type">
): Promise<void> {
  return generateAndDownloadPDF({ ...options, type: "default" });
}
