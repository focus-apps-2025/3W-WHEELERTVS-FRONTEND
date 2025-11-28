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
        if (!form || !response) {
          console.log('❌ extractParameterData: Missing form or response, using mainParams');
          return mainParams; // Use the provided mainParams if no form/response
        }
        
        const parameterData: any[] = [];
        
        console.log('🔍 Processing section questions:', section.questions?.length || 0);
        
        // Process each question in the section
        section.questions?.forEach((question: any) => {
          const mainAnswer = response.answers?.[question.id];
          console.log(`🔍 Question ${question.id}:`, {
            hasAnswer: !!mainAnswer,
            answerType: typeof mainAnswer,
            answerKeys: mainAnswer && typeof mainAnswer === 'object' ? Object.keys(mainAnswer) : 'N/A'
          });
          
          if (mainAnswer && typeof mainAnswer === 'object') {
            parameterData.push({
              subParam1: question.subParam1 || question.text || question.label || "No parameter set",
              remarks: mainAnswer.remarks || '',
              actionInitiated: mainAnswer.actionInitiated || '',
              reasonForNotOK: mainAnswer.reasonForNotOK || '',
              responsiblePerson: mainAnswer.responsiblePerson || '',
              review: mainAnswer.review || '',
              files: mainAnswer.files || []
            });
          }

          // Process follow-up questions
          question.followUpQuestions?.forEach((followUp: any) => {
            const followUpAnswer = response.answers?.[followUp.id];
            if (followUpAnswer && typeof followUpAnswer === 'object') {
              parameterData.push({
                subParam1: followUp.subParam1 || followUp.text || followUp.label || question.subParam1 || "No parameter set",
                remarks: followUpAnswer.remarks || '',
                actionInitiated: followUpAnswer.actionInitiated || '',
                reasonForNotOK: followUpAnswer.reasonForNotOK || '',
                responsiblePerson: followUpAnswer.responsiblePerson || '',
                review: followUpAnswer.review || '',
                files: followUpAnswer.files || []
              });
            }
          });
        });

        // Process form-level follow-up questions for this section
        form.followUpQuestions?.forEach((followUp: any) => {
          const followUpAnswer = response.answers?.[followUp.id];
          if (followUpAnswer && typeof followUpAnswer === 'object') {
            // Check if this follow-up belongs to this section by checking parent question
            const parentQuestion = section.questions?.find((q: any) => q.id === followUp.parentId);
            if (parentQuestion) {
              parameterData.push({
                subParam1: followUp.subParam1 || followUp.text || followUp.label || parentQuestion.subParam1 || "No parameter set",
                remarks: followUpAnswer.remarks || '',
                actionInitiated: followUpAnswer.actionInitiated || '',
                reasonForNotOK: followUpAnswer.reasonForNotOK || '',
                responsiblePerson: followUpAnswer.responsiblePerson || '',
                review: followUpAnswer.review || '',
                files: followUpAnswer.files || []
              });
            }
          }
        });

        console.log(`✅ extractParameterData found ${parameterData.length} parameters`);
        
        // If no parameters found from response, use the provided mainParams
        if (parameterData.length === 0) {
          console.log('⚠️ No parameters extracted from response, using provided mainParams');
          return mainParams;
        }
        
        return parameterData;
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

        html += `<div class="pdf-section" style="${index > 0 ? 'page-break-before: always;' : ''} margin-bottom: 40px;">`;

        // FIX: Use better fallback for section name
        const sectionDisplayName = section.name || section.label || section.title || `Section ${index + 1}`;
        
        html += `
          <div style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px solid #1e3a8a;">
            ${sectionDisplayName} - Response Analysis
          </div>
          <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">
            Detailed breakdown of responses with performance metrics
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
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-top: none; font-size: 11px;">
                <thead>
                  <tr style="background: #1e3a8a;">
                    <th style="padding: 10px; text-align: left; font-size: 11px; font-weight: 600; color: #ffffffff; border: 1px solid #e2e8f0;"> Question Parameter</th>
                    <th style="padding: 10px; text-align: center; font-size: 11px; font-weight: 600; color: #ffffffff; border: 1px solid #e2e8f0;">Yes</th>
                    <th style="padding: 10px; text-align: center; font-size: 11px; font-weight: 600; color: #ffffffff; border: 1px solid #e2e8f0;">No</th>
                    <th style="padding: 10px; text-align: center; font-size: 11px; font-weight: 600; color: #ffffffff; border: 1px solid #e2e8f0;">N/A</th>
                    <th style="padding: 10px; text-align: center; font-size: 11px; font-weight: 600; color: #ffffffff; border: 1px solid #e2e8f0;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${questionStats.map((stat: any, index: number) => {
                    const isMainQuestion = !stat.subParam1?.toLowerCase().includes('follow-up') &&
                      !stat.subParam1?.toLowerCase().includes('followup') &&
                      !stat.subParam1?.toLowerCase().includes('additional') &&
                      !stat.subParam1?.toLowerCase().includes('sub-parameter');

                    const rowBgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                    const questionColor = isMainQuestion ? '#1e293b' : '#0369a1';
                    const fontWeight = isMainQuestion ? '600' : '500';

                    return `<tr style="background-color: ${rowBgColor};">
                      <td style="padding: 8px; font-size: 10px; color: ${questionColor}; font-weight: ${fontWeight}; border: 1px solid #e2e8f0;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                          <span title="${stat.subParam1 || "No parameter"}">${(stat.subParam1 || "No parameter").substring(0, 35)}${(stat.subParam1 || "").length > 35 ? '...' : ''}</span>
                          ${!isMainQuestion ? '<span style="font-size: 8px; color: #0ea5e9; background: #f0f9ff; padding: 1px 4px; border-radius: 2px; border: 1px solid #bae6fd; font-weight: 500;">F</span>' : ''}
                        </div>
                      </td>
                      <td style="padding: 8px; text-align: center; font-size: 10px; color: #059669; font-weight: 600; border: 1px solid #e2e8f0;">${stat.yes}</td>
                      <td style="padding: 8px; text-align: center; font-size: 10px; color: #dc2626; font-weight: 600; border: 1px solid #e2e8f0;">${stat.no}</td>
                      <td style="padding: 8px; text-align: center; font-size: 10px; color: #6b7280; font-weight: 600; border: 1px solid #e2e8f0;">${stat.na}</td>
                      <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 600; color: #1e40af; border: 1px solid #e2e8f0;">${stat.total}</td>
                    </tr>`;
                  }).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `;

        html += `</div>`; // Close Response Analysis section
      }

      // Parameters & Actions Section - Show if we have parameter data
      if (actualParameterData.length > 0) {
        html += `<div class="pdf-section" style="page-break-before: always; margin-bottom: 40px;">`;

        // FIX: Use better fallback for section name
        const sectionDisplayName = section.name || section.label || section.title || `Section ${index + 1}`;

        html += `
          <div style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px solid #1e3a8a;">
            ${sectionDisplayName} - Parameters & Actions
          </div>
          <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">
            Comprehensive analysis of parameters with corresponding actions and responsibilities
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; border: 1px solid #e2e8f0;">
            <thead>
              <tr style="background: #1e3a8a;">
                <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 600; color: white; border: none; letter-spacing: 0.5px;">
                  Main Parameters
                </th>
                <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 600; color: white; border: none; letter-spacing: 0.5px;">
                  Remarks
                </th>
                <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 600; color: white; border: none; letter-spacing: 0.5px;">
                  Action Initiated
                </th>
                <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 600; color: white; border: none; letter-spacing: 0.5px;">
                  Reason for Not OK
                </th>
                <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 600; color: white; border: none; letter-spacing: 0.5px;">
                  Responsible Person
                </th>
                <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 600; color: white; border: none; letter-spacing: 0.5px;">
                  Review
                </th>
                <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 600; color: white; border: none; letter-spacing: 0.5px;">
                  Evidence
                </th>
              </tr>
            </thead>
            <tbody>
              ${actualParameterData
                .map(
                  (param: any, index: number) => {
                    const isMainParam = !param.subParam1?.toLowerCase().includes('follow-up') &&
                      !param.subParam1?.toLowerCase().includes('followup') &&
                      !param.subParam1?.toLowerCase().includes('sub-parameter');

                    const rowBgColor = isMainParam
                      ? index % 2 === 0 ? '#ffffff' : '#f8fafc'
                      : index % 2 === 0 ? '#f0f9ff' : '#e0f2fe';

                    const paramColor = isMainParam ? '#1e293b' : '#0369a1';
                    const fontWeight = isMainParam ? '600' : '500';
                    const borderLeft = isMainParam ? 'none' : '3px solid #0ea5e9';

                    // Helper function to display actual values or "Not provided"
                    const displayValue = (value: any, defaultValue: string = 'Not provided') => {
                      if (value === null || value === undefined || value === '') {
                        return `<span style="color: #9ca3af; font-style: italic;">${defaultValue}</span>`;
                      }
                      return value;
                    };

                    return `<tr style="background-color: ${rowBgColor}; border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 10px; font-size: 11px; color: ${paramColor}; font-weight: ${fontWeight}; border-left: ${borderLeft};">
                        <div style="display: flex; align-items: center; gap: 4px;">
                          <span>${param.subParam1 || "No parameter"}</span>
                          ${!isMainParam ? '<span style="font-size: 9px; color: #0ea5e9; background: #f0f9ff; padding: 1px 4px; border-radius: 3px; border: 1px solid #bae6fd; font-weight: 500;">Follow-up</span>' : ''}
                        </div>
                      </td>
                      <td style="padding: 10px; font-size: 11px; color: #374151;">
                        ${displayValue(param.remarks, 'Not provided')}
                      </td>
                      <td style="padding: 10px; font-size: 11px; color: #374151;">
                        ${displayValue(param.actionInitiated, 'Not provided')}
                      </td>
                      <td style="padding: 10px; font-size: 11px; color: #374151;">
                        ${displayValue(param.reasonForNotOK, 'Not applicable')}
                      </td>
                      <td style="padding: 10px; font-size: 11px; color: #374151;">
                        ${displayValue(param.responsiblePerson, 'Not assigned')}
                      </td>
                      <td style="padding: 10px; font-size: 11px; color: #374151;">
                        ${displayValue(param.review, 'Pending')}
                      </td>
                      <td style="padding: 10px; font-size: 11px; color: #374151; text-align: center;">
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

        html += `</div>`; // Close Parameters & Actions section
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
  const tableHeaders = `
    <th style="padding: 10px; text-align: left; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Section Name</th>
    <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Y%</th>
    <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">N%</th>
    <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">N/A%</th>
    ${hasWeightage ? `
      <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">W</th>
      <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">YW%</th>
      <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">NW%</th>
      <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">N/AW%</th>
    ` : ''}
    <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; background: #1e3a8a; border: 1px solid #374151;">Visualization</th>
  `;

  const tableRows = sectionData.map((section, index) => {
    const rowBgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';

    return `
      <tr style="background-color: ${rowBgColor};">
        <td style="padding: 8px; font-size: 10px; font-weight: 600; color: #1e293b; border: 1px solid #e5e7eb;">${section.title}</td>
        <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #059669; border: 1px solid #e5e7eb;">${section.yesPercent.toFixed(1)}</td>
        <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #dc2626; border: 1px solid #e5e7eb;">${section.noPercent.toFixed(1)}</td>
        <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #6b7280; border: 1px solid #e5e7eb;">${section.naPercent.toFixed(1)}</td>
        ${hasWeightage ? `
          <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #1e40af; border: 1px solid #e5e7eb;">${section.weightage.toFixed(1)}</td>
          <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #059669; border: 1px solid #e5e7eb;">${section.yesWeighted.toFixed(1)}</td>
          <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #dc2626; border: 1px solid #e5e7eb;">${section.noWeighted.toFixed(1)}</td>
          <td style="padding: 8px; text-align: center; font-size: 10px; font-weight: 700; color: #6b7280; border: 1px solid #e5e7eb;">${section.naWeighted.toFixed(1)}</td>
        ` : ''}
        <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">${generateTableBarChart(section.yesPercent, section.noPercent, section.naPercent)}</td>
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
    
    /* UPDATED: Header moved to top left with specific text */
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
    
    /* FIXED: Page break handling - allow table cells to break */
    .pdf-section {
      page-break-inside: avoid;
      margin-bottom: 40px;
    }
    
    /* FIXED: Allow table cells to break naturally */
    table {
      page-break-inside: auto;
    }
    
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    
    td, th {
      page-break-inside: auto;
    }
    
    @media print {

      
      body {
        padding: 10px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .pdf-section {
        page-break-inside: avoid !important;
      }
      
      thead {
        display: table-header-group !important;
      }
      
      /* FIXED: Allow table cells to break in print */
      td, th {
        page-break-inside: auto !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- UPDATED: Header at top left with specific text -->
    
  <div class="header">
      <div class="header-content">
        <h1>3W Audit Point for Service and Assessment Report</h1>
        <p>Submitted on ${submittedDate}</p>
      </div>
      <div class="logo-container">
        ${logoBase64 ? `
          <img src="${logoBase64}" class="logo-img" alt="Company Logo" />
        ` : `
          <div style="width: 120px; height: 60px; background: #f1f5f9; border: 2px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 11px; text-align: center; border-radius: 4px;">
            Logo<br>Not Found
          </div>
        `}
      </div>
  </div>

    <!-- Page 1: Basic Information and Performance Summary -->
    <div class="pdf-section">
      ${firstSectionHTML}
    </div>
    
    <div class="pdf-section">
      ${scoreSectionHTML}
    </div>
    
    <!-- Page 2: Overall Section Performance -->
    <div class="pdf-section" style="margin-top: 20px;">
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
    
    <!-- Page 3+: Response Analysis Sections with new layout -->
    ${sectionTablesHTML}
    
    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()} • Total Assessment Score: ${overallScore.toFixed(1)}%</p>
    </div>
  </div>
</body>
</html>
`;

  const element = document.createElement("div");
  element.innerHTML = htmlContent;

  const opt = {
    margin: 10,
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
      format: [279.4, 157.1], // PowerPoint 16:9 size
      compress: true
    },
    pagebreak: {
      mode: ['css'],
      avoid: '.pdf-section'
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
