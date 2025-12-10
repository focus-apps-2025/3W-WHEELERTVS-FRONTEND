import React, { useState, useEffect } from 'react';
import { Eye } from 'lucide-react';
import ImageModal from './ImageModal';
import { convertGoogleDriveLink, isImageUrl } from '../utils/answerTemplateUtils';
import { apiClient } from '../api/client';

interface ImageLinkProps {
  text: string;
}

export default function ImageLink({ text }: ImageLinkProps) {
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

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        disabled={isConverting}
        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
      >
        <Eye className="w-4 h-4" />
        {isConverting ? 'Converting...' : 'View Image'}
      </button>
      <ImageModal 
        isOpen={isModalOpen}
        imageUrl={imageUrl}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
