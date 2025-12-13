import React from "react";
import { Download, Eye, FileSpreadsheet, FileText, MapPin } from "lucide-react";
import ImageModal from "./ImageModal";

interface FilePreviewProps {
  data?: string;
  url?: string;
  fileName?: string;
}

const parseFileValue = (fileValue: string) => {
  try {
    const parsed = JSON.parse(fileValue);
    if (parsed.url && parsed.location) {
      return {
        type: "camera",
        url: parsed.url,
        location: parsed.location,
        timestamp: parsed.timestamp,
      };
    }
  } catch {
    // Not JSON, regular file URL
  }
  return {
    type: "file",
    url: fileValue,
  };
};

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
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const rawSource = data || url || "";
  const fileData = parseFileValue(rawSource);
  const source = fileData.type === "camera" ? fileData.url : rawSource;
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
    <>
      <div>
        {isImage ? (
          <div className="inline-block">
            <div className="relative group inline-block">
              <img 
                src={source} 
                alt={resolvedFileName} 
                onClick={() => setIsModalOpen(true)}
                className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:shadow-md transition-shadow duration-200" 
              />
              <button
                onClick={() => setIsModalOpen(true)}
                className="absolute inset-0 w-full h-full bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100"
              >
                <Eye className="w-4 h-4 text-white" />
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
      {isImage && (
        <ImageModal 
          isOpen={isModalOpen}
          imageUrl={source}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
