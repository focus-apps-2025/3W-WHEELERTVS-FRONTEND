import React from 'react';
import { FileText, Download } from 'lucide-react';

interface FilePreviewProps {
  data: string;
  fileName?: string;
}

export default function FilePreview({ data, fileName }: FilePreviewProps) {
  const isImage = data.startsWith('data:image');
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = data;
    link.download = fileName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        <div className="flex items-center justify-between">
          <div className="flex items-center text-gray-600 dark:text-gray-400">
            <FileText className="w-6 h-6 mr-2" />
            <span>{fileName || 'Uploaded File'}</span>
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </button>
        </div>
      )}
    </div>
  );
}