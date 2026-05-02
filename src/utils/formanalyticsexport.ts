// utils/formanalyticsexport.ts - FINAL VERSION FOR PROFESSIONAL A4 PDF
import html2canvas from "html2canvas";
import { apiClient } from "../api/client";

// Helper function to capture charts as images
async function captureChartAsImage(chartElementId: string): Promise<string> {
  const chartElement = document.getElementById(chartElementId);
  if (!chartElement) {
    console.warn(`Chart element not found: ${chartElementId}`);
    return '';
  }

  try {
    // Wait for any animations to settle - adjusted based on chart type
    const waitTime = chartElementId.includes('defect') || chartElementId.includes('trend') ? 1500 : 800;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Get actual dimensions
    const rect = chartElement.getBoundingClientRect();
    const width = rect.width || chartElement.offsetWidth || 1200;
    const height = rect.height || chartElement.offsetHeight || 800;

    const canvas = await html2canvas(chartElement, {
      scale: 2, // Reduced scale to keep size manageable while maintaining quality
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: width,
      height: height,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(chartElementId);
        if (clonedElement) {
          clonedElement.style.visibility = 'visible';
          clonedElement.style.display = 'block';
          clonedElement.style.opacity = '1';
          clonedElement.style.background = '#ffffff';
          clonedElement.style.padding = '10px';
          
          // Force layout refresh in clone
          if (chartElementId === 'defect-distribution-chart') {
            clonedElement.style.width = '1200px'; // Set a fixed wide width for Bar charts in PDF
            clonedElement.style.height = 'auto';
            clonedElement.style.minHeight = '500px';
          }
          
          // Disable all transitions/animations in the clone
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * { 
              transition: none !important; 
              animation: none !important; 
              -webkit-transition: none !important;
              -webkit-animation: none !important;
            }
            .bg-gradient-to-r { background-image: none !important; }
            .from-amber-400 { background-color: #fbbf24 !important; }
            .to-amber-500 { background-color: #f59e0b !important; }
            .from-red-400 { background-color: #f87171 !important; }
            .to-red-500 { background-color: #ef4444 !important; }
            .shadow-inner { box-shadow: none !important; }
          `;
          clonedDoc.head.appendChild(style);
        }
      }
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // Using JPEG with 0.6 quality to significantly reduce payload size
    return dataUrl.length > 500 ? dataUrl : '';
  } catch (error) {
    console.error(`Error capturing chart ${chartElementId}:`, error);
    return '';
  }
}

// Generate summary cards HTML
function generateSummaryCardsHTML(total: number, pending: number, verified: number, rejected: number): string {
  return `
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px;">
      <div style="background: #f0f9ff; padding: 10px; border-radius: 10px; border: 1.5px solid #0ea5e9; text-align: center;">
        <div style="font-size: 18px; font-weight: 900; color: #0ea5e9;">${total}</div>
        <div style="font-size: 10px; font-weight: 700; color: #0284c7; margin-top: 2px;">Total Responses</div>
      </div>
      <div style="background: #faf5ff; padding: 10px; border-radius: 10px; border: 1.5px solid #a855f7; text-align: center;">
        <div style="font-size: 18px; font-weight: 900; color: #a855f7;">${pending}</div>
        <div style="font-size: 10px; font-weight: 700; color: #9333ea; margin-top: 2px;">Pending</div>
      </div>
      <div style="background: #f0fdf4; padding: 10px; border-radius: 10px; border: 1.5px solid #22c55e; text-align: center;">
        <div style="font-size: 18px; font-weight: 900; color: #22c55e;">${verified}</div>
        <div style="font-size: 10px; font-weight: 700; color: #16a34a; margin-top: 2px;">Verified</div>
      </div>
      <div style="background: #fef2f2; padding: 10px; border-radius: 10px; border: 1.5px solid #ef4444; text-align: center;">
        <div style="font-size: 18px; font-weight: 900; color: #ef4444;">${rejected}</div>
        <div style="font-size: 10px; font-weight: 700; color: #b91c1c; margin-top: 2px;">Rejected</div>
      </div>
    </div>
  `;
}

// Generate section performance table
function generateSectionPerformanceTable(sectionSummaryRows: any[]): string {
  if (!sectionSummaryRows.length) {
    return '<div style="text-align: center; padding: 15px; color: #6b7280; font-style: italic; font-size: 10px;">No section data available</div>';
  }

  const generateTableBarChart = (yesPercent: number, noPercent: number, naPercent: number): string => {
    const totalWidth = 140;
    const yesWidth = (yesPercent / 100) * totalWidth;
    const noWidth = (noPercent / 100) * totalWidth;
    const naWidth = (naPercent / 100) * totalWidth;

    return `
      <div style="position: relative; width: ${totalWidth}px; height: 14px; background: #f1f5f9; border-radius: 2px; overflow: hidden; border: 1px solid #e2e8f0;">
        ${yesPercent > 0 ? `<div style="position: absolute; left: 0; width: ${yesWidth}px; height: 100%; background: #10b981;"></div>` : ''}
        ${noPercent > 0 ? `<div style="position: absolute; left: ${yesWidth}px; width: ${noWidth}px; height: 100%; background: #ef4444;"></div>` : ''}
        ${naPercent > 0 ? `<div style="position: absolute; left: ${yesWidth + noWidth}px; width: ${naWidth}px; height: 100%; background: #9ca3af;"></div>` : ''}
      </div>
    `;
  };

  return `
    <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #e5e7eb; font-size: 9px;">
      <thead>
        <tr style="background: #1e3a8a;">
          <th style="padding: 8px; text-align: left; color: white; border: 1px solid #374151;">Section</th>
          <th style="padding: 8px; text-align: center; color: white; border: 1px solid #374151;">Total</th>
          <th style="padding: 8px; text-align: center; color: white; border: 1px solid #374151;">Yes (%)</th>
          <th style="padding: 8px; text-align: center; color: white; border: 1px solid #374151;">No (%)</th>
          <th style="padding: 8px; text-align: center; color: white; border: 1px solid #374151;">Visualization</th>
        </tr>
      </thead>
      <tbody>
        ${sectionSummaryRows.map((row, index) => `
          <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="padding: 6px; font-weight: 700; color: #1e293b; border: 1px solid #e5e7eb;">${row.title}</td>
            <td style="padding: 6px; text-align: center; border: 1px solid #e5e7eb;">${row.total}</td>
            <td style="padding: 6px; text-align: center; color: #059669; font-weight: 700; border: 1px solid #e5e7eb;">${row.yesPercent.toFixed(1)}%</td>
            <td style="padding: 6px; text-align: center; color: #dc2626; font-weight: 700; border: 1px solid #e5e7eb;">${row.noPercent.toFixed(1)}%</td>
            <td style="padding: 6px; text-align: center; border: 1px solid #e5e7eb;">${generateTableBarChart(row.yesPercent, row.noPercent, row.naPercent)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Generate Inspection Summary Table HTML
function generateInspectionSummaryTable(summary: any[], statuses: string[]): string {
  if (!summary || !summary.length) return '';

  return `
    <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #e5e7eb; font-size: 8px; margin-top: 10px;">
      <thead>
        <tr style="background: #1e3a8a;">
          <th style="padding: 6px; text-align: left; color: white; border: 1px solid #374151;">Tenant</th>
          <th style="padding: 6px; text-align: left; color: white; border: 1px solid #374151;">Date</th>
          <th style="padding: 6px; text-align: left; color: white; border: 1px solid #374151;">QC Inspector</th>
          <th style="padding: 6px; text-align: left; color: white; border: 1px solid #374151;">Form Title</th>
          <th style="padding: 6px; text-align: left; color: white; border: 1px solid #374151;">Chassis no</th>
          <th style="padding: 6px; text-align: center; color: white; border: 1px solid #374151;">Total</th>
          ${statuses.map(status => `<th style="padding: 6px; text-align: center; color: white; border: 1px solid #374151;">${status}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${summary.map((row, index) => `
          <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="padding: 5px; font-weight: 700; border: 1px solid #e5e7eb;">${row.tenantName || 'N/A'}</td>
            <td style="padding: 5px; border: 1px solid #e5e7eb;">${row.date || 'N/A'}</td>
            <td style="padding: 5px; border: 1px solid #e5e7eb;">${row.qcInspector || 'N/A'}</td>
            <td style="padding: 5px; border: 1px solid #e5e7eb;">${row.formTitle || '-'}</td>
            <td style="padding: 5px; border: 1px solid #e5e7eb;">${row.chassisNumber || row.chassisNo || '-'}</td>
            <td style="padding: 5px; text-align: center; font-weight: 700; border: 1px solid #e5e7eb;">${row.totalInspection || 0}</td>
            ${statuses.map(status => {
              const count = row.statusCounts?.[status] || 0;
              let color = '#3b82f6';
              if (status === 'Direct Ok' || status === 'Rework Accepted') color = '#10b981';
              else if (status.startsWith('Rework')) color = '#f59e0b';
              else if (status === 'Rejected') color = '#ef4444';
              return `<td style="padding: 5px; text-align: center; font-weight: 700; color: ${color}; border: 1px solid #e5e7eb;">${count}</td>`;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Generate pie chart SVG for overall quality
function generatePieChartSVG(yesPercent: number, noPercent: number, naPercent: number, counts: any): string {
  const size = 120;
  const radius = 45;
  const strokeWidth = 20;
  const centerX = size / 2;
  const centerY = size / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const createSegment = (percent: number, color: string) => {
    if (percent <= 0) return '';
    const dash = (percent / 100) * circumference;
    const segment = `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${currentOffset}" transform="rotate(-90 ${centerX} ${centerY})" />`;
    currentOffset -= dash;
    return segment;
  };

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="#f1f5f9" stroke-width="${strokeWidth}" />
      ${createSegment(naPercent, "#f59e0b")}
      ${createSegment(noPercent, "#ef4444")}
      ${createSegment(yesPercent, "#10b981")}
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="12" font-weight="900" fill="#1e3a8a">${yesPercent}%</text>
    </svg>
  `;
}

// Get logo
async function getLogoAsBase64(): Promise<string> {
  try {
    const response = await fetch('/logoimages/logo.jpeg');
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {}
  return '';
}

export function generateAnalyticsHTML(options: any, logoBase64: string): string {
  const {
    formTitle, generatedDate, totalPieChartData,
    inspectorSummary, summaryStatuses, inspectionStats, defectStartDate, defectEndDate,
    sectionSummaryRows, sectionAnalyticsData, chartImages
  } = options;

  // Ensure we have some counts even if inspectionStats is mostly zeros
  const finalAccepted = (inspectionStats?.accepted || 0) || (totalPieChartData.counts?.yes || 0);
  const finalRejected = (inspectionStats?.rejected || 0) || (totalPieChartData.counts?.no || 0);
  const finalRework = (inspectionStats?.reworked || 0) || (totalPieChartData.counts?.na || 0);
  
  const totalStats = finalAccepted + finalRejected + finalRework;
  const acceptedPercent = totalStats > 0 ? Math.round((finalAccepted / totalStats) * 100) : (totalPieChartData.yes || 0);
  const rejectedPercent = totalStats > 0 ? Math.round((finalRejected / totalStats) * 100) : (totalPieChartData.no || 0);
  const reworkedPercent = totalStats > 0 ? Math.round((finalRework / totalStats) * 100) : (totalPieChartData.na || 0);

  // Format date range for Defect Distribution
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const dateRangeStr = defectStartDate && defectEndDate 
    ? ` (${formatDate(defectStartDate)} - ${formatDate(defectEndDate)})`
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page { size: A4; margin: 0; }
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; margin: 0; padding: 0; color: #1f2937; line-height: 1.4; background: #f3f4f6; }
        .container { width: 100%; max-width: 800px; margin: 0 auto; padding: 20px; background: white; min-height: 100vh; box-sizing: border-box; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 3px solid #1e3a8a; }
        .header h1 { font-size: 20px; font-weight: 900; color: #1e3a8a; margin: 0; letter-spacing: -0.5px; }
        .header p { font-size: 10px; color: #64748b; margin: 4px 0 0 0; font-weight: 600; text-transform: uppercase; }
        .logo-img { width: 140px; height: 40px; object-fit: contain; }
        
        .section-header { margin: 25px 0 15px 0; padding: 8px 12px; background: #1e3a8a; color: white; border-radius: 4px; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
        
        .chart-full { width: 100%; background: white; padding: 20px; border-radius: 8px; border: 1.5px solid #e5e7eb; margin-bottom: 25px; page-break-inside: avoid; box-sizing: border-box; }
        .chart-main-title { font-size: 14px; font-weight: 900; color: #1e3a8a; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
        .chart-sub-title { font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 20px; text-transform: none; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
        
        .stats-grid { display: flex; gap: 25px; align-items: center; justify-content: center; }
        .stat-item { text-align: center; }
        .stat-value { font-size: 18px; font-weight: 900; margin-bottom: 2px; }
        .stat-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        
        .page-break-before { page-break-before: always; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9px; }
        th { background: #1e3a8a; color: white; padding: 8px; text-align: left; font-weight: 700; border: 1px solid #374151; }
        td { padding: 7px; border: 1px solid #e5e7eb; }
        .table-title { font-size: 14px; font-weight: 800; color: #1e3a8a; margin: 20px 0 10px 0; text-transform: uppercase; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div>
            <h1>Analytics Report</h1>
            <p>${formTitle} | ${generatedDate}</p>
          </div>
          ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" />` : ''}
        </div>
        
        <!-- Overall Quality Distribution -->
        <div class="chart-full">
          <div class="chart-main-title">Overall Response Quality</div>
          <div class="chart-sub-title">Accepted/Rejected/Rework Distribution</div>
          
          <div style="display: flex; align-items: center; justify-content: center; gap: 40px; padding: 10px;">
            ${generatePieChartSVG(acceptedPercent, rejectedPercent, reworkedPercent, {})}
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value" style="color: #10b981;">${acceptedPercent}%</div>
                <div class="stat-label">Accepted (${finalAccepted})</div>
              </div>
              <div class="stat-item">
                <div class="stat-value" style="color: #ef4444;">${rejectedPercent}%</div>
                <div class="stat-label">Rejected (${finalRejected})</div>
              </div>
              <div class="stat-item">
                <div class="stat-value" style="color: #f59e0b;">${reworkedPercent}%</div>
                <div class="stat-label">Rework (${finalRework})</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Performance Trend -->
        <div class="chart-full">
          <div class="chart-main-title">Performance Trend</div>
          <div class="chart-sub-title">Total responses received vs total rework received over time (Response-wise)</div>
          ${chartImages['performance-trend-chart'] ? `
            <img src="${chartImages['performance-trend-chart']}" style="width: 100%; max-height: 300px; object-fit: contain;" />
          ` : '<p style="color: #9ca3af; font-size: 10px; padding: 40px; text-align: center;">Trend data not available</p>'}
        </div>

        <!-- Inspection Status Trend -->
        <div class="chart-full">
          <div class="chart-main-title">Inspection Status Trend</div>
          <div class="chart-sub-title">Daily distribution of inspection outcomes (100% stacked)</div>
          ${chartImages['inspection-status-distribution-chart'] ? `
            <img src="${chartImages['inspection-status-distribution-chart']}" style="width: 100%; max-height: 300px; object-fit: contain;" />
          ` : '<p style="color: #9ca3af; font-size: 10px; padding: 40px; text-align: center;">Status distribution data not available</p>'}
        </div>

        <div class="page-break-before">
          <!-- Inspection Status Trends For REWORK -->
          <div class="chart-full" style="margin-top: 20px;">
            <div class="chart-main-title">Inspection Status Trends For REWORK</div>
            <div class="chart-sub-title">Daily trends of inspection outcomes (line chart)</div>
            ${chartImages['status-trends-rework-chart'] ? `
              <img src="${chartImages['status-trends-rework-chart']}" style="width: 100%; max-height: 300px; object-fit: contain;" />
            ` : '<p style="color: #9ca3af; font-size: 10px; padding: 40px; text-align: center;">Trend data not available</p>'}
          </div>

          <!-- Defect Distribution -->
          <div class="chart-full">
            <div class="chart-main-title">Defect Distribution</div>
            <div class="chart-sub-title">Rejected & Rework volume${dateRangeStr}</div>
            ${chartImages['defect-distribution-chart'] ? `
              <img src="${chartImages['defect-distribution-chart']}" style="width: 100%; max-height: 800px; object-fit: contain;" />
            ` : '<div style="padding: 60px; color: #9ca3af; font-size: 11px; font-style: italic; text-align: center;">Defect distribution chart not available.</div>'}
          </div>
          
          ${inspectorSummary && inspectorSummary.length > 0 ? `
            <div class="table-title">Inspector Performance Summary</div>
            ${generateInspectionSummaryTable(inspectorSummary, summaryStatuses)}
          ` : ''}
        </div>

        <div class="page-break-before"></div>

        <div class="section-header">Section-wise Performance Analysis</div>
        ${generateSectionPerformanceTable(sectionSummaryRows)}

        <div class="section-header">Detailed Quality Breakdown</div>
        ${sectionAnalyticsData.map((section: any) => `
          <div class="table-title">${section.sectionTitle}</div>
          <table style="margin-bottom: 20px;">
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
              ${section.qualityBreakdown.map((row: any) => `
                <tr>
                  <td style="font-weight: 700;">${row.parameterName}</td>
                  <td style="text-align: center;">${row.yes}</td>
                  <td style="text-align: center;">${row.no}</td>
                  <td style="text-align: center;">${row.na}</td>
                  <td style="text-align: center;">${row.total}</td>
                  <td style="text-align: center; font-weight: 900; color: ${((row.yes / row.total) * 100) >= 90 ? '#059669' : '#dc2626'}">
                    ${((row.yes / row.total) * 100).toFixed(1)}%
                  </td>
                </tr>
              `).join('')}
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
        `).join('')}
      </div>
    </body>
    </html>
  `;
}

export async function captureAnalyticsCharts(chartElementIds: string[]): Promise<Record<string, string>> {
  const chartImages: Record<string, string> = {};
  const originalScrollPos = window.scrollY;

  // Wake-up scroll: quickly scroll to bottom and back to trigger lazy rendering
  window.scrollTo(0, document.body.scrollHeight);
  await new Promise(resolve => setTimeout(resolve, 300));
  window.scrollTo(0, originalScrollPos);
  await new Promise(resolve => setTimeout(resolve, 200));

  for (const id of chartElementIds) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      chartImages[id] = await captureChartAsImage(id);
      window.scrollTo(0, originalScrollPos);
    } else {
      chartImages[id] = await captureChartAsImage(id);
    }
  }

  window.scrollTo(0, originalScrollPos);
  return chartImages;
}

export async function exportFormAnalyticsToPDF(options: any): Promise<void> {
  const {
    filename, chartElementIds
  } = options;

  const chartImages = await captureAnalyticsCharts(chartElementIds);
  const logoBase64 = await getLogoAsBase64();
  const htmlContent = generateAnalyticsHTML({ ...options, chartImages }, logoBase64);

  try {
    const response = await fetch(`${apiClient.getBaseUrl()}/pdf/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('guest_auth_token')}`
      },
      body: JSON.stringify({ htmlContent, filename, format: 'a4-portrait' })
    });

    if (!response.ok) throw new Error('PDF generation failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
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

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function exportDashboardToPDF(formTitle: string, analyticsData: any, includeSectionAnalytics: boolean = true): Promise<boolean> {
  try {
    const chartElementIds = [
      'overall-quality-chart', 'direct-accepted-chart', 'performance-trend-chart',
      'inspection-status-distribution-chart', 'status-trends-rework-chart',
      'defect-distribution-chart', 'issue-percentage-chart'
    ];

    await exportFormAnalyticsToPDF({
      filename: `${formTitle.replace(/\s+/g, '_')}_Analytics.pdf`,
      formTitle, generatedDate: new Date().toLocaleString(),
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
      inspectionStats: analyticsData.inspectionStats,
      defectStartDate: analyticsData.defectStartDate,
      defectEndDate: analyticsData.defectEndDate
    });
    return true;
  } catch (error) {
    console.error('Export Error:', error);
    return false;
  }
}
