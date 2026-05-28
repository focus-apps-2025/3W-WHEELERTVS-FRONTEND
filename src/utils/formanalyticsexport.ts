// utils/formanalyticsexport.ts - FINAL VERSION FOR PROFESSIONAL A4 PDF
import html2canvas from "html2canvas";
import { apiClient } from "../api/client";

// Helper function to capture charts as images
async function captureChartAsImage(chartElementId: string): Promise<string> {
  const chartElement = document.getElementById(chartElementId);
  if (!chartElement) {
    console.warn(`Chart element not found: ${chartElementId}`);
    return "";
  }

  try {
    const waitTime = chartElementId.includes("trend") ? 2500 : 1200;
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    const rect = chartElement.getBoundingClientRect();
    const isBarChart =
      chartElementId.includes("defect") ||
      chartElementId.includes("distribution");
    const width = isBarChart
      ? Math.max(1400, rect.width)
      : rect.width || chartElement.offsetWidth || 1200;
    const height = rect.height || chartElement.offsetHeight || 800;

    const canvas = await html2canvas(chartElement, {
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: width,
      height: height,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(chartElementId);
        if (clonedElement) {
          clonedElement.style.visibility = "visible";
          clonedElement.style.display = "block";
          clonedElement.style.opacity = "1";
          clonedElement.style.background = "#ffffff";
          clonedElement.style.padding = "20px";
          clonedElement.style.border = "none";
          clonedElement.style.boxShadow = "none";
          clonedElement.style.borderRadius = "0";

          if (isBarChart) {
            clonedElement.style.width = `${width}px`;
            clonedElement.style.height = "auto";
            clonedElement.style.minHeight = "500px";
          }

          const style = clonedDoc.createElement("style");
          style.innerHTML = `
            * { 
              transition: none !important; 
              animation: none !important; 
              -webkit-transition: none !important;
              -webkit-animation: none !important;
            }
            [data-pdf-hide="true"] { display: none !important; }
            .bg-gradient-to-r { background-image: none !important; }
            .from-amber-400 { background-color: #fbbf24 !important; }
            .to-amber-500 { background-color: #f59e0b !important; }
            .from-red-400 { background-color: #f87171 !important; }
            .to-red-500 { background-color: #ef4444 !important; }
            .shadow-inner { box-shadow: none !important; }
          `;
          clonedDoc.head.appendChild(style);
        }
      },
    });

    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    return dataUrl.length > 500 ? dataUrl : "";
  } catch (error) {
    console.error(`Error capturing chart ${chartElementId}:`, error);
    return "";
  }
}

