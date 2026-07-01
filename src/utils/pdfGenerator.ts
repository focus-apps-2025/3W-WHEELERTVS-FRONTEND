// src/utils/pdfGenerator.ts

import { apiClient } from '../api/client';
import html2pdf from 'html2pdf.js';

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────────────────────
// Generate Overall Report PDF using backend
// ─────────────────────────────────────────────────────────────

export const generateOverallPDF = async (
  htmlContent: string,
  filename: string,
): Promise<Blob> => {
  return apiClient.generateOverallPDF({ htmlContent, filename });
};

// ─────────────────────────────────────────────────────────────
// Download PDF blob as a file
// ─────────────────────────────────────────────────────────────

export const downloadPDF = (pdfBlob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────
// Generate cover page data for Overall Report
// ─────────────────────────────────────────────────────────────

export const getCoverPageData = (
  yesCount: number,
  totalCount: number,
  formTitles: string[],
  tenantName?: string,
) => {
  const score = totalCount > 0 ? (yesCount / totalCount) * 100 : 0;

  let performance = 'NEEDS IMPROVEMENT';
  let perfColor = '#dc2626';
  if (score >= 75) {
    performance = 'EXCELLENT';
    perfColor = '#16a34a';
  } else if (score >= 25) {
    performance = 'AVERAGE';
    perfColor = '#f97316';
  }

  let smileyEmoji = '😞';
  if (score >= 90) {
    smileyEmoji = '😀';
  } else if (score >= 75) {
    smileyEmoji = '😊';
  } else if (score >= 25) {
    smileyEmoji = '😐';
  }

  const smileyImage = `<div style="font-size: 150px; text-align: center;">${smileyEmoji}</div>`;

  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return {
    score: score.toFixed(1),
    performance,
    perfColor,
    smileySVG: smileyImage,
    yesCount,
    totalCount,
    formCount: formTitles.length,
    formTitles,
    formTitle: formTitles.length > 0 ? formTitles.join(', ') : 'Analytics Report',
    tenantName: tenantName ?? '',
    date: dateStr,
    generatedDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
  };
};

// ─────────────────────────────────────────────────────────────
// No Responses HTML
// ─────────────────────────────────────────────────────────────

export const getNoResponsesHTML = (
  noResponsesData: {
    formTitle: string;
    dealerName: string;
    questionText: string;
    answer: string;
    responseDate: string;
    followUpData: Array<{ questionText: string; answer: string; level: number }>;
  }[],
  /** Total answered questions per form (sum of yes + no + na) */
  totalAnsweredByForm?: Map<string, number>,
): string => {
  if (!noResponsesData.length) {
    return '<div style="text-align: center; padding: 40px; color: #6b7280;">No "No/Rejected" responses found</div>';
  }

  const groupedByFormAndDealer: Record<string, Record<string, typeof noResponsesData>> = {};

  noResponsesData.forEach((item) => {
    if (!groupedByFormAndDealer[item.formTitle]) {
      groupedByFormAndDealer[item.formTitle] = {};
    }
    if (!groupedByFormAndDealer[item.formTitle][item.dealerName]) {
      groupedByFormAndDealer[item.formTitle][item.dealerName] = [];
    }
    groupedByFormAndDealer[item.formTitle][item.dealerName].push(item);
  });

  let html = '';

  for (const [formTitle, dealerGroups] of Object.entries(groupedByFormAndDealer)) {
    const totalNoCount = noResponsesData.filter((item) => item.formTitle === formTitle).length;
    const totalFormAnswered = totalAnsweredByForm?.get(formTitle) ?? 0;
    const noPercentage =
      totalFormAnswered > 0 ? ((totalNoCount / totalFormAnswered) * 100).toFixed(1) : 0;

    html += `
      <div style="border: 1px solid #e5e7eb; overflow: hidden; margin-bottom: 10px;">
        <!-- Form Header -->
        <div style="
          background: linear-gradient(to bottom, #2948b8 0%, #1e3a8a 100%);
          padding: 8px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 4px rgba(0,0,0,0.3);
        ">
          <span style="color: white; font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
            ${escapeHtml(formTitle)}
          </span>
          <span style="color: white; font-size: 10px; font-weight: bold;">
            ${totalNoCount}/${totalFormAnswered} No Response
          </span>
        </div>
    `;

    for (const [dealerName, items] of Object.entries(dealerGroups)) {
      html += `
        <!-- Dealer Row -->
        <div style="
          background: #f8fafc;
          padding: 6px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e5e7eb;
          border-top: 1px solid #e5e7eb;
        ">
          <span style="font-weight: bold; color: #1e3a8a; font-size: 10px;">
            DealerName: ${escapeHtml(dealerName)}
          </span>
          <span style="font-size: 9px; color: #6b7280;">
            ${items.length}/${totalNoCount} response${items.length !== 1 ? 's' : ''} · ${items[0]?.responseDate ?? ''}
          </span>
        </div>

        <!-- Column Headers -->
        <div style="display: flex; background: #1e3a8a; padding: 6px 12px;">
          <div style="width: 50%; color: #cccccc; font-weight: bold; font-size: 8px; text-transform: uppercase;">Question</div>
          <div style="width: 50%; color: #cccccc; font-weight: bold; font-size: 8px; text-transform: uppercase; text-align: right;">Response</div>
        </div>
      `;

      let mainQNum = 0;

      items.forEach((item, idx) => {
        mainQNum++;
        let followUpNum = 0;
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';

        html += `
          <!-- Main Question Row -->
          <div style="
            display: flex;
            align-items: flex-start;
            background: ${rowBg};
            border-bottom: 1px solid #f3f4f6;
            page-break-inside: avoid;
            break-inside: avoid;
          ">
            <div style="width: 50%; padding: 8px 12px; color: #111827; font-weight: 600; font-size: 9px;">
              ${mainQNum}. ${escapeHtml(item.questionText)}
            </div>
            <div style="width: 50%; padding: 5px 12px; text-align: right;">
              <span style="
                display: inline-block;
                padding: 2px 10px;
                background: #fee2e2;
                color: #b91c1c;
                border-radius: 4px;
                font-weight: bold;
                font-size: 9px;
              ">
                ${escapeHtml(item.answer)}
              </span>
            </div>
          </div>
        `;

        if (item.followUpData?.length > 0) {
          item.followUpData.forEach((fq) => {
            followUpNum++;
            const indent = (fq.level + 1) * 12;

            html += `
              <div style="
                background: #f9fafb;
                padding: 8px 12px 8px ${indent + 12}px;
                border-bottom: 1px solid #f3f4f6;
                page-break-inside: avoid;
                break-inside: avoid;
              ">
                <div style="font-weight: bold; color: #1f2937; font-size: 9px; margin-bottom: 1px;">
                  ${mainQNum}.${followUpNum}. ${escapeHtml(fq.questionText)}
                </div>
                <div style="color: #374151; font-size: 9px;">
                  ${fq.answer.includes('<img') || fq.answer.includes('<a') ? fq.answer : escapeHtml(fq.answer)}
                </div>
              </div>
            `;
          });
        }
      });
    }

    html += `</div>`;
  }

  return html;
};

// ─────────────────────────────────────────────────────────────
// Defect Distribution HTML
// ─────────────────────────────────────────────────────────────

export const getDefectDistributionHTML = (
  questions: Array<{ text: string; rejected: number; rework: number; total: number }>,
  dateRange: string,
): string => {
  if (!questions.length) {
    return '<div style="text-align: center; padding: 40px; color: #6b7280;">No defect data available for the selected period</div>';
  }

  const maxTotal = Math.max(...questions.map((q) => q.rejected + q.rework));

  const gradientStyle =
    'background: linear-gradient(to bottom, #2948b8 0%, #1e3a8a 100%); color: white;';
  const headerCellStyle = `padding: 8px; text-align: center; border: 1px solid #ffffff; ${gradientStyle}`;

  let html = `
    <div style="margin-bottom: 10px;">
      <div style="margin-top: 5px; padding: 10px;">
        <table style="width: 100%; font-size: 8px; border-collapse: collapse;">
          <thead>
            <tr style="${gradientStyle}">
              <th style="padding: 8px; text-align: left; border: 1px solid #ffffff; ${gradientStyle}">Question</th>
              <th style="${headerCellStyle}">No</th>
              <th style="${headerCellStyle}">NA</th>
              <th style="${headerCellStyle}">Total</th>
              <th style="${headerCellStyle}">Visualize</th>
            </tr>
          </thead>
          <tbody>
  `;

  for (const q of questions) {
    const total = q.rejected + q.rework;
    const rejectedBarPercent = total > 0 ? Math.round((q.rejected / total) * 100) : 0;
    const reworkBarPercent = total > 0 ? Math.round((q.rework / total) * 100) : 0;

    html += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">${q.text}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: #dc2626; font-weight: bold;">
          ${q.rejected} (${rejectedBarPercent}%)
        </td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: #f59e0b; font-weight: bold;">
          ${q.rework} (${reworkBarPercent}%)
        </td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${total}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
          <div style="display: inline-block;">
            <div style="display: flex; height: 14px; width: 120px; border-radius: 4px; overflow: hidden; background: #e5e7eb;">
              ${q.rejected > 0
                ? `<div style="background: #dc2626; width: ${rejectedBarPercent}%; height: 100%; display: flex; align-items: center; justify-content: center;">
                    ${rejectedBarPercent >= 15 ? `<span style="color: white; font-size: 7px; font-weight: bold;">${q.rejected}</span>` : ''}
                  </div>`
                : ''}
              ${q.rework > 0
                ? `<div style="background: #f59e0b; width: ${reworkBarPercent}%; height: 100%; display: flex; align-items: center; justify-content: center;">
                    ${reworkBarPercent >= 15 ? `<span style="color: white; font-size: 7px; font-weight: bold;">${q.rework}</span>` : ''}
                  </div>`
                : ''}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 7px; margin-top: 3px; width: 120px;">
              <span style="color: #dc2626;">${rejectedBarPercent}%</span>
              <span style="color: #f59e0b;">${reworkBarPercent}%</span>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  return html;
};

// ─────────────────────────────────────────────────────────────
// Overall Compliance HTML
// ─────────────────────────────────────────────────────────────

export const getOverallComplianceHTML = (
  yesCount: number,
  noCount: number,
  naCount: number,
  total: number,
  yesPercent: number,
  noPercent: number,
  naPercent: number,
): string => {
  const donutStyle = `
    <div style="position: relative; width: 180px; height: 180px; margin: 0 auto;">
      <!-- Outer Donut -->
      <div style="
        width: 180px;
        height: 180px;
        border-radius: 50%;
        background: conic-gradient(
          #16a34a 0deg ${yesPercent * 3.6}deg,
          #ef4444 ${yesPercent * 3.6}deg ${(yesPercent + noPercent) * 3.6}deg,
          #9ca3af ${(yesPercent + noPercent) * 3.6}deg 360deg
        );
        box-shadow:
          inset 0 4px 5px rgba(255,255,255,0.35),
          inset 0 -5px 8px rgba(0,0,0,0.15),
          0 8px 18px rgba(0,0,0,0.18);
        position: relative;
      "></div>

      <!-- Inner Circle -->
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #e5e7eb 100%);
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        box-shadow:
          inset 0 2px 4px rgba(255,255,255,0.9),
          inset 0 -2px 4px rgba(0,0,0,0.08),
          0 2px 8px rgba(0,0,0,0.15);
      ">
        <div style="font-size: 28px; font-weight: 800; color: #1e3a8a; line-height: 1;">${total}</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px; letter-spacing: 0.5px; text-transform: uppercase;">Total</div>
      </div>
    </div>
  `;

  return `
    <div style="display: flex; gap: 20px;">
      <div>${donutStyle}</div>

      <div style="display: flex; flex-direction: column; margin-left: 120px; margin-top: 20px; gap: 14px;">
        <div style="display: flex; align-items: center; gap: 5px;">
          <span style="color: #16a34a; font-size: 30px; font-weight: 700; min-width: 90px;">
            ${yesCount} (${yesPercent}%)
          </span>
          <span style="font-size: 11px; color: #475569; font-weight: 600;">Yes / Accepted</span>
        </div>

        <div style="display: flex; align-items: center; gap: 5px;">
          <span style="color: #ef4444; font-size: 30px; font-weight: 700; min-width: 90px;">
            ${noCount} (${noPercent}%)
          </span>
          <span style="font-size: 11px; color: #475569; font-weight: 600;">No / Rejected</span>
        </div>

        ${naCount > 0 ? `
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="color: #6b7280; font-size: 30px; font-weight: 700; min-width: 90px;">
              ${naCount} (${naPercent}%)
            </span>
            <span style="font-size: 11px; color: #475569; font-weight: 600;">N/A / Rework</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;
};

// ─────────────────────────────────────────────────────────────
// Section Summary HTML
// ─────────────────────────────────────────────────────────────

export const getSectionSummaryHTML = (
  formWiseSections: Array<{
    formId: string;
    formTitle: string;
    sections: Array<{
      sectionTitle: string;
      yesCount: number;
      noCount: number;
      naCount: number;
      total: number;
      yesPercent: number;
      noPercent: number;
      naPercent: number;
    }>;
    totalYes: number;
    totalNo: number;
    totalNa: number;
    totalResponses: number;
    detectionType: 'yesNoNa' | 'acceptedRejectedRework';
  }>,
): string => {
  if (!formWiseSections.length) {
    return '<div style="text-align: center; padding: 40px; color: #6b7280;">No section data available</div>';
  }

  const headerGradient =
    'background: linear-gradient(to bottom, #2948b8 0%, #1e3a8a 100%); color: white;';

  let html = '';

  for (const form of formWiseSections) {
    const positiveLabel = form.detectionType === 'yesNoNa' ? 'Yes' : 'Accepted';
    const negativeLabel = form.detectionType === 'yesNoNa' ? 'No' : 'Rejected';
    const neutralLabel = form.detectionType === 'yesNoNa' ? 'N/A' : 'Rework';
    const naColor = form.detectionType === 'yesNoNa' ? '#6b7280' : '#d97706';

    const formTotal = form.totalYes + form.totalNo + form.totalNa;
    const overallScore = formTotal > 0 ? Math.round((form.totalYes / formTotal) * 100) : 0;
    const scoreColor =
      overallScore >= 75 ? '#20dd65ff' : overallScore >= 50 ? '#eab308' : '#dc2626';

    const validSections = form.sections.filter((s) => s.total > 0);

    const thStyle = `padding: 8px; text-align: center; border: 1px solid #e5e7eb; ${headerGradient}`;

    html += `
      <div style="margin-bottom: 20px; page-break-inside: avoid; border: 1px solid #e5e7eb; overflow: hidden;">
        <!-- Form Header -->
        <div style="background: linear-gradient(to bottom, #3a78e4ff 0%, #1e3a8a 100%); padding: 12px 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: white; font-weight: bold; font-size: 14px;">${escapeHtml(form.formTitle)}</div>
              <div style="color: white; font-size: 9px; margin-top: 4px;">
                ${validSections.length} section${validSections.length !== 1 ? 's' : ''} • ${form.totalResponses} responses
              </div>
            </div>
            <div style="text-align: right;">
              <div style="color: white; font-size: 8px; text-transform: uppercase;">Overall Score</div>
              <div style="color: ${scoreColor}; font-size: 24px; font-weight: bold;">${overallScore}%</div>
            </div>
          </div>
        </div>

        <!-- Section Table -->
        <div style="padding: 16px;">
          <table style="width: 100%; font-size: 9px; border-collapse: collapse;">
            <thead>
              <tr style="${headerGradient}">
                <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb; width: 35%; ${headerGradient}">Section</th>
                <th style="${thStyle}; width: 10%;">Total</th>
                <th style="${thStyle}; width: 15%;">${positiveLabel}</th>
                <th style="${thStyle}; width: 15%;">${negativeLabel}</th>
                <th style="${thStyle}; width: 15%;">${neutralLabel}</th>
                <th style="${thStyle}; width: 10%;">Visual</th>
              </tr>
            </thead>
            <tbody>
    `;

    for (const section of validSections) {
      const yesPct = section.total > 0 ? Math.round((section.yesCount / section.total) * 100) : 0;
      const noPct = section.total > 0 ? Math.round((section.noCount / section.total) * 100) : 0;
      const naPct = section.total > 0 ? Math.round((section.naCount / section.total) * 100) : 0;

      html += `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; color: #2563eb;">
            ${escapeHtml(section.sectionTitle)}
          </td>
          <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb; font-weight: bold;">
            ${section.total}
          </td>
          <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb; color: #16a34a; font-weight: bold;">
            ${section.yesCount} (${yesPct}%)
          </td>
          <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">
            ${section.noCount} (${noPct}%)
          </td>
          <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb; font-weight: bold; color: ${naColor};">
            ${section.naCount} (${naPct}%)
          </td>
          <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">
            <div style="display: flex; height: 13px; width: 100px; border-radius: 3px; overflow: hidden;">
              ${yesPct > 0 ? `<div style="background: #22c55e; width: ${yesPct}%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 7px; font-weight: bold;">${yesPct > 15 ? yesPct + '%' : ''}</div>` : ''}
              ${noPct > 0 ? `<div style="background: #ef4444; width: ${noPct}%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 7px; font-weight: bold;">${noPct > 15 ? noPct + '%' : ''}</div>` : ''}
              ${naPct > 0 ? `<div style="background: ${form.detectionType === 'yesNoNa' ? '#9ca3af' : '#f59e0b'}; width: ${naPct}%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 7px; font-weight: bold;">${naPct > 15 ? naPct + '%' : ''}</div>` : ''}
            </div>
            <div style="display: flex; justify-content: center; gap: 8px; margin-top: 4px; font-size: 7px; font-weight: bold;">
              <span style="color: #16a34a;">${yesPct}%</span>
              <span style="color: #dc2626;">${noPct}%</span>
              <span style="color: ${naColor};">${naPct}%</span>
            </div>
          </td>
        </tr>
      `;
    }

    // Footer total row
    const totalYesPct = formTotal > 0 ? Math.round((form.totalYes / formTotal) * 100) : 0;
    const totalNoPct = formTotal > 0 ? Math.round((form.totalNo / formTotal) * 100) : 0;
    const totalNaPct = formTotal > 0 ? Math.round((form.totalNa / formTotal) * 100) : 0;

    html += `
              <tr style="background: #dbeafe; font-weight: bold;">
                <td style="padding: 8px; border: 1px solid #e5e7eb;">TOTAL</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">${formTotal}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb; color: #16a34a;">
                  ${form.totalYes} (${totalYesPct}%)
                </td>
                <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb; color: #dc2626;">
                  ${form.totalNo} (${totalNoPct}%)
                </td>
                <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb; color: ${naColor};">
                  ${form.totalNa} (${totalNaPct}%)
                </td>
                <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">
                  <div style="display: flex; height: 14px; width: 100px; border-radius: 4px; overflow: hidden;">
                    ${form.totalYes > 0 ? `<div style="background: #22c55e; width: ${totalYesPct}%;"></div>` : ''}
                    ${form.totalNo > 0 ? `<div style="background: #ef4444; width: ${totalNoPct}%;"></div>` : ''}
                    ${form.totalNa > 0 ? `<div style="background: ${form.detectionType === 'yesNoNa' ? '#9ca3af' : '#f59e0b'}; width: ${totalNaPct}%;"></div>` : ''}
                  </div>
                  <div style="display: flex; justify-content: center; gap: 8px; margin-top: 4px; font-size: 7px;">
                    <span style="color: #16a34a;">${totalYesPct}%</span>
                    <span style="color: #dc2626;">${totalNoPct}%</span>
                    <span style="color: ${naColor};">${totalNaPct}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return html;
};

// ─────────────────────────────────────────────────────────────
// Build full Overall Report HTML document
// ─────────────────────────────────────────────────────────────

export const buildOverallPDFHTML = (
  coverPage: any,
  overallComplianceHTML: string,
  firstQuestionTableHTML: string,
  sectionSummaryHTML: string,
  defectDistributionHTML: string,
  noResponsesHTML: string,
  Sectionsummary: string,
  logoBase64?: string | null,
  templateBase64?: string | null,
  otherTemplateBase64?: string | null,
): string => {
  const coverBgStyle = templateBase64
    ? `background-image: url('${templateBase64}'); background-size: 100% 100%; background-repeat: no-repeat;`
    : 'background-color: #f0f9ff;';

  const contentBgStyle = otherTemplateBase64
    ? `background-image: url('${otherTemplateBase64}'); background-size: 100% 100%; background-repeat: no-repeat;`
    : 'background-color: #ffffff;';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Overall Analytics Report</title>
  <style>
    @page {
      size: 210mm 297mm;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: transparent;
    }

    /* Cover background — absolute, only page 1 */
    .cover-bg {
      position: absolute;
      top: 0;
      left: 0;
      width: 210mm;
      height: 297mm;
      z-index: -1;
      ${coverBgStyle}
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    /* Content background — fixed, repeats from page 2 onward */
    .content-bg {
      position: fixed;
      top: 0;
      left: 0;
      width: 210mm;
      height: 297mm;
      z-index: -2;
      ${contentBgStyle}
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    /* Cover page */
    .cover-page {
      position: relative;
      width: 210mm;
      height: 297mm;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      page-break-after: always;
      break-after: page;
      background: transparent;
      z-index: 10;
    }

    .cover-content {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 15mm 12mm 10mm 12mm;
    }

    /* Content page table layout for consistent margins */
    table.content-wrapper {
      width: 100%;
      border-collapse: collapse;
      border: none !important;
      background: transparent !important;
      page-break-before: always;
      break-before: page;
      margin: 0 !important;
    }
    table.content-wrapper > thead > tr > th,
    table.content-wrapper > tbody > tr > td,
    table.content-wrapper > tfoot > tr > td {
      border: none !important;
      background: transparent !important;
      padding: 0 !important;
    }
    table.content-wrapper > tbody > tr > td.page-content {
      padding: 0 12mm !important;
      vertical-align: top;
    }

    .page-header-space { height: 18mm; padding: 0 !important; border: none !important; }
    .page-footer-space { height: 15mm; padding: 0 !important; border: none !important; }

    .section-title {
      font-size: 16px;
      font-weight: bold;
      color: #1e3a8a;
      margin: 5px 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }

    .compliance-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 12px;
      margin-bottom: 8px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      background: rgba(255, 255, 255, 0.92);
    }
    .compliance-green { background: rgba(240, 253, 244, 0.92); border-color: #bbf7d0; }
    .compliance-red   { background: rgba(254, 242, 242, 0.92); border-color: #fecaca; }
    .compliance-gray  { background: rgba(249, 250, 251, 0.92); border-color: #e5e7eb; }

    .compliance-label    { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 10px; }
    .compliance-dot-green { width: 10px; height: 10px; border-radius: 50%; background: #22c55e; }
    .compliance-dot-red   { width: 10px; height: 10px; border-radius: 50%; background: #ef4444; }
    .compliance-dot-gray  { width: 10px; height: 10px; border-radius: 50%; background: #9ca3af; }
    .compliance-value     { font-size: 16px; font-weight: bold; }

    .text-green-dark { color: #16a34a; }
    .text-red-dark   { color: #dc2626; }
    .text-gray-dark  { color: #4b5563; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 8px;
      background: rgba(255, 255, 255, 0.95);
    }
    th, td {
      border: 1px solid #ddd;
      padding: 4px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: rgba(243, 244, 246, 0.95);
      font-weight: bold;
      font-size: 7px;
      text-transform: uppercase;
    }

    .compliance-bar { display: flex; height: 10px; width: 80px; border-radius: 3px; overflow: hidden; background: #e5e7eb; }
    .bar-green { background: #22c55e; height: 100%; float: left; }
    .bar-red   { background: #ef4444; height: 100%; float: left; }
    .bar-gray  { background: #9ca3af; height: 100%; float: left; }
    .bar-amber { background: #f59e0b; height: 100%; float: left; }

    .text-green  { color: #16a34a; font-weight: bold; }
    .text-red    { color: #dc2626; font-weight: bold; }
    .text-gray   { color: #6b7280; }
    .text-amber  { color: #d97706; font-weight: bold; }
    .text-center { text-align: center; }

    * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  </style>
</head>
<body>

  <!-- Cover background (page 1 only) -->
  <div class="cover-bg"></div>

  <!-- PAGE 1: Cover -->
  <div class="cover-page">
    <div class="cover-content">

      <!-- Header -->
      <div style="position: relative; margin-bottom: 16px;">
        <div style="
          background: #cce0f5;
          border-radius: 6px 55px 55px 6px;
          padding: 10px 0px 10px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 70px;
          border: 1px solid #345ed0ff;
        ">
          <div style="flex: 1; padding-right: 16px;">
            <div style="font-size: 13px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px;">
              ${(coverPage.formTitles || []).map((t: string) => escapeHtml(t)).join(', ')}
            </div>
            <div style="font-size: 10px; color: #1e40af; margin-top: 2px;">${coverPage.tenantName ?? ''}</div>
          </div>
          ${logoBase64 ? `
            <div style="width: 70px; height: 70px; border-radius: 50%; background: white; border: 3px solid #7bb8e8; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; position: relative; right: -4px; margin: -15px 0;">
              <img src="${logoBase64}" style="width: 80%; height: 80%; object-fit: cover;" alt="Logo" />
            </div>
          ` : `
            <div style="width: 100px; height: 100px; border-radius: 50%; background: white; border: 3px solid #7bb8e8; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 9px; color: #1e3a8a; flex-shrink: 0; position: relative; right: -4px; margin: -15px 0;">
              LOGO
            </div>
          `}
        </div>
      </div>

      <!-- 2×2 Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; flex: 1; gap: 10px; height: 250px; margin-bottom: 40px;">

        <!-- Top Left -->
        <div style="position: relative; background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #2563eb 100%); border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; overflow: hidden;">
          <div style="position: absolute; inset: 0; background-image: radial-gradient(circle, rgba(255,255,255,0.12) 1.5px, transparent 1.5px); background-size: 14px 14px; opacity: 0.5;"></div>
          <div style="position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center;">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" style="margin-bottom: 10px;">
              <rect x="7" y="2" width="10" height="3" rx="1" stroke="white" stroke-width="1.5" fill="none"/>
              <rect x="4" y="3" width="16" height="19" rx="2" stroke="white" stroke-width="1.5" fill="none"/>
              <path d="M8 11h5M8 14h3" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M14.5 13.5l4-4 3 3-7 7-3.5 0.5 0.5-3.5z" stroke="white" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
            </svg>
            <div style="font-size: 22px; font-weight: bold; color: white; text-align: center; line-height: 1.35; letter-spacing: 1px;">
              SERVICE<br/>EXCELLENCE<br/>REPORT
            </div>
            <div style="width: 50px; height: 3px; background: rgba(96,165,250,0.7); border-radius: 2px; margin-top: 12px;"></div>
          </div>
        </div>

        <!-- Top Right -->
        <div style="position: relative; background: rgba(255,255,255,0.85); border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; overflow: hidden;">
          <div style="position: absolute; top: 0; right: 0; width: 90px; height: 90px; background-image: radial-gradient(circle, #d1d5db 1.5px, transparent 1.5px); background-size: 12px 12px; opacity: 0.5;"></div>
          <div style="position: absolute; bottom: 0; right: 0; width: 90px; height: 90px; background-image: radial-gradient(circle, #d1d5db 1.5px, transparent 1.5px); background-size: 12px 12px; opacity: 0.5;"></div>
          <div style="width: 64px; height: 64px; border-radius: 50%; border: 3px solid ${coverPage.perfColor}; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M3 17l5-5 4 4 7-8" stroke="${coverPage.perfColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M17 8h3v3" stroke="${coverPage.perfColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M5 21h14" stroke="${coverPage.perfColor}" stroke-width="2.5" stroke-linecap="round"/>
              <rect x="5" y="17" width="3" height="4" fill="${coverPage.perfColor}"/>
              <rect x="11" y="14" width="3" height="7" fill="${coverPage.perfColor}"/>
              <rect x="17" y="11" width="3" height="10" fill="${coverPage.perfColor}"/>
            </svg>
          </div>
          <div style="font-size: 56px; font-weight: bold; color: ${coverPage.perfColor}; line-height: 1;">${coverPage.score}%</div>
          <div style="width: 50px; height: 2px; background: #cbd5e1; border-radius: 2px; margin: 12px 0;"></div>
          <div style="font-size: 13px; color: #1e3a8a; letter-spacing: 2px; text-transform: uppercase;">OVERALL SCORE</div>
        </div>

        <!-- Bottom Left -->
        <div style="position: relative; background: rgba(255,255,255,0.85); border-radius: 14px; display: flex; align-items: center; justify-content: center; padding: 16px; overflow: hidden;">
          <div style="position: absolute; top: 0; left: 0; width: 90px; height: 90px; background-image: radial-gradient(circle, #d1d5db 1.5px, transparent 1.5px); background-size: 12px 12px; opacity: 0.5;"></div>
          <div style="position: absolute; bottom: 0; left: 0; width: 90px; height: 90px; background-image: radial-gradient(circle, #d1d5db 1.5px, transparent 1.5px); background-size: 12px 12px; opacity: 0.5;"></div>
          <div style="position: relative; z-index: 1; transform: scale(1.4);">
            ${coverPage.smileySVG}
          </div>
        </div>

        <!-- Bottom Right -->
        <div style="background: ${coverPage.perfColor}; border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px;">
          <div style="width: 64px; height: 64px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.6); display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="5" stroke="white" stroke-width="2" fill="none"/>
              <path d="M8.5 12.5L6 21l6-3 6 3-2.5-8.5" stroke="white" stroke-width="2" fill="none" stroke-linejoin="round"/>
              <path d="M9.5 8l1.5 1.5L14 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div style="font-size: 13px; color: rgba(255,255,255,0.85); text-transform: uppercase; letter-spacing: 1px;">YOUR PERFORMANCE:</div>
          <div style="font-size: 26px; font-weight: bold; color: white; text-transform: uppercase; margin-top: 4px;">${coverPage.performance}</div>
          <div style="width: 50px; height: 3px; background: rgba(255,255,255,0.5); border-radius: 2px; margin-top: 12px;"></div>
        </div>
      </div>

      <!-- Footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding: 2px;">
        <span style="font-size: 9px; color: #ffffff;">© COPYRIGHT 2026</span>
        <span style="font-size: 9px; color: #ffffff;">${coverPage.formCount} Form — REPORT GENERATED: ${coverPage.generatedDate}</span>
      </div>

    </div>
  </div>

  <!-- Content background (page 2 onward) -->
  <div class="content-bg"></div>

  <!-- PAGE 2: Overall Compliance + First Question Responses -->
  <table class="content-wrapper">
    <thead><tr><th class="page-header-space"></th></tr></thead>
    <tbody><tr><td class="page-content">
      <div class="section-title">Overall Compliance</div>
      ${overallComplianceHTML}
      <div class="section-title"></div>
      ${firstQuestionTableHTML}
    </td></tr></tbody>
    <tfoot><tr><td class="page-footer-space"></td></tr></tfoot>
  </table>

  <!-- PAGE 3: Section Summary -->
  <table class="content-wrapper">
    <thead><tr><th class="page-header-space"></th></tr></thead>
    <tbody><tr><td class="page-content">
      <div class="section-title">Section Summary</div>
      ${Sectionsummary}
    </td></tr></tbody>
    <tfoot><tr><td class="page-footer-space"></td></tr></tfoot>
  </table>

  <!-- PAGE 4: Top 20 NO Responses -->
  <table class="content-wrapper">
    <thead><tr><th class="page-header-space"></th></tr></thead>
    <tbody><tr><td class="page-content">
      <div class="section-title">Top 20 NO Responses</div>
      ${defectDistributionHTML}
    </td></tr></tbody>
    <tfoot><tr><td class="page-footer-space"></td></tr></tfoot>
  </table>

  <!-- PAGE 5: No / Rejected Responses -->
  <table class="content-wrapper">
    <thead><tr><th class="page-header-space"></th></tr></thead>
    <tbody><tr><td class="page-content">
      <div class="section-title">No Responses</div>
      ${noResponsesHTML}
    </td></tr></tbody>
    <tfoot><tr><td class="page-footer-space"></td></tr></tfoot>
  </table>

</body>
</html>`;
};