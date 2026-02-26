// utils/formanalyticsexport.ts - UPDATED VERSION
import html2pdf from "html2pdf.js";
import html2canvas from "html2canvas";

// Helper function to capture charts as images
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


// Generate section analytics HTML from data (not images)
function generateSectionAnalyticsFromData(
  sectionData: any[], 
  chartImages: Record<string, string>
): string {
  if (!sectionData.length) {
    return '';
  }

  return sectionData.map((section, index) => `
    <div class="page-break-before" style="${index > 0 ? 'page-break-before: always;' : ''}">
      <h2 class="section-title" style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
        Section Analytics: ${section.sectionTitle}
      </h2>
      
     
      <!-- Metrics Overview as HTML Table (not image) -->
      <div style="margin-bottom: 10px;">
  <h3 style="font-size: 11px; font-weight: 700; color: #374151; margin-bottom: 6px;">Section Metrics</h3>
  
  <div style="
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: flex-start;
    align-items: stretch;
  ">
    <!-- Box 1 -->
    <div style="
      flex: 1 1 130px;
      background: #f0f9ff;
      border: 1px solid #0ea5e9;
      border-radius: 4px;
      padding: 6px;
      text-align: center;
      min-width: 110px;
    ">
      <div style="font-size: 12px; font-weight: 900; color: #0ea5e9;">${section.stats.mainQuestionCount}</div>
      <div style="font-size: 8px; font-weight: 700; color: #0284c7;">Main Questions</div>
    </div>

    <!-- Box 2 -->
    <div style="
      flex: 1 1 130px;
      background: #faf5ff;
      border: 1px solid #a855f7;
      border-radius: 4px;
      padding: 6px;
      text-align: center;
      min-width: 110px;
    ">
      <div style="font-size: 12px; font-weight: 900; color: #a855f7;">${section.stats.totalFollowUpCount}</div>
      <div style="font-size: 8px; font-weight: 700; color: #9333ea;">Follow-ups</div>
    </div>

    <!-- Box 3 -->
    <div style="
      flex: 1 1 130px;
      background: #f0fdf4;
      border: 1px solid #22c55e;
      border-radius: 4px;
      padding: 6px;
      text-align: center;
      min-width: 110px;
    ">
      <div style="font-size: 12px; font-weight: 900; color: #22c55e;">${section.stats.totalAnswered}</div>
      <div style="font-size: 8px; font-weight: 700; color: #16a34a;">Answered</div>
      <div style="font-size: 7px; color: #15803d;">${section.stats.answeredMainQuestions}M + ${section.stats.answeredFollowUpQuestions}F</div>
    </div>

    <!-- Box 4 -->
    <div style="
      flex: 1 1 130px;
      background: #eff6ff;
      border: 1px solid #3b82f6;
      border-radius: 4px;
      padding: 6px;
      text-align: center;
      min-width: 110px;
    ">
      <div style="font-size: 12px; font-weight: 900; color: #3b82f6;">${section.stats.completionRate}%</div>
      <div style="font-size: 8px; font-weight: 700; color: #1d4ed8;">Completion</div>
      <div style="margin-top: 3px; background: #dbeafe; height: 2px; border-radius: 1px;">
        <div style="background: #3b82f6; height: 100%; width: ${Math.min(100, parseFloat(section.stats.completionRate))}%; border-radius: 1px;"></div>
      </div>
    </div>

    <!-- Box 5 -->
    <div style="
      flex: 1 1 130px;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 4px;
      padding: 6px;
      text-align: center;
      min-width: 110px;
    ">
      <div style="font-size: 12px; font-weight: 900; color: #f59e0b;">${section.stats.avgResponsesPerQuestion}</div>
      <div style="font-size: 8px; font-weight: 700; color: #d97706;">Avg/Question</div>
    </div>

    <!-- Box 6 -->
    <div style="
      flex: 1 1 130px;
      background: #ecfeff;
      border: 1px solid #06b6d4;
      border-radius: 4px;
      padding: 6px;
      text-align: center;
      min-width: 110px;
    ">
      <div style="font-size: 12px; font-weight: 900; color: #06b6d4;">${section.stats.totalResponses}</div>
      <div style="font-size: 8px; font-weight: 700; color: #0891b2;">Total Responses</div>
    </div>
  </div>
</div>

      
      <!-- Questions List (not image) -->
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">Question Details</h3>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; max-height: 300px; overflow-y: auto;">
          ${section.stats.questionsDetail.map((q: any, idx: number) => `
            <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; ${idx === section.stats.questionsDetail.length - 1 ? 'border-bottom: none; margin-bottom: 0; padding-bottom: 0;' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="background: #3b82f6; color: white; width: 20px; height: 20px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">${idx + 1}</span>
                    <span style="font-size: 12px; font-weight: 600; color: #1f2937;">${q.text}</span>
                  </div>
                  ${q.followUpCount > 0 ? `
                    <div style="font-size: 10px; color: #6b7280; margin-left: 28px;">
                      ${q.followUpCount} follow-up${q.followUpCount > 1 ? 's' : ''}
                    </div>
                  ` : ''}
                </div>
                <div style="text-align: right; min-width: 60px;">
                  <div style="font-size: 14px; font-weight: 700; color: #1d4ed8;">${q.responses}</div>
                  <div style="font-size: 10px; color: #6b7280;">responses</div>
                </div>
              </div>
              
              ${q.followUpDetails && q.followUpDetails.length > 0 ? `
                <div style="margin-left: 28px; margin-top: 8px; padding-left: 12px; border-left: 2px solid #dbeafe;">
                  ${q.followUpDetails.map((fq: any, fIdx: number) => `
                    <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #e5e7eb; ${fIdx === q.followUpDetails.length - 1 ? 'border-bottom: none; margin-bottom: 0; padding-bottom: 0;' : ''}">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                          <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="color: #6b7280; font-size: 10px;">•</span>
                            <span style="font-size: 11px; color: #4b5563;">${fq.text}</span>
                          </div>
                        </div>
                        <div style="text-align: right; min-width: 50px;">
                          <div style="font-size: 12px; font-weight: 600; color: #3b82f6;">${fq.responses}</div>
                          <div style="font-size: 9px; color: #9ca3af;">responses</div>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Quality and Visualization Charts -->
${section.qualityBreakdown.length > 0 ? `
  <div style="margin-bottom: 20px; page-break-before: always;">
    <!-- Main Heading -->
    <h2 style="font-size: 14px; font-weight: 700; color: #1e3a8a; margin-bottom: 15px; padding-bottom: 4px; border-bottom: 2px solid #1e3a8a;">
      ${section.sectionTitle} - Visualizations
    </h2>
    
    <!-- 2x2 Grid Layout -->
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: auto auto; gap: 15px;">
      
      <!-- Top Left: Quality Distribution Chart -->
      <div style="grid-column: 1; grid-row: 1;">
        ${chartImages[`section-pie-chart-${section.sectionId}`] ? `
          <div style="text-align: center;">
            <div style="font-size: 11px; font-weight: 600; margin-bottom: 6px; color: #4b5563;">Quality Distribution</div>
            <img src="${chartImages[`section-pie-chart-${section.sectionId}`]}" 
                 style="width: 100%; max-height: 150px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 4px;" />
          </div>
        ` : ''}
      </div>
      
      <!-- Top Right: Parameter Analysis Chart -->
      <div style="grid-column: 2; grid-row: 1;">
        ${chartImages[`section-visualization-${section.sectionId}`] ? `
          <div style="text-align: center;">
            <div style="font-size: 11px; font-weight: 600; margin-bottom: 6px; color: #4b5563;">Parameter Analysis</div>
            <img src="${chartImages[`section-visualization-${section.sectionId}`]}" 
                 style="width: 100%; max-height: 250px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 4px;" />
          </div>
        ` : ''}
      </div>
      
      <!-- Bottom Left: Overall Quality Stats -->
      <div style="grid-column: 1; grid-row: 2;">
        <h3 style="font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Overall Quality</h3>
        <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e5e7eb; text-align: center;">
          <div style="display: flex; justify-content: space-around; margin-bottom: 8px;">
            <div style="text-align: center;">
              <div style="font-size: 16px; font-weight: 900; color: #22c55e;">${section.overallQuality.percentages.yes}%</div>
              <div style="font-size: 9px; font-weight: 600; color: #16a34a; margin-top: 2px;">Yes</div>
              <div style="font-size: 8px; color: #15803d; margin-top: 1px;">${section.overallQuality.totalYes} resp</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 16px; font-weight: 900; color: #ef4444;">${section.overallQuality.percentages.no}%</div>
              <div style="font-size: 9px; font-weight: 600; color: #dc2626; margin-top: 2px;">No</div>
              <div style="font-size: 8px; color: #b91c1c; margin-top: 1px;">${section.overallQuality.totalNo} resp</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 16px; font-weight: 900; color: #9ca3af;">${section.overallQuality.percentages.na}%</div>
              <div style="font-size: 9px; font-weight: 600; color: #6b7280; margin-top: 2px;">N/A</div>
              <div style="font-size: 8px; color: #4b5563; margin-top: 1px;">${section.overallQuality.totalNA} resp</div>
            </div>
          </div>
          <div style="font-size: 9px; font-weight: 600; color: #374151; padding-top: 6px; border-top: 1px solid #e5e7eb;">
            Total Responses: <span style="color: #2563eb;">${section.overallQuality.totalYes + section.overallQuality.totalNo + section.overallQuality.totalNA}</span>
            | Parameters: <span style="color: #7c3aed;">${section.qualityBreakdown.length}</span>
          </div>
        </div>
      </div>
      
      <!-- Bottom Right: Quality Breakdown Table -->
      <div style="grid-column: 2; grid-row: 2;">
        <h3 style="font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Quality Breakdown</h3>
        <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e5e7eb; max-height: 150px; overflow-y: auto;">
          ${section.qualityBreakdown.slice(0, 5).map((param, idx) => {
            const yesPercent = param.total > 0 ? ((param.yes / param.total) * 100).toFixed(1) : '0.0';
            const noPercent = param.total > 0 ? ((param.no / param.total) * 100).toFixed(1) : '0.0';
            const naPercent = param.total > 0 ? ((param.na / param.total) * 100).toFixed(1) : '0.0';
            
            return `
              <div style="margin-bottom: ${idx < 4 ? '6px' : '0'}; padding-bottom: ${idx < 4 ? '6px' : '0'}; ${idx < 4 ? 'border-bottom: 1px dashed #e5e7eb;' : ''}">
                <div style="font-size: 9px; font-weight: 600; color: #1f2937; margin-bottom: 2px;">
                  ${param.parameterName.length > 25 ? param.parameterName.substring(0, 25) + '...' : param.parameterName}
                </div>
                <div style="display: flex; gap: 8px; font-size: 8px;">
                  <span style="color: #16a34a; font-weight: 600;">Yes: ${yesPercent}%</span>
                  <span style="color: #dc2626; font-weight: 600;">No: ${noPercent}%</span>
                  <span style="color: #6b7280; font-weight: 600;">N/A: ${naPercent}%</span>
                </div>
              </div>`;
          }).join('')}
          
          ${section.qualityBreakdown.length > 5 ? `
            <div style="font-size: 8px; color: #6b7280; text-align: center; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e5e7eb;">
              + ${section.qualityBreakdown.length - 5} more parameters
            </div>
          ` : ''}
        </div>
      </div>
      
    </div>
  </div>
` : ''}

    </div>
  `).join('');
}
// Get company logo
async function getLogoAsBase64(): Promise<string> {
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
      const response = await fetch(logoPath);
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(blob);
        });
      }
    } catch (error) {
      console.log(`Error loading from ${logoPath}:`, error);
    }
  }

  console.warn('No custom logo found, falling back to default logo');
  try {
    const defaultLogoPath = '/logoimages/logo.jpeg';
    const response = await fetch(defaultLogoPath);
    
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(blob);
      });
    }
  } catch (error) {
    console.log('Error loading default logo:', error);
  }

  return '';
}

// Generate pie chart SVG for overall quality
function generatePieChartSVG(
  yesPercent: number,
  noPercent: number,
  naPercent: number,
  counts: { yes: number; no: number; na: number; total: number }
): string {
  const size = 140;
  const radius = 55;
  const strokeWidth = 25;
  const centerX = size / 2;
  const centerY = size / 2;

  const circumference = 2 * Math.PI * radius;
  const totalPercent = yesPercent + noPercent + naPercent;
  const effectiveTotal = totalPercent > 0 ? totalPercent : 100;

  const yesAngle = (yesPercent / effectiveTotal) * 360;
  const noAngle = (noPercent / effectiveTotal) * 360;
  const naAngle = (naPercent / effectiveTotal) * 360;

  const yesDash = (yesAngle / 360) * circumference;
  const noDash = (noAngle / 360) * circumference;
  const naDash = (naAngle / 360) * circumference;

  const yesColor = "rgba(34, 197, 94, 1)"; // Green
  const noColor = "rgba(239, 68, 68, 1)"; // Red
  const naColor = "rgba(156, 163, 175, 1)"; // Gray

  // Base track
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

  // Text positions
  const scoreTextY = centerY - 5;
  const labelTextY = centerY + 10;
  const labelFontSize = 10;

  return `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display: block; margin: 0 auto;">
            ${baseTrack}
            ${naSegment}
            ${noSegment}
            ${yesSegment}
            
            <text x="${centerX}" y="${scoreTextY}" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="22" font-weight="bold" fill="#1e3a8a">
                ${((yesPercent / 100) * counts.total).toFixed(0)}
            </text>
            
            <text x="${centerX}" y="${labelTextY}" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="${labelFontSize}" fill="#3b82f6" font-weight="600">
                Yes Responses
            </text>
        </svg>
    `;
}

// Generate summary cards HTML
function generateSummaryCardsHTML(total: number): string {
  return `
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
      <!-- Total Responses -->
      <div style="padding: 16px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1.5px solid #38bdf8; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; font-weight: 900; color: #0ea5e9;">${total}</div>
        <div style="font-size: 11px; font-weight: 700; color: #0284c7; margin-top: 4px;">Total Responses</div>
      </div>
      
    </div>
  `;
}

// Generate section performance table
function generateSectionPerformanceTable(sectionSummaryRows: any[]): string {
  if (!sectionSummaryRows.length) {
    return '<div style="text-align: center; padding: 20px; color: #6b7280; font-style: italic;">No section data available</div>';
  }

  // Helper function to create bar chart
  const generateTableBarChart = (yesPercent: number, noPercent: number, naPercent: number): string => {
    const totalWidth = 150;
    const yesWidth = (yesPercent / 100) * totalWidth;
    const noWidth = (noPercent / 100) * totalWidth;
    const naWidth = (naPercent / 100) * totalWidth;

    return `
      <div style="position: relative; width: ${totalWidth}px; height: 16px; background: #f1f5f9; border-radius: 2px; overflow: hidden; border: 1px solid #e2e8f0;">
        ${yesPercent > 0 ? `
          <div style="position: absolute; left: 0; width: ${yesWidth}px; height: 100%; background: #10b981; display: flex; align-items: center; justify-content: center;">
            ${yesPercent >= 15 ? `<span style="color: white; font-size: 7px; font-weight: bold; text-shadow: 0 0 1px rgba(0,0,0,0.5);">${yesPercent.toFixed(0)}%</span>` : ''}
          </div>
        ` : ''}
        ${noPercent > 0 ? `
          <div style="position: absolute; left: ${yesWidth}px; width: ${noWidth}px; height: 100%; background: #ef4444; display: flex; align-items: center; justify-content: center;">
            ${noPercent >= 15 ? `<span style="color: white; font-size: 7px; font-weight: bold; text-shadow: 0 0 1px rgba(0,0,0,0.5);">${noPercent.toFixed(0)}%</span>` : ''}
          </div>
        ` : ''}
        ${naPercent > 0 ? `
          <div style="position: absolute; left: ${yesWidth + noWidth}px; width: ${naWidth}px; height: 100%; background: #9ca3af; display: flex; align-items: center; justify-content: center;">
            ${naPercent >= 15 ? `<span style="color: white; font-size: 7px; font-weight: bold; text-shadow: 0 0 1px rgba(0,0,0,0.5);">${naPercent.toFixed(0)}%</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  };

  return `
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; font-size: 10px; margin-top: 15px;">
      <thead>
        <tr style="background: #1e3a8a;">
          <th style="padding: 10px; text-align: left; font-size: 10px; font-weight: 700; color: white; border: 1px solid #374151;">Section</th>
          <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; border: 1px solid #374151;">Total</th>
          <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; border: 1px solid #374151;">Yes</th>
          <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; border: 1px solid #374151;">No</th>
          <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; border: 1px solid #374151;">N/A</th>
          <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; border: 1px solid #374151;">Weightage</th>
          <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; border: 1px solid #374151;">Yes × W</th>
          <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; border: 1px solid #374151;">No × W</th>
          <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; border: 1px solid #374151;">N/A × W</th>
          <th style="padding: 10px; text-align: center; font-size: 10px; font-weight: 700; color: white; border: 1px solid #374151;">Visualization</th>
        </tr>
      </thead>
      <tbody>
        ${sectionSummaryRows.map((row, index) => {
          const rowBgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
          
          return `
            <tr style="background-color: ${rowBgColor};">
              <!-- Section Column -->
              <td style="padding: 8px; font-size: 10px; font-weight: 600; color: #1e293b; border: 1px solid #e5e7eb;">
                <div style="font-weight: 700; margin-bottom: 2px;">${row.title}</div>
                <div style="font-size: 9px; color: #6b7280; font-weight: 500;">
                  Weightage: ${Number.isFinite(row.weightage) ? row.weightage.toFixed(1) : "0.0"}%
                </div>
              </td>
              
              <!-- Total Column -->
              <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
                <div style="font-weight: 700; color: #1e40af;">${row.total}</div>
                <div style="font-size: 9px; color: #6b7280; font-weight: 600;">Responses</div>
              </td>
              
              <!-- Yes Column -->
              <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
                <div style="font-weight: 700; color: #059669;">${row.yesCount}</div>
                <div style="font-size: 9px; color: #059669; font-weight: 600;">${row.yesPercent.toFixed(1)}%</div>
              </td>
              
              <!-- No Column -->
              <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
                <div style="font-weight: 700; color: #dc2626;">${row.noCount}</div>
                <div style="font-size: 9px; color: #dc2626; font-weight: 600;">${row.noPercent.toFixed(1)}%</div>
              </td>
              
              <!-- N/A Column -->
              <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
                <div style="font-weight: 700; color: #6b7280;">${row.naCount}</div>
                <div style="font-size: 9px; color: #6b7280; font-weight: 600;">${row.naPercent.toFixed(1)}%</div>
              </td>
              
              <!-- Weightage Column -->
              <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
                <div style="font-weight: 700; color: #1e40af;">${row.weightage.toFixed(1)}</div>
              </td>
              
              <!-- Yes × Weightage -->
              <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
                <div style="font-weight: 700; color: #059669;">${row.yesWeighted.toFixed(1)}</div>
              </td>
              
              <!-- No × Weightage -->
              <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
                <div style="font-weight: 700; color: #dc2626;">${row.noWeighted.toFixed(1)}</div>
              </td>
              
              <!-- N/A × Weightage -->
              <td style="padding: 8px; text-align: center; font-size: 10px; border: 1px solid #e5e7eb;">
                <div style="font-weight: 700; color: #6b7280;">${row.naWeighted.toFixed(1)}</div>
              </td>
              
              <!-- Visualization Column -->
              <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">
                ${generateTableBarChart(row.yesPercent, row.noPercent, row.naPercent)}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// Generate Section Analytics HTML
function generateSectionAnalyticsHTML(sectionAnalytics: any[]): string {
  if (!sectionAnalytics.length) {
    return '';
  }

  return sectionAnalytics.map((section, index) => `
    <div class="page-break-before" style="${index > 0 ? 'page-break-before: always;' : ''}">
      <h2 class="section-title" style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
        Section Analytics: ${section.sectionTitle}
      </h2>
      
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">Metrics Overview</h3>
        ${section.statsImage ? `
          <div style="text-align: center;">
            <img src="${section.statsImage}" style="max-width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 8px;" />
          </div>
        ` : '<p style="color: #6b7280; text-align: center; font-style: italic;">No metrics data available</p>'}
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px;">
        <div>
          <h3 style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">Quality Distribution</h3>
          ${section.qualityImage ? `
            <div style="text-align: center; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <img src="${section.qualityImage}" style="max-width: 100%; height: auto;" />
            </div>
          ` : '<p style="color: #6b7280; text-align: center; font-style: italic;">No quality data available</p>'}
        </div>
        
        <div>
          <h3 style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">Parameter Analysis</h3>
          ${section.visualizationImage ? `
            <div style="text-align: center; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
              <img src="${section.visualizationImage}" style="max-width: 100%; height: auto;" />
            </div>
          ` : '<p style="color: #6b7280; text-align: center; font-style: italic;">No visualization data available</p>'}
        </div>
      </div>
      
      
    </div>
  `).join('');
}

// Main export function
export async function exportFormAnalyticsToPDF(
  options: {
    filename: string;
    formTitle: string;
    generatedDate: string;
    totalResponses: number;
    sectionSummaryRows: any[];
    totalPieChartData: {
      yes: number;
      no: number;
      na: number;
      counts: { yes: number; no: number; na: number; total: number };
    };
    chartElementIds: string[];
    includeSectionAnalytics?: boolean; 
    sectionAnalyticsData?: any[];// New option
  }
): Promise<void> {
  const {
    filename,
    formTitle,
    generatedDate,
    totalResponses,
    sectionSummaryRows,
    totalPieChartData,
    chartElementIds = [],
    includeSectionAnalytics = true ,
    sectionAnalyticsData = [] // Default to true
  } = options;

  // Capture chart images
  const chartImages: Record<string, string> = {};
  
  for (const chartId of chartElementIds) {
    const chartImage = await captureChartAsImage(chartId);
    if (chartImage) {
      chartImages[chartId] = chartImage;
    }
  }

  

  // Get logo
  const logoBase64 = await getLogoAsBase64();

  // Generate HTML content
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
          page-break-inside: auto;
        }
        
        .performance-table tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        
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
        
        .pdf-section {
          margin-bottom: 25px;
          page-break-inside: auto;
        }
        
        .page-break-before {
          page-break-before: always;
        }
        
        .section-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          border: 1px solid #e2e8f0;
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
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        
        .chart-container {
          background: #f8fafc;
          padding: 10px; /* Reduced from 15px */
          border-radius: 6px; /* Reduced from 8px */
          border: 1px solid #e2e8f0;
          margin: 10px 0; /* Reduced from 15px */
        }
        
        .chart-title {
          font-size: 14px;
          font-weight: 600;
          color: #1e3a8a;
          margin-bottom: 6px;
          text-align: center;
        }
        
        .chart-image {
          width: 100%;
          height: auto;
          max-height: 150px;
          object-fit: contain;
        }
        
        @media print {
          body {
            padding: 10px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
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
          
          .no-break {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- PAGE 1: Header + Summary + Charts -->
        <div class="first-page">
          <!-- Header -->
          <div class="header">
            <div class="header-content">
              <h1>Form Analytics Dashboard Report</h1>
              <p>Form: ${formTitle}</p>
              <p>Generated on: ${generatedDate}</p>
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
          
          <!-- Summary Cards -->
          ${generateSummaryCardsHTML(totalResponses)}
          
          <!-- Overall Quality Section -->
          <div class="pdf-section">
            <div class="table-title">Overall Response Quality</div>
            <div style="display: flex; align-items: center; gap: 40px;">
              <div style="flex-shrink: 0; text-align: center; min-width: 140px;">
                ${generatePieChartSVG(
                  totalPieChartData.yes, 
                  totalPieChartData.no, 
                  totalPieChartData.na,
                  totalPieChartData.counts
                )}
              </div>
              <div style="flex: 1;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                  <!-- Yes Responses -->
                  <div style="text-align: center; padding: 18px; background: #c7d2fe; border-radius: 10px; border: 1.5px solid rgba(34, 197, 94, 1);">
                    <div style="font-size: 18px; font-weight: 900; color: rgba(34, 197, 94, 1)">${totalPieChartData.counts.yes}</div>
                    <div style="font-size: 12px; color: rgba(34, 197, 94, 1); font-weight: 700;">Yes Responses</div>
                    <div style="font-size: 15px; font-weight: 700; color: rgba(34, 197, 94, 1);">${totalPieChartData.yes}%</div>
                  </div>
                  <!-- No Responses -->
                  <div style="text-align: center; padding: 18px; background: #bfdbfe; border-radius: 10px; border: 1.5px solid rgba(239, 68, 68, 1);">
                    <div style="font-size: 18px; font-weight: 900; color: rgba(239, 68, 68, 1);">${totalPieChartData.counts.no}</div>
                    <div style="font-size: 12px; color: rgba(239, 68, 68, 1); font-weight: 700;">No Responses</div>
                    <div style="font-size: 15px; font-weight: 700; color: rgba(239, 68, 68, 1);">${totalPieChartData.no}%</div>
                  </div>
                  <!-- N/A Responses -->
                  <div style="text-align: center; padding: 18px; background: #dbeafe; border-radius: 10px; border: 1.5px solid rgba(156, 163, 175, 1);">
                    <div style="font-size: 18px; font-weight: 900; color: rgba(156, 163, 175, 1);">${totalPieChartData.counts.na}</div>
                    <div style="font-size: 12px; color: rgba(156, 163, 175, 1); font-weight: 700;">N/A Responses</div>
                    <div style="font-size: 15px; font-weight: 700; color: rgba(156, 163, 175, 1);">${totalPieChartData.na}%</div>
                  </div>
                </div>
                <div style="margin-top: 22px; padding-top: 12px; border-top: 1.5px solid #e5e7eb; text-align: center; font-size: 14px; font-weight: 700; color: #374151; letter-spacing: 0.5px; text-transform: uppercase;">
                  Total Questions Analyzed: <span style="color: #2563eb; font-weight: 900; margin-left: 6px;">${totalPieChartData.counts.total}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Captured Charts Section - Only 3 charts -->
          <div class="page-break-before pdf-section">
            <div class="table-title">Key Charts & Visualizations</div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
              <!-- Response Trend Chart -->
              ${chartImages['response-trend-chart'] ? `
                <div class="chart-container" style="padding: 10px; margin: 0;">
                  <div class="chart-title" style="font-size: 12px; margin-bottom: 8px;">Response Trend (Last 7 Days)</div>
                  <img src="${chartImages['response-trend-chart']}" style="width: 100%; height: 200px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 6px;" />
                </div>
              ` : ''}
              
              <!-- Overall Quality Chart -->
              ${chartImages['overall-quality-chart'] ? `
                <div class="chart-container" style="padding: 10px; margin: 0;">
                  <div class="chart-title" style="font-size: 12px; margin-bottom: 8px;">Overall Quality Distribution</div>
                  <img src="${chartImages['overall-quality-chart']}" style="width: 100%; height: 180px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 6px;" />
                </div>
              ` : ''}
              
              <!-- Location Heatmap -->
              ${chartImages['location-heatmap'] ? `
                <div class="chart-container" style="padding: 10px; margin: 0;">
                  <div class="chart-title" style="font-size: 12px; margin-bottom: 8px;">Response Locations Heatmap</div>
                  <img src="${chartImages['location-heatmap']}" style="width: 100%; height: 200px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 6px;" />
                </div>
              ` : ''}
            </div>
          </div>
        
        <!-- PAGE 2: Section Performance Table -->
        <div class="page-break-before">
          <div class="table-title">Section Performance Analysis</div>
          ${generateSectionPerformanceTable(sectionSummaryRows)}
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
        

         <!-- SECTION ANALYTICS PAGES (using data, not images) -->
        ${sectionAnalyticsData.length > 0 ? generateSectionAnalyticsFromData(sectionAnalyticsData, chartImages) : ''}
        
        <!--<div class="footer">
          <p>Report generated on ${generatedDate} • Form: ${formTitle} • Total Responses: ${totalResponses}</p>
        </div>-->
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

// Export function to be called from FormAnalyticsDashboard
export async function exportDashboardToPDF(
  formTitle: string,
  analyticsData: {
    total: number;
    pending: number;
    verified: number;
    rejected: number;
    sectionSummaryRows: any[];
    totalPieChartData: {
      yes: number;
      no: number;
      na: number;
      counts: { yes: number; no: number; na: number; total: number };
    };
  },
  includeSectionAnalytics: boolean = true
): Promise<boolean> {
  try {
    // Define ONLY the 3 chart IDs to capture
    const chartElementIds = [
      'response-trend-chart',
      'overall-quality-chart',
      'location-heatmap'
    ].filter(id => document.getElementById(id));

    await exportFormAnalyticsToPDF({
      filename: `${formTitle.replace(/\s+/g, '_')}_Analytics_${new Date().toISOString().split('T')[0]}.pdf`,
      formTitle: formTitle,
      generatedDate: new Date().toLocaleString(),
      totalResponses: analyticsData.total,
      sectionSummaryRows: analyticsData.sectionSummaryRows,
      totalPieChartData: analyticsData.totalPieChartData,
      chartElementIds: chartElementIds,
      includeSectionAnalytics: includeSectionAnalytics
    });

    return true;
  } catch (error) {
    console.error('Error exporting dashboard to PDF:', error);
    return false;
  }
}