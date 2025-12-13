import React, { useState, useEffect } from 'react';
import { Eye } from 'lucide-react';
import ImageModal from './ImageModal';
import { convertGoogleDriveLink, isImageUrl } from '../utils/answerTemplateUtils';
import { apiClient } from '../api/client';

interface ImageLinkProps {
  text: string;
  showImage?: boolean;
}

export default function ImageLink({ text, showImage = true }: ImageLinkProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const trimmedText = String(text).trim();

  useEffect(() => {
    const convertImage = async () => {
      if (trimmedText.includes('drive.google.com')) {
        setIsConverting(true);
        try {
          const result = await apiClient.convertImageUrl(trimmedText);
          setImageUrl(result.cloudinaryUrl);
        } catch (error) {
          console.warn('Image conversion failed, using original:', error);
          setImageUrl(trimmedText);
        } finally {
          setIsConverting(false);
        }
      } else {
        setImageUrl(trimmedText);
      }
    };

    if (trimmedText) {
      convertImage();
    }
  }, [trimmedText]);

  if (!trimmedText) {
    return null;
  }

  const isImage = isImageUrl(trimmedText);

  if (!isImage) {
    return <span>{trimmedText}</span>;
  }

  if (!showImage) {
    return <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm">📷 Image</span>;
  }

  return (
    <>
      <div className="relative group inline-block">
        <img
          src={imageUrl}
          alt="Response image"
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
      <ImageModal 
        isOpen={isModalOpen}
        imageUrl={imageUrl}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
