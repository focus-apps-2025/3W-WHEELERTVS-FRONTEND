import html2pdf from "html2pdf.js";

function generateSectionTables(
  availableSections: any[],
  sectionQuestionStats: Record<string, any[]>,
  sectionMainParameters: Record<string, any[]>
): string {
  return availableSections
    .map((section: any) => {
      const questionStats = sectionQuestionStats[section.id] || [];
      const mainParams = sectionMainParameters[section.id] || [];

      if (questionStats.length === 0 && mainParams.length === 0) return "";

      const sectionTotals = questionStats.reduce(
        (totals: any, stat: any) => ({
          yes: totals.yes + stat.yes,
          no: totals.no + stat.no,
          na: totals.na + stat.na,
          total: totals.total + stat.total,
        }),
        { yes: 0, no: 0, na: 0, total: 0 }
      );

      let html = "";

      if (questionStats.length > 0) {
        const yesPercent =
          sectionTotals.total > 0
            ? ((sectionTotals.yes / sectionTotals.total) * 100).toFixed(1)
            : 0;
        const noPercent =
          sectionTotals.total > 0
            ? ((sectionTotals.no / sectionTotals.total) * 100).toFixed(1)
            : 0;
        const naPercent =
          sectionTotals.total > 0
            ? ((sectionTotals.na / sectionTotals.total) * 100).toFixed(1)
            : 0;

        html += `<div style="page-break-inside: avoid; margin-top: 40px;">
          <div style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px solid #1e3a8a;">
            ${section.name || section.label || "Section"} - Response Analysis
          </div>
          <p style="font-size: 12px; color: #64748b; margin-bottom: 20px;">
            Detailed breakdown of responses with performance metrics
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #e2e8f0;">
            <thead>
              <tr style="background: #1e3a8a;">
                <th style="padding: 14px; text-align: left; font-size: 12px; font-weight: 600; color: white; border: none; letter-spacing: 0.5px;">
                  Question Parameter
                </th>
                <th style="padding: 14px; text-align: center; font-size: 12px; font-weight: 600; color: white; border: none; letter-spacing: 0.5px;">
                  Yes
                </th>
                <th style="padding: 14px; text-align: center; font-size: 12px; font-weight: 600; color: white; border: none; letter-spacing: 0.5px;">
                  No
                </th>
                <th style="padding: 14px; text-align: center; font-size: 12px; font-weight: 600; color: white; border: none; letter-spacing: 0.5px;">
                  N/A
                </th>
                <th style="padding: 14px; text-align: center; font-size: 12px; font-weight: 600; color: white; border: none; letter-spacing: 0.5px;">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              ${questionStats
                .map((stat: any, index: number) => {
                  const isMainQuestion =
                    !stat.subParam1?.toLowerCase().includes("follow-up") &&
                    !stat.subParam1?.toLowerCase().includes("followup") &&
                    !stat.subParam1?.toLowerCase().includes("additional") &&
                    !stat.subParam1?.toLowerCase().includes("sub-parameter");

                  const rowBgColor = isMainQuestion
                    ? index % 2 === 0
                      ? "#ffffff"
                      : "#f8fafc"
                    : index % 2 === 0
                    ? "#f0f9ff"
                    : "#e0f2fe";

                  const questionColor = isMainQuestion ? "#1e293b" : "#0369a1";
                  const fontWeight = isMainQuestion ? "600" : "500";
                  const indent = isMainQuestion ? "0px" : "16px";
                  const borderLeft = isMainQuestion
                    ? "none"
                    : "3px solid #0ea5e9";

                  return `<tr style="background-color: ${rowBgColor}; border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 12px; font-size: 12px; color: ${questionColor}; font-weight: ${fontWeight}; border-left: ${borderLeft}; padding-left: ${indent};">
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span>${stat.subParam1 || "No parameter"}</span>
                          ${
                            !isMainQuestion
                              ? '<span style="font-size: 10px; color: #0ea5e9; background: #f0f9ff; padding: 2px 6px; border-radius: 4px; border: 1px solid #bae6fd; font-weight: 500;">Follow-up</span>'
                              : ""
                          }
                        </div>
                      </td>
                      <td style="padding: 12px; text-align: center; font-size: 12px; color: #059669; font-weight: 600;">
                        ${stat.yes}
                      </td>
                      <td style="padding: 12px; text-align: center; font-size: 12px; color: #dc2626; font-weight: 600;">
                        ${stat.no}
                      </td>
                      <td style="padding: 12px; text-align: center; font-size: 12px; color: #6b7280; font-weight: 600;">
                        ${stat.na}
                      </td>
                      <td style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: #1e40af; border-left: 1px solid #e2e8f0;">
                        ${stat.total}
                      </td>
                    </tr>`;
                })
                .join("")}
              <tr style="background: #1e3a8a; font-weight: 600;">
                <td style="padding: 14px; font-size: 12px; color: white; font-weight: 600;">
                  Section Summary
                </td>
                <td style="padding: 14px; text-align: center; font-size: 12px; color: #10b981; font-weight: 600; background: rgba(255, 255, 255, 0.1);">
                  ${yesPercent}%
                </td>
                <td style="padding: 14px; text-align: center; font-size: 12px; color: #ef4444; font-weight: 600; background: rgba(255, 255, 255, 0.1);">
                  ${noPercent}%
                </td>
                <td style="padding: 14px; text-align: center; font-size: 12px; color: #d1d5db; font-weight: 600; background: rgba(255, 255, 255, 0.1);">
                  ${naPercent}%
                </td>
                <td style="padding: 14px; text-align: center; font-size: 12px; color: white; font-weight: 600; background: rgba(255, 255, 255, 0.2); border-left: 1px solid rgba(255,255,255,0.3);">
                  ${sectionTotals.total}
                </td>
              </tr>
            </tbody>
          </table>
        </div>`;
      }

      if (mainParams.length > 0) {
        html += `<div style="page-break-inside: avoid; margin-top: 40px;">
          <div style="font-size: 18px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px solid #1e3a8a;">
            ${section.name || section.label || "Section"} - Parameters & Actions
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
              ${mainParams
                .map((param: any, index: number) => {
                  const isMainParam =
                    !param.subParam1?.toLowerCase().includes("follow-up") &&
                    !param.subParam1?.toLowerCase().includes("followup") &&
                    !param.subParam1?.toLowerCase().includes("sub-parameter");

                  const rowBgColor = isMainParam
                    ? index % 2 === 0
                      ? "#ffffff"
                      : "#f8fafc"
                    : index % 2 === 0
                    ? "#f0f9ff"
                    : "#e0f2fe";

                  const paramColor = isMainParam ? "#1e293b" : "#0369a1";
                  const fontWeight = isMainParam ? "600" : "500";
                  const borderLeft = isMainParam ? "none" : "3px solid #0ea5e9";

                  return `<tr style="background-color: ${rowBgColor}; border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 10px; font-size: 11px; color: ${paramColor}; font-weight: ${fontWeight}; border-left: ${borderLeft};">
                        <div style="display: flex; align-items: center; gap: 4px;">
                          <span>${param.subParam1 || "No parameter"}</span>
                          ${
                            !isMainParam
                              ? '<span style="font-size: 9px; color: #0ea5e9; background: #f0f9ff; padding: 1px 4px; border-radius: 3px; border: 1px solid #bae6fd; font-weight: 500;">Follow-up</span>'
                              : ""
                          }
                        </div>
                      </td>
                      <td style="padding: 10px; font-size: 11px; color: #374151;">
                        ${
                          param.remarks ||
                          '<span style="color: #9ca3af; font-style: italic;">Not provided</span>'
                        }
                      </td>
                      <td style="padding: 10px; font-size: 11px; color: #374151;">
                        ${
                          param.actionInitiated ||
                          '<span style="color: #9ca3af; font-style: italic;">Not provided</span>'
                        }
                      </td>
                      <td style="padding: 10px; font-size: 11px; color: #374151;">
                        ${
                          param.reasonForNotOK ||
                          '<span style="color: #9ca3af; font-style: italic;">Not applicable</span>'
                        }
                      </td>
                      <td style="padding: 10px; font-size: 11px; color: #374151;">
                        ${
                          param.responsiblePerson ||
                          '<span style="color: #9ca3af; font-style: italic;">Not assigned</span>'
                        }
                      </td>
                      <td style="padding: 10px; font-size: 11px; color: #374151;">
                        ${
                          param.review ||
                          '<span style="color: #9ca3af; font-style: italic;">Pending</span>'
                        }
                      </td>
                      <td style="padding: 10px; font-size: 11px; color: #374151; text-align: center;">
                        ${
                          param.files && param.files.length > 0
                            ? '<span style="color: #059669; font-weight: 600;">Attached</span>'
                            : '<span style="color: #6b7280; font-style: italic;">No files</span>'
                        }
                      </td>
                    </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>`;
      }

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
}

export async function generateAndDownloadPDF(
  options: PDFOptions
): Promise<void> {
  const {
    filename,
    formTitle,
    submittedDate,
    sectionStats,
    sectionSummaryRows,
    sectionQuestionStats = {},
    sectionMainParameters = {},
    availableSections = [],
    form,
    response,
  } = options;

  const totalYes = sectionStats.reduce((sum, stat) => sum + stat.yes, 0);
  const totalNo = sectionStats.reduce((sum, stat) => sum + stat.no, 0);
  const totalNA = sectionStats.reduce((sum, stat) => sum + stat.na, 0);
  const totalQuestions = sectionStats.reduce(
    (sum, stat) => sum + stat.total,
    0
  );

  const yesPercentage =
    totalQuestions > 0 ? ((totalYes / totalQuestions) * 100).toFixed(1) : "0.0";
  const noPercentage =
    totalQuestions > 0 ? ((totalNo / totalQuestions) * 100).toFixed(1) : "0.0";
  const naPercentage =
    totalQuestions > 0 ? ((totalNA / totalQuestions) * 100).toFixed(1) : "0.0";

  const overallScore = parseFloat(yesPercentage);

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return "#16a34a";
    if (score >= 75) return "#2563eb";
    if (score >= 60) return "#ca8a04";
    return "#dc2626";
  };

  // Create HTML for PDF
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
          padding: 30px;
          color: #1f2937;
          line-height: 1.5;
        }
        
        .container {
          max-width: 900px;
          margin: 0 auto;
          background: white;
        }
        
        .header {
          border-bottom: 2px solid #1e3a8a;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          color: #1e3a8a;
          margin-bottom: 8px;
        }
        
        .header p {
          font-size: 14px;
          color: #64748b;
        }
        
        .summary-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 40px;
          page-break-inside: avoid;
        }
        
        .score-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        
        .score-circle {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          background: ${getScoreBgColor(overallScore)};
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          border: 4px solid #f8fafc;
        }
        
        .score-text {
          font-size: 32px;
          font-weight: 700;
          color: white;
          line-height: 1;
        }
        
        .score-label {
          font-size: 12px;
          color: white;
          font-weight: 600;
          margin-top: 4px;
        }
        
        .yes-count {
          font-size: 24px;
          font-weight: 700;
          color: ${getScoreBgColor(overallScore)};
          margin-bottom: 4px;
        }
        
        .yes-label {
          font-size: 14px;
          color: #64748b;
          font-weight: 600;
        }
        
        .breakdown-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        
        .form-info {
          margin-bottom: 24px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 6px;
          border-left: 4px solid #1e3a8a;
        }
        
        .form-info h3 {
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 4px;
        }
        
        .form-info p {
          font-size: 13px;
          color: #64748b;
        }
        
        .percentage-item {
          margin-bottom: 20px;
        }
        
        .percentage-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        
        .percentage-label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }
        
        .percentage-value {
          font-size: 13px;
          font-weight: 700;
        }
        
        .percentage-bar-bg {
          width: 100%;
          height: 12px;
          background-color: #e5e7eb;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 4px;
        }
        
        .percentage-bar-fill {
          height: 100%;
          border-radius: 6px;
        }
        
        .yes-bar { background: #10b981; }
        .no-bar { background: #ef4444; }
        .na-bar { background: #9ca3af; }
        
        .percentage-info {
          font-size: 11px;
          color: #6b7280;
        }
        
        .yes-value { color: #059669; }
        .no-value { color: #dc2626; }
        .na-value { color: #6b7280; }
        
        .table-section {
          margin-top: 40px;
          page-break-inside: avoid;
        }
        
        .table-title {
          font-size: 18px;
          font-weight: 700;
          color: #1e3a8a;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e5e7eb;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          border: 1px solid #e5e7eb;
        }
        
        th {
          background: #1e3a8a;
          padding: 14px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: white;
          border: none;
        }
        
        td {
          padding: 12px;
          font-size: 12px;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
        }
        
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 11px;
          color: #6b7280;
          text-align: center;
        }
        
        @media print {
          body {
            padding: 20px;
          }
          .summary-section {
            page-break-inside: avoid;
          }
          .table-section {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${formTitle}</h1>
          <p>Assessment Report • Submitted on ${submittedDate}</p>
        </div>
        
        <div class="summary-section">
          <div class="score-container">
            <div class="score-circle">
              <div class="score-text">${yesPercentage}%</div>
              <div class="score-label">Overall Score</div>
            </div>
            <div class="yes-count">${totalYes}</div>
            <div class="yes-label">Positive Responses</div>
          </div>
          
          <div class="breakdown-container">
            <div class="form-info">
              <h3>Performance Summary</h3>
              <p>Comprehensive analysis across all assessment sections</p>
            </div>
            
            <div class="percentage-item">
              <div class="percentage-header">
                <span class="percentage-label">Positive Responses</span>
                <span class="percentage-value yes-value">${yesPercentage}%</span>
              </div>
              <div class="percentage-bar-bg">
                <div class="percentage-bar-fill yes-bar" style="width: ${yesPercentage}%"></div>
              </div>
              <div class="percentage-info">${totalYes} out of ${totalQuestions} questions</div>
            </div>
            
            <div class="percentage-item">
              <div class="percentage-header">
                <span class="percentage-label">Issues Identified</span>
                <span class="percentage-value no-value">${noPercentage}%</span>
              </div>
              <div class="percentage-bar-bg">
                <div class="percentage-bar-fill no-bar" style="width: ${noPercentage}%"></div>
              </div>
              <div class="percentage-info">${totalNo} items requiring attention</div>
            </div>
            
            <div class="percentage-item">
              <div class="percentage-header">
                <span class="percentage-label">Not Applicable</span>
                <span class="percentage-value na-value">${naPercentage}%</span>
              </div>
              <div class="percentage-bar-bg">
                <div class="percentage-bar-fill na-bar" style="width: ${naPercentage}%"></div>
              </div>
              <div class="percentage-info">${totalNA} non-applicable items</div>
            </div>
          </div>
        </div>
        
        <div class="table-section">
          <div class="table-title">Section Performance Analysis</div>
          <table>
            <thead>
              <tr>
                <th>Section</th>
                <th>Yes %</th>
                <th>No %</th>
                <th>N/A %</th>
                <th>Weightage</th>
                <th>Yes % × Weightage</th>
                <th>No % × Weightage</th>
                <th>N/A % × Weightage</th>
              </tr>
            </thead>
            <tbody>
              ${sectionStats
                .map((stat) => {
                  let weightage = stat.weightage;
                  if (typeof weightage === "string") {
                    weightage = parseFloat(weightage);
                  }
                  weightage = Number.isFinite(weightage) ? weightage : 0;
                  if (weightage > 0 && weightage < 1) {
                    weightage = weightage * 100;
                  }

                  const yesPercent = stat.total
                    ? (stat.yes / stat.total) * 100
                    : 0;
                  const noPercent = stat.total
                    ? (stat.no / stat.total) * 100
                    : 0;
                  const naPercent = stat.total
                    ? (stat.na / stat.total) * 100
                    : 0;
                  const yesWeighted = (yesPercent * weightage) / 100;
                  const noWeighted = (noPercent * weightage) / 100;
                  const naWeighted = (naPercent * weightage) / 100;

                  return `
                    <tr>
                      <td style="font-weight: 600; color: #1e293b;">${
                        stat.title
                      }</td>
                      <td style="color: #059669; font-weight: 600;">${yesPercent.toFixed(
                        1
                      )}%</td>
                      <td style="color: #dc2626; font-weight: 600;">${noPercent.toFixed(
                        1
                      )}%</td>
                      <td style="color: #6b7280; font-weight: 600;">${naPercent.toFixed(
                        1
                      )}%</td>
                      <td style="color: #1e40af; font-weight: 600;">${weightage.toFixed(
                        1
                      )}%</td>
                      <td style="color: #059669; font-weight: 600;">${yesWeighted.toFixed(
                        1
                      )}%</td>
                      <td style="color: #dc2626; font-weight: 600;">${noWeighted.toFixed(
                        1
                      )}%</td>
                      <td style="color: #6b7280; font-weight: 600;">${naWeighted.toFixed(
                        1
                      )}%</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>

        ${
          sectionSummaryRows && sectionSummaryRows.length > 0
            ? `
        <div class="table-section">
          <div class="table-title">Weighted Performance Metrics</div>
          <table>
            <thead>
              <tr>
                <th>Section</th>
                <th>Yes % × Weightage</th>
                <th>No % × Weightage</th>
                <th>N/A % × Weightage</th>
              </tr>
            </thead>
            <tbody>
              ${sectionSummaryRows
                .map(
                  (row) => `
                  <tr>
                    <td style="font-weight: 600; color: #1e293b;">${
                      row.title
                    }</td>
                    <td style="color: #059669; font-weight: 600;">${row.yesWeighted.toFixed(
                      1
                    )}%</td>
                    <td style="color: #dc2626; font-weight: 600;">${row.noWeighted.toFixed(
                      1
                    )}%</td>
                    <td style="color: #6b7280; font-weight: 600;">${row.naWeighted.toFixed(
                      1
                    )}%</td>
                  </tr>
                `
                )
                .join("")}
            </tbody>
          </table>
        </div>
        `
            : ""
        }
        
        ${generateSectionTables(
          availableSections,
          sectionQuestionStats,
          sectionMainParameters
        )}
        
        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()}</p>
          
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
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, logging: false },
    jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
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
