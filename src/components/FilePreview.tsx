import React from "react";
import { Download, Eye, FileSpreadsheet, FileText } from "lucide-react";

interface FilePreviewProps {
  data?: string;
  url?: string;
  fileName?: string;
}

const isImageSource = (source: string) => {
  if (!source) {
    return false;
  }
  if (source.startsWith("data:")) {
    return source.startsWith("data:image");
  }
  return /\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i.test(source.split("?")[0]);
};

const isPdfSource = (source: string) => {
  if (!source) {
    return false;
  }
  if (source.startsWith("data:")) {
    return source.startsWith("data:application/pdf");
  }
  return /\.pdf$/i.test(source.split("?")[0]);
};

const isExcelSource = (source: string) => {
  if (!source) {
    return false;
  }
  if (source.startsWith("data:")) {
    return (
      source.startsWith("data:application/vnd.ms-excel") ||
      source.startsWith(
        "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    );
  }
  return /\.(xls|xlsx)$/i.test(source.split("?")[0]);
};

export default function FilePreview({ data, url, fileName }: FilePreviewProps) {
  const source = data || url || "";
  const isImage = isImageSource(source);
  const isPdf = isPdfSource(source);
  const isExcel = isExcelSource(source);

  const resolvedFileName =
    fileName ||
    (isPdf ? "Uploaded PDF" : isExcel ? "Uploaded Spreadsheet" : isImage ? "Uploaded Image" : "Uploaded File");

  const handleView = () => {
    if (!source) {
      return;
    }
    window.open(source, "_blank", "noopener,noreferrer");
  };

  const handleDownload = () => {
    if (!source) {
      return;
    }
    const link = document.createElement("a");
    link.href = source;
    link.download =
      fileName ||
      (isPdf
        ? "document.pdf"
        : isExcel
        ? "spreadsheet.xlsx"
        : isImage
        ? "image"
        : "download");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
      {isImage ? (
        <div className="space-y-4">
          <img src={source} alt={resolvedFileName} className="max-w-full h-auto rounded-lg" />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleView}
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <Eye className="w-4 h-4" />
              View
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center text-gray-600 dark:text-gray-400">
            {isExcel ? (
              <FileSpreadsheet className="w-6 h-6 mr-2" />
            ) : (
              <FileText className="w-6 h-6 mr-2" />
            )}
            <span className="truncate max-w-xs" title={resolvedFileName}>
              {resolvedFileName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleView}
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <Eye className="w-4 h-4" />
              View
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <Download className="w-4 h-4" />
              {isPdf ? "Download PDF" : isExcel ? "Download Excel" : "Download"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
