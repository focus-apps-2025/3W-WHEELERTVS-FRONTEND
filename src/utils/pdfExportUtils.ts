import html2pdf from "html2pdf.js";

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
}

export async function generateAndDownloadPDF(options: PDFOptions): Promise<void> {
  const { filename, formTitle, submittedDate, sectionStats, sectionSummaryRows } = options;

  const totalYes = sectionStats.reduce((sum, stat) => sum + stat.yes, 0);
  const totalNo = sectionStats.reduce((sum, stat) => sum + stat.no, 0);
  const totalNA = sectionStats.reduce((sum, stat) => sum + stat.na, 0);
  const totalQuestions = sectionStats.reduce((sum, stat) => sum + stat.total, 0);

  const yesPercentage =
    totalQuestions > 0 ? ((totalYes / totalQuestions) * 100).toFixed(1) : "0.0";
  const noPercentage =
    totalQuestions > 0 ? ((totalNo / totalQuestions) * 100).toFixed(1) : "0.0";
  const naPercentage =
    totalQuestions > 0 ? ((totalNA / totalQuestions) * 100).toFixed(1) : "0.0";

  const overallScore = parseFloat(yesPercentage);

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return "#16a34a"; // green-600
    if (score >= 75) return "#2563eb"; // blue-600
    if (score >= 60) return "#ca8a04"; // yellow-600
    return "#dc2626"; // red-600
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
          background: white;
          padding: 40px;
          color: #1f2937;
        }
        
        .container {
          max-width: 900px;
          margin: 0 auto;
        }
        
        .header {
          margin-bottom: 40px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 20px;
        }
        
        .header h1 {
          font-size: 32px;
          font-weight: bold;
          color: #111827;
          margin-bottom: 8px;
        }
        
        .header p {
          font-size: 14px;
          color: #6b7280;
        }
        
        .summary-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-bottom: 40px;
          page-break-inside: avoid;
        }
        
        .score-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        
        .score-circle {
          width: 160px;
          height: 160px;
          border-radius: 50%;
          background-color: ${getScoreBgColor(overallScore)};
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .score-text {
          font-size: 48px;
          font-weight: bold;
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
          font-size: 36px;
          font-weight: bold;
          color: ${getScoreBgColor(overallScore)};
          margin-bottom: 4px;
        }
        
        .yes-label {
          font-size: 14px;
          color: #6b7280;
          font-weight: 600;
        }
        
        .breakdown-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        
        .form-info {
          margin-bottom: 30px;
        }
        
        .form-info h3 {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 4px;
        }
        
        .form-info p {
          font-size: 13px;
          color: #6b7280;
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
          font-weight: bold;
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
          transition: width 0.3s ease;
        }
        
        .yes-bar { background: linear-gradient(to right, #10b981, #059669); }
        .no-bar { background: linear-gradient(to right, #ef4444, #dc2626); }
        .na-bar { background: linear-gradient(to right, #9ca3af, #6b7280); }
        
        .percentage-info {
          font-size: 11px;
          color: #9ca3af;
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
          font-weight: 600;
          color: #111827;
          margin-bottom: 16px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        
        th {
          background-color: #f3f4f6;
          padding: 12px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
        }
        
        td {
          padding: 12px;
          font-size: 12px;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
        }
        
        tr:nth-child(even) {
          background-color: #f9fafb;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
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
          <p>Submitted on ${submittedDate}</p>
        </div>
        
        <div class="summary-section">
          <div class="score-container">
            <div class="score-circle">
              <div class="score-text">${yesPercentage}%</div>
              <div class="score-label">Overall Score</div>
            </div>
            <div class="yes-count">${totalYes}</div>
            <div class="yes-label">Yes Responses</div>
          </div>
          
          <div class="breakdown-container">
            <div class="form-info">
              <h3>${formTitle}</h3>
              <p>Submitted on ${submittedDate}</p>
            </div>
            
            <div class="percentage-item">
              <div class="percentage-header">
                <span class="percentage-label">Yes</span>
                <span class="percentage-value yes-value">${yesPercentage}%</span>
              </div>
              <div class="percentage-bar-bg">
                <div class="percentage-bar-fill yes-bar" style="width: ${yesPercentage}%"></div>
              </div>
              <div class="percentage-info">${totalYes} out of ${totalQuestions} questions</div>
            </div>
            
            <div class="percentage-item">
              <div class="percentage-header">
                <span class="percentage-label">No</span>
                <span class="percentage-value no-value">${noPercentage}%</span>
              </div>
              <div class="percentage-bar-bg">
                <div class="percentage-bar-fill no-bar" style="width: ${noPercentage}%"></div>
              </div>
              <div class="percentage-info">${totalNo} out of ${totalQuestions} questions</div>
            </div>
            
            <div class="percentage-item">
              <div class="percentage-header">
                <span class="percentage-label">N/A</span>
                <span class="percentage-value na-value">${naPercentage}%</span>
              </div>
              <div class="percentage-bar-bg">
                <div class="percentage-bar-fill na-bar" style="width: ${naPercentage}%"></div>
              </div>
              <div class="percentage-info">${totalNA} out of ${totalQuestions} questions</div>
            </div>
          </div>
        </div>
        
        <div class="table-section">
          <div class="table-title">Section-wise Breakdown</div>
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

                  const yesPercent = stat.total ? (stat.yes / stat.total) * 100 : 0;
                  const noPercent = stat.total ? (stat.no / stat.total) * 100 : 0;
                  const naPercent = stat.total ? (stat.na / stat.total) * 100 : 0;
                  const yesWeighted = (yesPercent * weightage) / 100;
                  const noWeighted = (noPercent * weightage) / 100;
                  const naWeighted = (naPercent * weightage) / 100;

                  return `
                    <tr>
                      <td>${stat.title}</td>
                      <td>${yesPercent.toFixed(1)}%</td>
                      <td>${noPercent.toFixed(1)}%</td>
                      <td>${naPercent.toFixed(1)}%</td>
                      <td>${weightage.toFixed(1)}%</td>
                      <td>${yesWeighted.toFixed(1)}%</td>
                      <td>${noWeighted.toFixed(1)}%</td>
                      <td>${naWeighted.toFixed(1)}%</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>

        ${sectionSummaryRows && sectionSummaryRows.length > 0 ? `
        <div class="table-section">
          <div class="table-title">Section-wise Weighted Percentages (Chart Data)</div>
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
                .map((row) => `
                  <tr>
                    <td>${row.title}</td>
                    <td>${row.yesWeighted.toFixed(1)}%</td>
                    <td>${row.noWeighted.toFixed(1)}%</td>
                    <td>${row.naWeighted.toFixed(1)}%</td>
                  </tr>
                `)
                .join("")}
            </tbody>
          </table>
        </div>
        ` : ''}
        
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
