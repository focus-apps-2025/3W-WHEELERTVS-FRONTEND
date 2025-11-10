import React from "react";
import { Download, Eye, FileSpreadsheet, FileText } from "lucide-react";

interface FilePreviewProps {
  data: string;
  fileName?: string;
}

export default function FilePreview({ data, fileName }: FilePreviewProps) {
  const isImage = data.startsWith("data:image");
  const isPdf = data.startsWith("data:application/pdf");
  const isExcel =
    data.startsWith("data:application/vnd.ms-excel") ||
    data.startsWith(
      "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = data;
    link.download =
      fileName || (isPdf ? "document.pdf" : isExcel ? "spreadsheet.xlsx" : "download");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleView = () => {
    window.open(data, "_blank", "noopener,noreferrer");
  };

  const resolvedFileName =
    fileName || (isPdf ? "Uploaded PDF" : isExcel ? "Uploaded Spreadsheet" : "Uploaded File");

  return (
    <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
      {isImage ? (
        <div className="space-y-4">
          <img src={data} alt="Uploaded" className="max-w-full h-auto rounded-lg" />
          <button
            onClick={handleDownload}
            className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Image
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center text-gray-600 dark:text-gray-400">
            {isExcel ? (
              <FileSpreadsheet className="w-6 h-6 mr-2" />
            ) : (
              <FileText className="w-6 h-6 mr-2" />
            )}
            <span>{resolvedFileName}</span>
          </div>
          <div className="flex items-center gap-3">
            {isPdf ? (
              <button
                onClick={handleView}
                className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <Eye className="w-4 h-4 mr-2" />
                View PDF
              </button>
            ) : null}
            <button
              onClick={handleDownload}
              className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <Download className="w-4 h-4 mr-2" />
              {isPdf ? "Download PDF" : isExcel ? "Download Excel" : "Download"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
