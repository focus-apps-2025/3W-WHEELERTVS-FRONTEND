import html2pdf from "html2pdf.js";
import html2canvas from "html2canvas";

// Function to capture chart as base64 image

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
  const naSegment = naDash > 0 ? `<circle
        cx="${centerX}" cy="${centerY}" r="${radius}"
        fill="none" stroke="${naColor}" stroke-width="${strokeWidth}"
        stroke-dasharray="${naDash} ${circumference - naDash}"
        stroke-dashoffset="${currentOffset}"
        transform="rotate(-90 ${centerX} ${centerY})"
    />` : '';
  currentOffset -= naDash;

  const noSegment = noDash > 0 ? `<circle
        cx="${centerX}" cy="${centerY}" r="${radius}"
        fill="none" stroke="${noColor}" stroke-width="${strokeWidth}"
        stroke-dasharray="${noDash} ${circumference - noDash}"
        stroke-dashoffset="${currentOffset}"
        transform="rotate(-90 ${centerX} ${centerY})"
    />` : '';
  currentOffset -= noDash;

  const yesSegment = yesDash > 0 ? `<circle
        cx="${centerX}" cy="${centerY}" r="${radius}"
        fill="none" stroke="${yesColor}" stroke-width="${strokeWidth}"
        stroke-dasharray="${yesDash} ${circumference - yesDash}"
        stroke-dashoffset="${currentOffset}"
        transform="rotate(-90 ${centerX} ${centerY})"
    />` : '';

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
    return '';
  }

  try {
    const canvas = await html2canvas(chartElement, {
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error capturing chart:', error);
    return '';
  }
}

function generateFirstSectionContent(
  form: any,
  response: any
): string {
  if (!form?.sections?.[0]) return '';

  const section = form.sections[0];
  const questions = section.questions || [];

  if (questions.length === 0) return '';

  // Helper functions
  const renderAnswerDisplay = (value: any): string => {
    if (value === null || value === undefined) {
      return '<span style="color: #9ca3af; font-style: italic;">No response</span>';
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : '<span style="color: #9ca3af; font-style: italic;">No response</span>';
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
      return `<pre style="font-size: 11px; white-space: pre-wrap; color: #4b5563; margin: 0;">${JSON.stringify(value, null, 2)}</pre>`;
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
  const maxRows = Math.max(leftColumnQuestions.length, rightColumnQuestions.length);

  for (let i = 0; i < maxRows; i++) {
    const leftQuestion = leftColumnQuestions[i];
    const rightQuestion = rightColumnQuestions[i];

    html += `<tr style="border-bottom: ${i < maxRows - 1 ? '1px solid #e5e7eb' : 'none'};">`;

    // Left Column Cell
    html += `<td style="padding: 8px 12px; border-right: 1px solid #e5e7eb; vertical-align: top; width: 50%;">`;
    if (leftQuestion) {
      const answer = response?.answers?.[leftQuestion.id];
      html += `
        <div style="margin-bottom: 4px;">
          <span style="font-weight: 600; color: #111827;">${leftQuestion.text || leftQuestion.id}</span>
          <span style="color: #374151; margin-left: 4px;">${renderAnswerDisplay(answer)}</span>
        </div>
      `;

      // Follow-up questions for left column
      if (leftQuestion.followUpQuestions) {
        leftQuestion.followUpQuestions.forEach((followUp: any) => {
          const followAnswer = response?.answers?.[followUp.id];
          if (hasAnswerValue(followAnswer)) {
            html += `
              <div style="margin-top: 4px; padding-left: 8px; border-left: 2px solid #d1d5db;">
                <span style="font-weight: 500; color: #475569; font-size: 11px;">${followUp.text || followUp.id}</span>
                <span style="color: #6b7280; font-size: 11px; margin-left: 4px;">${renderAnswerDisplay(followAnswer)}</span>
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
          <span style="font-weight: 600; color: #111827;">${rightQuestion.text || rightQuestion.id}</span>
          <span style="color: #374151; margin-left: 4px;">${renderAnswerDisplay(answer)}</span>
        </div>
      `;

      // Follow-up questions for right column
      if (rightQuestion.followUpQuestions) {
        rightQuestion.followUpQuestions.forEach((followUp: any) => {
          const followAnswer = response?.answers?.[followUp.id];
          if (hasAnswerValue(followAnswer)) {
            html += `
              <div style="margin-top: 4px; padding-left: 8px; border-left: 2px solid #d1d5db;">
                <span style="font-weight: 500; color: #475569; font-size: 11px;">${followUp.text || followUp.id}</span>
                <span style="color: #6b7280; font-size: 11px; margin-left: 4px;">${renderAnswerDisplay(followAnswer)}</span>
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
  const totalQuestions = sectionStats.reduce((sum, stat) => sum + stat.total, 0);

  const yesPercentage = totalQuestions > 0 ? (totalYes / totalQuestions) * 100 : 0;
  const noPercentage = totalQuestions > 0 ? (totalNo / totalQuestions) * 100 : 0;
  const naPercentage = totalQuestions > 0 ? (totalNA / totalQuestions) * 100 : 0;
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
            ${generatePieChartSVG(yesPercentage, noPercentage, naPercentage, overallScore)}
          </div>
          <div style="flex: 1;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
              <!-- Positive Responses -->
              <div style="text-align: center; padding: 18px; background: #c7d2fe; border-radius: 10px; border: 1.5px solid rgba(35, 153, 96, 1);">
                <div style="font-size: 18px; font-weight: 900; color: rgba(35, 153, 96, 1)">${totalYes}</div>
                <div style="font-size: 12px; color: rgba(35, 153, 96, 1); font-weight: 700;">Positive</div>
                <div style="font-size: 15px; font-weight: 700; color: rgba(35, 153, 96, 1);">${yesPercentage.toFixed(1)}%</div>
              </div>
              <!-- Issues Identified -->
              <div style="text-align: center; padding: 18px; background: #bfdbfe; border-radius: 10px; border: 1.5px solid rgba(215, 80, 68, 1);">
                <div style="font-size: 18px; font-weight: 900; color: rgba(215, 80, 68, 1);">${totalNo}</div>
                <div style="font-size: 12px; color: rgba(215, 80, 68, 1); font-weight: 700;">Issues</div>
                <div style="font-size: 15px; font-weight: 700; color: rgba(215, 80, 68, 1);">${noPercentage.toFixed(1)}%</div>
              </div>
              <!-- Not Applicable -->
              <div style="text-align: center; padding: 18px; background: #dbeafe; border-radius: 10px; border: 1.5px solid #aeb1b5ff;">
                <div style="font-size: 18px; font-weight: 900; color: #aeb1b5ff;">${totalNA}</div>
                <div style="font-size: 12px; color: #aeb1b5ff; font-weight: 700;">N/A</div>
                <div style="font-size: 15px; font-weight: 700; color: #aeb1b5ff;">${naPercentage.toFixed(1)}%</div>
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

  console.log('🔍 generateSectionTables called with:', {
    availableSectionsCount: availableSections.length,
    sectionQuestionStats: Object.keys(sectionQuestionStats),
    sectionMainParameters: Object.keys(sectionMainParameters),
    hasForm: !!form,
    hasResponse: !!response
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
        hasChartImage: !!chartImage
      });

      // FIX: Check if we have any data to show
      const hasQuestionStats = questionStats.length > 0;
      const hasMainParams = mainParams.length > 0;

      if (!hasQuestionStats && !hasMainParams) {
        console.log(`❌ Skipping section ${section.id} - no data`);
        return "";
      }

      const sectionTotals = hasQuestionStats ? questionStats.reduce(
        (totals: any, stat: any) => ({
          yes: totals.yes + stat.yes,
          no: totals.no + stat.no,
          na: totals.na + stat.na,
          total: totals.total + stat.total,
        }),
        { yes: 0, no: 0, na: 0, total: 0 }
      ) : { yes: 0, no: 0, na: 0, total: 0 };

      // Helper function to extract actual values from response
      const extractParameterData = (section: any) => {
        const parameterData: any[] = [];
        const sectionQuestions = section.questions || [];
        
        let currentParam: any = null;
        
        sectionQuestions.forEach((question: any) => {
          const answer = response.answers?.[question.id];
          const questionText = question.text || '';
          
          console.log(`🔍 Processing question: "${questionText}" → Answer: "${answer}"`);
          
          // Check if this is a main parameter question (not a follow-up)
          if (!questionText.includes('Remarks') && 
              !questionText.includes('Action Inititated') &&
              !questionText.includes('Reason fo Not OK') &&
              !questionText.includes('Responsible person') &&
              !questionText.includes('Review') &&
              !questionText.includes('Photograph')) {
            
            // This is a main question - save previous and start new
            if (currentParam) {
              parameterData.push(currentParam);
            }
            
            // USE EXACTLY WHAT DASHBOARD USES: question.subParam1 || "No parameter set"
            currentParam = {
              subParam1: question.subParam1 || "No parameter set", // EXACT SAME AS DASHBOARD
              remarks: '',
              actionInitiated: '',
              reasonForNotOK: '',
              responsiblePerson: '',
              review: '',
              files: []
            };
            
            console.log(`✅ Started new parameter: "${question.subParam1 || "No parameter set"}"`);
          }
          
          // If we have a current parameter, assign values based on question type
          if (currentParam) {
            if (questionText.includes('Remarks')) {
              currentParam.remarks = answer || '';
              console.log(`📝 Set remarks: "${answer}"`);
            } else if (questionText.includes('Action Inititated')) {
              currentParam.actionInitiated = answer || '';
              console.log(`🎯 Set actionInitiated: "${answer}"`);
            } else if (questionText.includes('Reason fo Not OK')) {
              currentParam.reasonForNotOK = answer || '';
              console.log(`❓ Set reasonForNotOK: "${answer}"`);
            } else if (questionText.includes('Responsible person')) {
              currentParam.responsiblePerson = answer || '';
              console.log(`👤 Set responsiblePerson: "${answer}"`);
            } else if (questionText.includes('Review')) {
              currentParam.review = answer || '';
              console.log(`📋 Set review: "${answer}"`);
            } else if (questionText.includes('Photograph') && answer) {
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
        hasMainParams: actualParameterData.length > 0
      });

      let html = '';

      // Response Analysis Section - Show if we have question stats
  if (hasQuestionStats) {
  const yesPercent = sectionTotals.total > 0 ? ((sectionTotals.yes / sectionTotals.total) * 100) : 0;
  const noPercent = sectionTotals.total > 0 ? ((sectionTotals.no / sectionTotals.total) * 100) : 0;
  const naPercent = sectionTotals.total > 0 ? ((sectionTotals.na / sectionTotals.total) * 100) : 0;

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
      html += `<div class="pdf-section ${index > 0 ? 'page-break-before' : ''}" style="margin-bottom: 40px;">`;

      const sectionDisplayName = section.name || section.label || section.title || `Section ${index + 1}`;

      html += `
        <div style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px solid #1e3a8a;">
          ${sectionDisplayName} - Response Analysis
        </div>
        <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">
          Detailed breakdown of responses with performance metrics & Page ${chunkIndex + 1} of ${questionChunks.length} - Questions ${(chunkIndex * questionsPerPage) + 1} to ${Math.min((chunkIndex * questionsPerPage) + questionsPerPage, questionStats.length)}
        </p>

        
        <!-- Chart and Question Parameter Table Side by Side -->
        <div style="display: flex; gap: 20px; margin-bottom: 30px; align-items: flex-start;">
          <!-- Chart Container (Left Side) -->
          <div style="flex: 1; min-width: 300px;">
            ${chartImage ? `
              <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <div style="font-size: 14px; font-weight: 600; color: #1e3a8a; margin-bottom: 10px; text-align: center;">
                  Response Distribution
                </div>
                <img src="${chartImage}" style="width: 100%; height: auto; max-height: 250px; object-fit: contain;" alt="Response Distribution Chart" />
              </div>
            ` : `
              <div style="background: #f8fafc; padding: 40px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">
                Chart not available
              </div>
            `}
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
              ${section.name || section.label || section.title || `Section ${index + 1}`} - Response Analysis (Continued)
            </div>
            <p style="font-size: 12px; color: #64748b;">
              Page ${chunkIndex + 1} of ${questionChunks.length} - Questions ${(chunkIndex * questionsPerPage) + 1} to ${Math.min((chunkIndex * questionsPerPage) + questionsPerPage, questionStats.length)}
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
          ${chunk.map((stat: any, localIndex: number) => {
            const globalIndex = (chunkIndex * questionsPerPage) + localIndex;
            const isMainQuestion = !stat.subParam1?.toLowerCase().includes('follow-up') &&
              !stat.subParam1?.toLowerCase().includes('followup') &&
              !stat.subParam1?.toLowerCase().includes('additional') &&
              !stat.subParam1?.toLowerCase().includes('sub-parameter');

            const rowBgColor = globalIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
            const questionColor = isMainQuestion ? '#1e293b' : '#0369a1';
            const fontWeight = isMainQuestion ? '600' : '500';
            
            // Calculate percentages for this specific question
            

            return `<tr class="table-row">
              <td class="table-cell" style="padding: 8px; font-size: 10px; color: ${questionColor}; font-weight: ${fontWeight}; border: 1px solid #e2e8f0; background-color: ${rowBgColor};">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span title="${stat.subParam1 || "No parameter"}">${(stat.subParam1 || "No parameter").substring(0, 35)}${(stat.subParam1 || "").length > 35 ? '...' : ''}</span>
                  ${!isMainQuestion ? '<span style="font-size: 8px; color: #0ea5e9; background: #f0f9ff; padding: 1px 4px; border-radius: 2px; border: 1px solid #bae6fd; font-weight: 500;">F</span>' : ''}
                </div>
              </td>
              
              <!-- Yes Column: Count + Percentage -->
              <td class="table-cell" style="padding: 8px; text-align: center; border: 1px solid #e2e8f0; background-color: ${rowBgColor};">
                <div style="font-weight: 700; color: #059669;">${stat.yes}</div>
                <div style="font-size: 9px; color: #059669; font-weight: 600;">${yesPercent.toFixed(1)}%</div>
              </td>
              
              <!-- No Column: Count + Percentage -->
              <td class="table-cell" style="padding: 8px; text-align: center; border: 1px solid #e2e8f0; background-color: ${rowBgColor};">
                <div style="font-weight: 700; color: #dc2626;">${stat.no}</div>
                <div style="font-size: 9px; color: #dc2626; font-weight: 600;">${noPercent.toFixed(1)}%</div>
              </td>
              
              <!-- N/A Column: Count + Percentage -->
              <td class="table-cell" style="padding: 8px; text-align: center; border: 1px solid #e2e8f0; background-color: ${rowBgColor};">
                <div style="font-weight: 700; color: #6b7280;">${stat.na}</div>
                <div style="font-size: 9px; color: #6b7280; font-weight: 600;">${naPercent.toFixed(1)}%</div>
              </td>
              
              <!-- Total Column: Count + "Responses" label -->
              <td class="table-cell" style="padding: 8px; text-align: center; border: 1px solid #e2e8f0; background-color: ${rowBgColor};">
                <div style="font-weight: 700; color: #1e40af;">${stat.total}</div>
                <div style="font-size: 9px; color: #6b7280; font-weight: 600;">Responses</div>
              </td>
            </tr>`;
          }).join("")}
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

      const sectionDisplayName = section.name || section.label || section.title || `Section ${index + 1}`;

      html += `
        <div style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px solid #1e3a8a;">
          ${sectionDisplayName} - Parameters & Actions
        </div>
        <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">
          Comprehensive analysis of parameters with corresponding actions and responsibilities &  Page ${chunkIndex + 1} of ${parameterChunks.length}
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
              ${section.name || section.label || section.title || `Section ${index + 1}`} - Parameters & Actions (Continued)
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
            .map(
              (param: any, localIndex: number) => {
                const globalIndex = (chunkIndex * rowsPerPage) + localIndex;
                const isMainParam = !param.subParam1?.toLowerCase().includes('follow-up') &&
                  !param.subParam1?.toLowerCase().includes('followup') &&
                  !param.subParam1?.toLowerCase().includes('sub-parameter');

                const rowBgColor = isMainParam
                  ? globalIndex % 2 === 0 ? '#ffffff' : '#f8fafc'
                  : globalIndex % 2 === 0 ? '#f0f9ff' : '#e0f2fe';

                const paramColor = isMainParam ? '#1e293b' : '#0369a1';
                const fontWeight = isMainParam ? '600' : '500';
                const borderLeft = isMainParam ? 'none' : '3px solid #0ea5e9';

                // Helper function to display actual values or "Not provided"
                const displayValue = (value: any, defaultValue: string = 'Not provided') => {
                  if (value === null || value === undefined || value === '') {
                    return `<span style="color: #9ca3af; font-style: italic;">${defaultValue}</span>`;
                  }
                  // Truncate very long values to prevent overflow
                  const strValue = String(value);
                  return strValue.length > 100 ? strValue.substring(0, 100) + '...' : strValue;
                };

                // FIXED: Added proper table cell classes
                return `<tr class="table-row">
                  <td class="table-cell" style="padding: 10px; font-size: 11px; color: ${paramColor}; font-weight: ${fontWeight}; border-left: ${borderLeft}; background-color: ${rowBgColor};">
                    <div style="display: flex; align-items: center; gap: 4px;">
                      <span>${param.subParam1 || "No parameter"}</span>
                      ${!isMainParam ? '<span style="font-size: 9px; color: #0ea5e9; background: #f0f9ff; padding: 1px 4px; border-radius: 3px; border: 1px solid #bae6fd; font-weight: 500;">Follow-up</span>' : ''}
                    </div>
                  </td>
                  <td class="table-cell" style="padding: 10px; font-size: 11px; color: #374151; background-color: ${rowBgColor};">
                    ${displayValue(param.remarks, 'Not provided')}
                  </td> 
                  <td class="table-cell" style="padding: 10px; font-size: 11px; color: #374151; background-color: ${rowBgColor};">
                    ${displayValue(param.actionInitiated, 'Not provided')}
                  </td>
                  <td class="table-cell" style="padding: 10px; font-size: 11px; color: #374151; background-color: ${rowBgColor};">
                    ${displayValue(param.reasonForNotOK, 'Not applicable')}
                  </td>
                  <td class="table-cell" style="padding: 10px; font-size: 11px; color: #374151; background-color: ${rowBgColor};">
                    ${displayValue(param.responsiblePerson, 'Not assigned')}
                  </td>
                  <td class="table-cell" style="padding: 10px; font-size: 11px; color: #374151; background-color: ${rowBgColor};">
                    ${displayValue(param.review, 'Pending')}
                  </td>
                  <td class="table-cell" style="padding: 10px; font-size: 11px; color: #374151; text-align: center; background-color: ${rowBgColor};">
                    ${param.files && param.files.length > 0
                      ? `<span style="color: #059669; font-weight: 600;">${param.files.length} file(s)</span>`
                      : '<span style="color: #6b7280; font-style: italic;">No files</span>'}
                  </td>
                </tr>`;
                
              }
            )
            .join("")}
        </tbody>
      </table>
    `;

    // Close the current pdf-section
    html += `</div>`;
  });
}

      console.log(` Generated HTML for section ${section.id}: ${html.length} characters`);
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
    '/assets/logo.png',
    './assets/logo.png',
    'assets/logo.png',
    '/Logo.png',
    './Logo.png',
    'Logo.png',
    '/images/Logo.png',
    './images/Logo.png',
    'images/Logo.png',
    '/img/Logo.png',
    './img/Logo.png',
    'img/Logo.png'
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
            console.log(`📸 Logo loaded successfully, base64 length: ${base64.length}`);
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
  console.warn('⚠️ No logo found in any path, image will be empty');
  return '';
}

export async function generateAndDownloadPDF(options: PDFOptions): Promise<void> {
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
    chartElementIds = []
  } = options;

  // Capture chart images first
  const sectionChartImages: Record<string, string> = {};
  const logoBase64 = await getLogoAsBase64();

  // Capture section-specific charts
  for (const section of availableSections) {
    const chartId = `section-chart-${section.id}`;
    const chartImage = await captureChartAsImage(chartId);
    if (chartImage) {
      sectionChartImages[section.id] = chartImage;
    }
  }

  // Calculate basic information
  const totalYes = sectionStats.reduce((sum, stat) => sum + stat.yes, 0);
  const totalNo = sectionStats.reduce((sum, stat) => sum + stat.no, 0);
  const totalNA = sectionStats.reduce((sum, stat) => sum + stat.na, 0);
  const totalQuestions = sectionStats.reduce((sum, stat) => sum + stat.total, 0);

  const yesPercentage = totalQuestions > 0 ? (totalYes / totalQuestions) * 100 : 0;
  const noPercentage = totalQuestions > 0 ? (totalNo / totalQuestions) * 100 : 0;
  const naPercentage = totalQuestions > 0 ? (totalNA / totalQuestions) * 100 : 0;
  const overallScore = yesPercentage;

  // Check if we need to show weightage columns
  const hasWeightage = sectionStats.some(stat => {
    let weightage = stat.weightage;
    if (typeof weightage === "string") weightage = parseFloat(weightage);
    return Number.isFinite(weightage) && weightage > 0;
  });

  // Prepare section data for table and charts
  const sectionData = sectionStats.map(stat => {
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
      naWeighted
    };
  });

  const generateTableBarChart = (yesPercent: number, noPercent: number, naPercent: number): string => {
    const totalWidth = 200; // Slightly wider to accommodate labels
    const yesWidth = (yesPercent / 100) * totalWidth;
    const noWidth = (noPercent / 100) * totalWidth;
    const naWidth = (naPercent / 100) * totalWidth;

    return `
      <div style="position: relative; width: ${totalWidth}px; height: 20px; background: #f1f5f9; border-radius: 3px; overflow: hidden; border: 1px solid #e2e8f0;">
        ${yesPercent > 0 ? `
          <div style="position: absolute; left: 0; width: ${yesWidth}px; height: 100%; background: #10b981; display: flex; align-items: center; justify-content: center;">
            ${yesPercent >= 15 ? `<span style="color: white; font-size: 8px; font-weight: bold; text-shadow: 0 0 2px rgba(0,0,0,0.5);">${yesPercent.toFixed(0)}%</span>` : ''}
          </div>
        ` : ''}
        ${noPercent > 0 ? `
          <div style="position: absolute; left: ${yesWidth}px; width: ${noWidth}px; height: 100%; background: #ef4444; display: flex; align-items: center; justify-content: center;">
            ${noPercent >= 15 ? `<span style="color: white; font-size: 8px; font-weight: bold; text-shadow: 0 0 2px rgba(0,0,0,0.5);">${noPercent.toFixed(0)}%</span>` : ''}
          </div>
        ` : ''}
        ${naPercent > 0 ? `
          <div style="position: absolute; left: ${yesWidth + noWidth}px; width: ${naWidth}px; height: 100%; background: #9ca3af; display: flex; align-items: center; justify-content: center;">
            ${naPercent >= 15 ? `<span style="color: white; font-size: 8px; font-weight: bold; text-shadow: 0 0 2px rgba(0,0,0,0.5);">${naPercent.toFixed(0)}%</span>` : ''}
          </div>
        ` : ''}
        
        <!-- Fallback labels for small segments -->
        ${yesPercent > 0 && yesPercent < 15 ? `
          <div style="position: absolute; left: 2px; top: 1px;">
            <span style="color: #059669; font-size: 7px; font-weight: bold; background: rgba(255,255,255,0.8); padding: 1px 2px; border-radius: 1px;">${yesPercent.toFixed(0)}%</span>
          </div>
        ` : ''}
        ${noPercent > 0 && noPercent < 15 ? `
          <div style="position: absolute; left: ${yesWidth + 2}px; top: 1px;">
            <span style="color: #dc2626; font-size: 7px; font-weight: bold; background: rgba(255,255,255,0.8); padding: 1px 2px; border-radius: 1px;">${noPercent.toFixed(0)}%</span>
          </div>
        ` : ''}
        ${naPercent > 0 && naPercent < 15 ? `
          <div style="position: absolute; left: ${yesWidth + noWidth + 2}px; top: 1px;">
            <span style="color: #6b7280; font-size: 7px; font-weight: bold; background: rgba(255,255,255,0.8); padding: 1px 2px; border-radius: 1px;">${naPercent.toFixed(0)}%</span>
          </div>
        ` : ''}
      </div>
    `;
  };

  // Generate table HTML
// Generate table HTML with new columns
const tableHeaders = `
  <th style="padding: 10px; text-align: left; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Section</th>
  <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Total</th>
  <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Yes</th>
  <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">No</th>
  <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">N.A</th>
  ${hasWeightage ? `
    <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">W%</th>
    <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">YW%</th>
    <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">NW%</th>
    <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">N/AW%</th>
  ` : ''}
  <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Visualization</th>
`;

const tableRows = sectionData.map((section, index) => {
  const rowBgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
  
  // Calculate percentages
  const yesPercent = section.total > 0 ? (section.yes / section.total) * 100 : 0;
  const noPercent = section.total > 0 ? (section.no / section.total) * 100 : 0;
  const naPercent = section.total > 0 ? (section.na / section.total) * 100 : 0;
  
  // Calculate weighted percentages
  const yesWeighted = (yesPercent * section.weightage) / 100;
  const noWeighted = (noPercent * section.weightage) / 100;
  const naWeighted = (naPercent * section.weightage) / 100;

  return `
    <tr style="background-color: ${rowBgColor};">
      <!-- Section Column: Shows section name with weightage below it -->
      <td style="padding: 8px; font-size: 10px; font-weight: 600; color: #1e293b; border: 1px solid #e5e7eb;">
        <div style="font-weight: 700; margin-bottom: 2px;">${section.title}</div>
        <div style="font-size: 9px; color: #6b7280; font-weight: 500;">
          Weightage: ${section.weightage.toFixed(1)}%
        </div>
      </td>
      <!-- Total Column: Total count + "Responses" label -->
      <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
        <div style="font-weight: 700; color: #1e40af;">${section.total}</div>
        <div style="font-size: 9px; color: #6b7280; font-weight: 600;">Responses</div>
      </td>
      
      <!-- Yes Column: Count + Percentage (e.g., "42" + "100.0%") -->
      <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
        <div style="font-weight: 700; color: #059669;">${section.yes}</div>
        <div style="font-size: 9px; color: #059669; font-weight: 600;">${yesPercent.toFixed(1)}%</div>
      </td>
      
      <!-- No Column: Count + Percentage (e.g., "0" + "0.0%") -->
      <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
        <div style="font-weight: 700; color: #dc2626;">${section.no}</div>
        <div style="font-size: 9px; color: #dc2626; font-weight: 600;">${noPercent.toFixed(1)}%</div>
      </td>
      
      <!-- N.A Column: Count + Percentage (e.g., "0" + "0.0%") -->
      <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
        <div style="font-weight: 700; color: #6b7280;">${section.na}</div>
        <div style="font-size: 9px; color: #6b7280; font-weight: 600;">${naPercent.toFixed(1)}%</div>
      </td>
      
     
      
      ${hasWeightage ? `
        <!-- Weightage Columns (if applicable): W%, YW%, NW%, N/AW% -->
        <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #1e40af; border: 1px solid #e5e7eb;">${section.weightage.toFixed(1)}</td>
        <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #059669; border: 1px solid #e5e7eb;">${yesWeighted.toFixed(1)}</td>
        <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #dc2626; border: 1px solid #e5e7eb;">${noWeighted.toFixed(1)}</td>
        <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #6b7280; border: 1px solid #e5e7eb;">${naWeighted.toFixed(1)}</td>
      ` : ''}
      
      <!-- Visualization: The bar chart -->
      <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">
        ${generateTableBarChart(yesPercent, noPercent, naPercent)}
      </td>
    </tr>
  `;
}).join('');

  // Generate content
  const firstSectionHTML = generateFirstSectionContent(form, response);
  const scoreSectionHTML = generateScoreSection(sectionStats);
  const sectionTablesHTML = generateSectionTables(
    availableSections,
    sectionQuestionStats,
    sectionMainParameters,
    sectionChartImages,
    form,
    response
  );

  // Create HTML for PDF with NEW structure
const htmlContent = `
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
        </div>
        <div class="logo-container">
          ${logoBase64 ? `
            <img src="${logoBase64}" class="logo-img" alt="Company Logo" />
          ` : `
            <div style="width: 100px; height: 40px; background: #f1f5f9; border: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 9px; text-align: center; border-radius: 3px;">
              Logo
            </div>
          `}
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
    
    <!-- PAGE 3+: Response Analysis Sections -->
    ${sectionTablesHTML}
    
    <!--<div class="footer">
      <p>Generated on ${new Date().toLocaleString()} • Total Assessment Score: ${overallScore.toFixed(1)}%</p>
    </div>-->
  </div>
</body>
</html>
`;

const element = document.createElement("div");
element.innerHTML = htmlContent;

const opt = {
  margin: 10, // Reset to normal margin
  filename: filename,
  image: {
    type: "jpeg",
    quality: 0.98
  },
  html2canvas: {
    scale: 2,
    logging: false,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff'
  },
  jsPDF: {
    orientation: "landscape",
    unit: "mm",
    format: [279.4, 157.1],
    compress: true
  },
  pagebreak: {
    mode: ['css', 'legacy'],
    before: '.page-break-before'
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