// Generate section performance table
function generateSectionPerformanceTable(sectionSummaryRows: any[]): string {
  if (!sectionSummaryRows.length) {
    return '<div style="text-align: center; padding: 10px; color: #6b7280; font-style: italic; font-size: 10px;">No section data available</div>';
  }

  const generateTableBarChart = (
    yesPercent: number,
    noPercent: number,
    naPercent: number,
  ): string => {
    const totalWidth = 140;
    const yesWidth = (yesPercent / 100) * totalWidth;
    const noWidth = (noPercent / 100) * totalWidth;
    const naWidth = (naPercent / 100) * totalWidth;
    return `
      <div style="position: relative; width: ${totalWidth}px; height: 12px; background: #f1f5f9; border-radius: 2px; overflow: hidden; border: 1px solid #e2e8f0;">
        ${yesPercent > 0 ? `<div style="position: absolute; left: 0; width: ${yesWidth}px; height: 100%; background: #10b981;"></div>` : ""}
        ${noPercent > 0 ? `<div style="position: absolute; left: ${yesWidth}px; width: ${noWidth}px; height: 100%; background: #ef4444;"></div>` : ""}
        ${naPercent > 0 ? `<div style="position: absolute; left: ${yesWidth + noWidth}px; width: ${naWidth}px; height: 100%; background: #9ca3af;"></div>` : ""}
      </div>
    `;
  };

  return `
    <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #e5e7eb; font-size: 8px;">
      <thead>
        <tr style="background: #1e3a8a;">
          <th style="padding: 5px; text-align: left; color: white; border: 1px solid #374151;">Section</th>
          <th style="padding: 5px; text-align: center; color: white; border: 1px solid #374151;">Total</th>
          <th style="padding: 5px; text-align: center; color: white; border: 1px solid #374151;">Yes (%)</th>
          <th style="padding: 5px; text-align: center; color: white; border: 1px solid #374151;">No (%)</th>
          <th style="padding: 5px; text-align: center; color: white; border: 1px solid #374151;">Visualization</th>
        </tr>
      </thead>
      <tbody>
        ${sectionSummaryRows
          .map(
            (row, index) => `
          <tr style="background-color: ${index % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 4px 5px; font-weight: 700; color: #1e293b; border: 1px solid #e5e7eb;">${row.title}</td>
            <td style="padding: 4px 5px; text-align: center; border: 1px solid #e5e7eb;">${row.total}</td>
            <td style="padding: 4px 5px; text-align: center; color: #059669; font-weight: 700; border: 1px solid #e5e7eb;">${row.yesPercent.toFixed(1)}%</td>
            <td style="padding: 4px 5px; text-align: center; color: #dc2626; font-weight: 700; border: 1px solid #e5e7eb;">${row.noPercent.toFixed(1)}%</td>
            <td style="padding: 4px 5px; text-align: center; border: 1px solid #e5e7eb;">${generateTableBarChart(row.yesPercent, row.noPercent, row.naPercent)}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

// Generate Inspection Summary Table HTML
function generateInspectionSummaryTable(
  summary: any[],
  statuses: string[],
): string {
  if (!summary || !summary.length) return "";
  return `
    <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #e5e7eb; font-size: 7.5px;">
      <thead>
        <tr style="background: #1e3a8a;">
          <th style="padding: 4px 5px; text-align: left; color: white; border: 1px solid #374151;">Date</th>
          <th style="padding: 4px 5px; text-align: left; color: white; border: 1px solid #374151;">Shift</th>
          <th style="padding: 4px 5px; text-align: left; color: white; border: 1px solid #374151;">QC Inspector</th>
          <th style="padding: 4px 5px; text-align: center; color: white; border: 1px solid #374151;">Total</th>
          ${statuses.map((status) => `<th style="padding: 4px 5px; text-align: center; color: white; border: 1px solid #374151;">${status}</th>`).join("")}
          <th style="padding: 4px 5px; text-align: center; color: white; border: 1px solid #374151;">Dispatched</th>
          <th style="padding: 4px 5px; text-align: center; color: white; border: 1px solid #374151;">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${summary
          .map(
            (row, index) => `
          <tr style="background-color: ${index % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 3px 5px; border: 1px solid #e5e7eb;">${row.date || "N/A"}</td>
            <td style="padding: 3px 5px; border: 1px solid #e5e7eb;">${row.shift || "N/A"}</td>
            <td style="padding: 3px 5px; border: 1px solid #e5e7eb;">${row.qcInspector || "N/A"}</td>
            <td style="padding: 3px 5px; text-align: center; font-weight: 700; border: 1px solid #e5e7eb;">${row.totalInspection || 0}</td>
            ${statuses
              .map((status) => {
                const count = row.statusCounts?.[status] || 0;
                let color = "#3b82f6";
                if (status === "Direct Ok" || status === "Rework Accepted")
                  color = "#10b981";
                else if (status.startsWith("Rework")) color = "#f59e0b";
                else if (status === "Rejected") color = "#ef4444";
                return `<td style="padding: 3px 5px; text-align: center; font-weight: 700; color: ${color}; border: 1px solid #e5e7eb;">${count}</td>`;
              })
              .join("")}
            <td style="padding: 3px 5px; text-align: center; font-weight: 700; border: 1px solid #e5e7eb;">${row.dispatched || 0}</td>
            <td style="padding: 3px 5px; text-align: center; border: 1px solid #e5e7eb;">-</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

// Generate pie chart SVG for overall quality
function generatePieChartSVG(
  directPercent: number,
  reworkCompPercent: number,
  noPercent: number,
  naPercent: number,
  counts: any,
): string {
  const size = 100;
  const radius = 36;
  const strokeWidth = 16;
  const centerX = size / 2;
  const centerY = size / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const createSegment = (percent: number, color: string) => {
    if (percent <= 0) return "";
    const dash = (percent / 100) * circumference;
    const segment = `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${currentOffset}" transform="rotate(-90 ${centerX} ${centerY})" />`;
    currentOffset -= dash;
    return segment;
  };

  const totalSuccess = directPercent + reworkCompPercent;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="#f1f5f9" stroke-width="${strokeWidth}" />
      ${createSegment(naPercent, "#f59e0b")}
      ${createSegment(noPercent, "#ef4444")}
      ${createSegment(reworkCompPercent, "#3b82f6")}
      ${createSegment(directPercent, "#10b981")}
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="10" font-weight="900" fill="#1e3a8a">${Math.round(totalSuccess)}%</text>
    </svg>
  `;
}

// Get logo
async function getLogoAsBase64(): Promise<string> {
  try {
    const response = await fetch("/logoimages/logo.jpeg");
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {}
  return "";
}

// Generate Performance Table HTML
function generatePerformanceTableHTML(data: any[]): string {
  if (!data || !data.length) return "";
  return `
    <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #e5e7eb; font-size: 7.5px;">
      <thead>
        <tr style="background: #1e3a8a;">
          <th style="padding: 4px 5px; text-align: left; color: white; border: 1px solid #374151;">User Name</th>
          <th style="padding: 4px 5px; text-align: center; color: white; border: 1px solid #374151;">Total Submitted</th>
          <th style="padding: 4px 5px; text-align: center; color: white; border: 1px solid #374151;">Dispatched</th>
          <th style="padding: 4px 5px; text-align: center; color: white; border: 1px solid #374151;">Total Reviewed</th>
          <th style="padding: 4px 5px; text-align: center; color: white; border: 1px solid #374151;">Accepted</th>
          <th style="padding: 4px 5px; text-align: center; color: white; border: 1px solid #374151;">Rejected</th>
          <th style="padding: 4px 5px; text-align: center; color: white; border: 1px solid #374151;">Reworked</th>
          <th style="padding: 4px 5px; text-align: center; color: white; border: 1px solid #374151;">Score</th>
        </tr>
      </thead>
      <tbody>
        ${data
          .map(
            (row, index) => `
          <tr style="background-color: ${index % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 3px 5px; font-weight: 700; border: 1px solid #e5e7eb;">${row.name || "N/A"}</td>
            <td style="padding: 3px 5px; text-align: center; border: 1px solid #e5e7eb;">${row.totalSubmitted || 0}</td>
            <td style="padding: 3px 5px; text-align: center; color: #3b82f6; font-weight: 700; border: 1px solid #e5e7eb;">${row.dispatched || 0}</td>
            <td style="padding: 3px 5px; text-align: center; border: 1px solid #e5e7eb;">${row.totalReviewed || 0}</td>
            <td style="padding: 3px 5px; text-align: center; color: #10b981; font-weight: 700; border: 1px solid #e5e7eb;">${row.accepted || 0}</td>
            <td style="padding: 3px 5px; text-align: center; color: #ef4444; font-weight: 700; border: 1px solid #e5e7eb;">${row.rejected || 0}</td>
            <td style="padding: 3px 5px; text-align: center; color: #f59e0b; font-weight: 700; border: 1px solid #e5e7eb;">${row.rework || 0}</td>
            <td style="padding: 3px 5px; text-align: center; border: 1px solid #e5e7eb;">
              <span style="padding: 1px 5px; border-radius: 8px; background: ${row.performanceScore >= 80 ? "#dcfce7" : row.performanceScore >= 50 ? "#fef9c3" : "#fee2e2"}; color: ${row.performanceScore >= 80 ? "#166534" : row.performanceScore >= 50 ? "#854d0e" : "#991b1b"}; font-weight: 800;">
                ${row.performanceScore}%
              </span>
            </td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function generateAnalyticsHTML(
  options: any,
  logoBase64: string,
): string {
  const {
    formTitle,
    generatedDate,
    totalPieChartData,
    inspectorSummary,
    summaryStatuses,
    inspectionStats,
    sectionSummaryRows,
    sectionAnalyticsData,
    chartImages,
    includeSectionAnalytics,
    performanceTableData,
  } = options;

  const defectStartDate = options.defectStartDate || "";
  const defectEndDate = options.defectEndDate || "";

  const finalDirect =
    inspectionStats?.accepted || 0 || totalPieChartData.counts?.directOk || 0;
  const finalReworkCompleted =
    inspectionStats?.reworkCompleted ||
    0 ||
    totalPieChartData.counts?.reworkCompleted ||
    0;
  const finalRejected =
    inspectionStats?.rejected || 0 || totalPieChartData.counts?.no || 0;
  const finalRework =
    inspectionStats?.reworked || 0 || totalPieChartData.counts?.na || 0;

  const totalStats =
    finalDirect + finalReworkCompleted + finalRejected + finalRework;
  const directPercent =
    totalStats > 0
      ? Math.round((finalDirect / totalStats) * 100)
      : totalPieChartData.directOk || 0;
  const reworkCompletedPercent =
    totalStats > 0
      ? Math.round((finalReworkCompleted / totalStats) * 100)
      : totalPieChartData.reworkCompleted || 0;
  const rejectedPercent =
    totalStats > 0
      ? Math.round((finalRejected / totalStats) * 100)
      : totalPieChartData.no || 0;
  const reworkedPercent =
    totalStats > 0
      ? Math.round((finalRework / totalStats) * 100)
      : totalPieChartData.na || 0;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  const dateRangeStr =
    defectStartDate && defectEndDate
      ? ` (${formatDate(defectStartDate)} - ${formatDate(defectEndDate)})`
      : "";

  // Natural-flow chart image: full width, auto height — PDF engine decides page breaks
  const chartImgStyle = `width: 100%; height: auto; display: block; margin-top: 3px;`;
  const noDataStyle = `color: #9ca3af; font-size: 9px; padding: 18px; text-align: center;`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page { size: A4; margin: 10mm 10mm; }
        * { box-sizing: border-box; }
        body {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          margin: 0; padding: 0;
          color: #1f2937;
          line-height: 1.3;
          background: #ffffff;
          font-size: 9px;
        }
        .container { width: 100%; max-width: 850px; margin: 0 auto; background: white; }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 5px;
          padding-bottom: 5px;
          border-bottom: 3px solid #1e3a8a;
        }
        .header h1 { font-size: 15px; font-weight: 900; color: #1e3a8a; margin: 0; }
        .header p { font-size: 8px; color: #64748b; margin: 2px 0 0 0; font-weight: 600; text-transform: uppercase; }
        .logo-img { width: 100px; height: 30px; object-fit: contain; }

        /* Chart card — NO forced breaks, flows naturally across pages */
        .chart-full {
          width: 100%;
          background: white;
          padding: 5px 8px;
          border-radius: 4px;
          border: 1.5px solid #e5e7eb;
          margin-bottom: 5px;
          page-break-inside: avoid;
        }
        .chart-main-title {
          font-size: 10px;
          font-weight: 900;
          color: #1e3a8a;
          margin: 0 0 1px 0;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-left: 3px solid #1e3a8a;
          padding-left: 6px;
        }
        .chart-sub-title {
          font-size: 7px;
          font-weight: 600;
          color: #64748b;
          margin: 0 0 2px 9px;
          padding-bottom: 2px;
          border-bottom: 1px solid #f1f5f9;
        }

        .section-header {
          margin: 6px 0 4px 0;
          padding: 4px 8px;
          background: #1e3a8a;
          color: white;
          border-radius: 3px;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          page-break-after: avoid;
        }

        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .stat-item { text-align: center; }
        .stat-value { font-size: 14px; font-weight: 900; margin-bottom: 1px; }
        .stat-label { font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase; }

        table { width: 100%; border-collapse: collapse; font-size: 7.5px; }
        th { background: #1e3a8a; color: white; padding: 4px 5px; text-align: left; font-weight: 700; border: 1px solid #374151; }
        td { padding: 3px 5px; border: 1px solid #e5e7eb; }
        tr { page-break-inside: avoid; }

        .table-title {
          font-size: 10px;
          font-weight: 800;
          color: #1e3a8a;
          margin: 7px 0 1px 0;
          text-transform: uppercase;
          page-break-after: avoid;
        }
        .table-subtitle {
          font-size: 6.5px;
          font-weight: 700;
          color: #64748b;
          margin: 0 0 2px 0;
          text-transform: uppercase;
        }

        .footer {
          margin-top: 6px;
          padding-top: 4px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 6.5px;
          color: #94a3b8;
          text-transform: uppercase;
          font-weight: 700;
        }

        /* Only the Section Analytics block gets its own page */
        .section-analytics-block {
          page-break-before: always;
        }
      </style>
    </head>
    <body>
      <div class="container">

        <!-- HEADER -->
        <div class="header">
          <div>
            <h1>Analytics Report</h1>
            <p>${formTitle} | ${generatedDate}</p>
          </div>
          ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" />` : ""}
        </div>

        <!-- Overall Quality Distribution -->
        <div class="chart-full">
          <div class="chart-main-title">Overall Inspection Trend</div>
          <div class="chart-sub-title">Accepted / Rejected / Rework Distribution</div>
          <div style="display: flex; align-items: center; justify-content: center; gap: 20px; padding: 2px 0;">
            ${generatePieChartSVG(directPercent, reworkCompletedPercent, rejectedPercent, reworkedPercent, {})}
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value" style="color: #10b981;">${directPercent}%</div>
                <div class="stat-label">Direct Ok (${finalDirect})</div>
              </div>
              <div class="stat-item">
                <div class="stat-value" style="color: #3b82f6;">${reworkCompletedPercent}%</div>
                <div class="stat-label">Rework Comp (${finalReworkCompleted})</div>
              </div>
              <div class="stat-item">
                <div class="stat-value" style="color: #ef4444;">${rejectedPercent}%</div>
                <div class="stat-label">Rejected (${finalRejected})</div>
              </div>
              <div class="stat-item">
                <div class="stat-value" style="color: #f59e0b;">${reworkedPercent}%</div>
                <div class="stat-label">Ongoing Rework (${finalRework})</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Performance Trend -->
        <div class="chart-full">
          <div class="chart-main-title">Performance Trend</div>
          <div class="chart-sub-title">Total responses received vs total rework received over time (Response-wise)</div>
          ${
            chartImages["performance-trend-chart"]
              ? `<img src="${chartImages["performance-trend-chart"]}" style="${chartImgStyle}" />`
              : `<p style="${noDataStyle}">Trend data not available</p>`
          }
        </div>

        <!-- Inspection Status Trend -->
        <div class="chart-full">
          <div class="chart-main-title">Inspection Status Trend</div>
          <div class="chart-sub-title">Daily distribution of inspection outcomes (100% stacked)</div>
          ${
            chartImages["inspection-status-distribution-chart"]
              ? `<img src="${chartImages["inspection-status-distribution-chart"]}" style="${chartImgStyle}" />`
              : `<p style="${noDataStyle}">Status distribution data not available</p>`
          }
        </div>

        <!-- Inspection Status Trends For REWORK -->
        <div class="chart-full">
          <div class="chart-main-title">Inspection Status Trends For REWORK</div>
          <div class="chart-sub-title">Daily trends of inspection outcomes (line chart)</div>
          ${
            chartImages["status-trends-rework-chart"]
              ? `<img src="${chartImages["status-trends-rework-chart"]}" style="${chartImgStyle}" />`
              : `<p style="${noDataStyle}">Trend data not available</p>`
          }
        </div>

        <!-- Defect Distribution -->
        <div class="chart-full">
          <div class="chart-main-title">Defect Distribution</div>
          <div class="chart-sub-title">Rejected &amp; Rework volume${dateRangeStr}</div>
          ${
            chartImages["defect-distribution-chart"]
              ? `<img src="${chartImages["defect-distribution-chart"]}" style="${chartImgStyle}" />`
              : `<p style="${noDataStyle}">Defect distribution chart not available.</p>`
          }
        </div>

        <!-- Inspection Summary Table -->
        ${
          inspectorSummary && inspectorSummary.length > 0
            ? `
          <div class="table-title">Inspection Summary</div>
          <div class="table-subtitle">Real-time inspection data</div>
          ${generateInspectionSummaryTable(inspectorSummary, summaryStatuses)}
        `
            : ""
        }

        <!-- Performance Table -->
        ${
          performanceTableData && performanceTableData.length > 0
            ? `
          <div class="table-title" style="margin-top: 6px;">Performance Table</div>
          <div class="table-subtitle">Form-specific inspector performance</div>
          ${generatePerformanceTableHTML(performanceTableData)}
        `
            : ""
        }

        <div class="footer">
          Analytics Report — ${formTitle} | Generated on ${generatedDate} | 3W-WHEELER TVS
        </div>

        <!-- SECTION ANALYTICS — own page only if present -->
        ${
          includeSectionAnalytics
            ? `
          <div class="section-analytics-block">
            <div class="section-header">Section-wise Performance Analysis</div>
            ${generateSectionPerformanceTable(sectionSummaryRows)}

            <div class="section-header" style="margin-top: 8px;">Detailed Quality Breakdown</div>
            ${sectionAnalyticsData
              .map(
                (section: any) => `
              <div class="table-title">${section.sectionTitle}</div>
              <table style="margin-bottom: 6px;">
                <thead>
                  <tr>
                    <th style="width: 50%;">Parameter</th>
                    <th style="text-align: center;">Yes</th>
                    <th style="text-align: center;">No</th>
                    <th style="text-align: center;">NA</th>
                    <th style="text-align: center;">Total</th>
                    <th style="text-align: center;">Quality %</th>
                  </tr>
                </thead>
                <tbody>
                  ${section.qualityBreakdown
                    .map(
                      (row: any) => `
                    <tr>
                      <td style="font-weight: 700;">${row.parameterName}</td>
                      <td style="text-align: center;">${row.yes}</td>
                      <td style="text-align: center;">${row.no}</td>
                      <td style="text-align: center;">${row.na}</td>
                      <td style="text-align: center;">${row.total}</td>
                      <td style="text-align: center; font-weight: 900; color: ${(row.yes / row.total) * 100 >= 90 ? "#059669" : "#dc2626"}">
                        ${((row.yes / row.total) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  `,
                    )
                    .join("")}
                  <tr style="background: #f8fafc; font-weight: 900;">
                    <td>SECTION TOTAL</td>
                    <td style="text-align: center;">${section.overallQuality.totalYes}</td>
                    <td style="text-align: center;">${section.overallQuality.totalNo}</td>
                    <td style="text-align: center;">${section.overallQuality.totalNA}</td>
                    <td style="text-align: center;">${section.overallQuality.totalResponses}</td>
                    <td style="text-align: center; color: #1e3a8a;">${section.overallQuality.percentages.yes}%</td>
                  </tr>
                </tbody>
              </table>
            `,
              )
              .join("")}
            <div class="footer">
              Section Analysis — ${formTitle} | 3W-WHEELER TVS
            </div>
          </div>
        `
            : ""
        }

      </div>
    </body>
    </html>
  `;
}

export async function captureAnalyticsCharts(
  chartElementIds: string[],
): Promise<Record<string, string>> {
  const chartImages: Record<string, string> = {};
  const originalScrollPos = window.scrollY;

  window.scrollTo(0, document.body.scrollHeight);
  await new Promise((resolve) => setTimeout(resolve, 800));
  window.scrollTo(0, originalScrollPos);
  await new Promise((resolve) => setTimeout(resolve, 500));

  for (const id of chartElementIds) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "auto" });
      await new Promise((resolve) => setTimeout(resolve, 200));
      chartImages[id] = await captureChartAsImage(id);
    } else {
      console.warn(`Chart ID not found in DOM during export: ${id}`);
      chartImages[id] = "";
    }
  }

  window.scrollTo(0, originalScrollPos);
  return chartImages;
}

export async function exportFormAnalyticsToPDF(options: any): Promise<void> {
  const { filename, chartElementIds } = options;

  const chartImages = await captureAnalyticsCharts(chartElementIds);
  const logoBase64 = await getLogoAsBase64();
  const htmlContent = generateAnalyticsHTML(
    { ...options, chartImages },
    logoBase64,
  );

  try {
    const response = await fetch(`${apiClient.getBaseUrl()}/pdf/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("auth_token") || localStorage.getItem("guest_auth_token")}`,
      },
      body: JSON.stringify({ htmlContent, filename, format: "a4-portrait" }),
    });

    if (!response.ok) throw new Error("PDF generation failed");
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("PDF Export Error:", error);
    throw error;
  }
}

export async function exportDashboardToPDF(
  formTitle: string,
  analyticsData: any,
  includeSectionAnalytics: boolean = true,
): Promise<boolean> {
  try {
    const chartElementIds = [
      "overall-quality-chart",
      "inspection-status-distribution-chart",
      "performance-trend-chart",
      "status-trends-rework-chart",
      "defect-distribution-chart",
      "issue-percentage-chart",
    ];

    await exportFormAnalyticsToPDF({
      filename: `${formTitle.replace(/\s+/g, "_")}_Analytics.pdf`,
      formTitle,
      generatedDate: new Date().toLocaleString(),
      totalResponses: analyticsData.total,
      pending: analyticsData.pending,
      verified: analyticsData.verified,
      rejected: analyticsData.rejected,
      sectionSummaryRows: analyticsData.sectionSummaryRows,
      totalPieChartData: analyticsData.totalPieChartData,
      chartElementIds,
      sectionAnalyticsData: analyticsData.sectionAnalyticsData,
      inspectorSummary: analyticsData.inspectorSummary,
      summaryStatuses: analyticsData.summaryStatuses,
      performanceTableData: analyticsData.performanceTableData,
      inspectionStats: analyticsData.inspectionStats,
      defectStartDate: analyticsData.defectStartDate,
      defectEndDate: analyticsData.defectEndDate,
      includeSectionAnalytics,
    });
    return true;
  } catch (error) {
    console.error("Export Error:", error);
    return false;
  }
}
