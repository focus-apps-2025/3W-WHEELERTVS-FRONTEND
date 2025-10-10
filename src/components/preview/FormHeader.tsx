import React from "react";

interface FormHeaderProps {
  title: string;
  description: string;
  imageUrl?: string;
}

export default function FormHeader({
  title,
  description,
  imageUrl,
}: FormHeaderProps) {
  return (
    <div className="w-full border-b border-gray-200 pb-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">{title}</h1>
      {description && (
        <p className="text-lg text-gray-600 leading-relaxed">{description}</p>
      )}
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Form header"
          className="w-full max-h-80 object-cover rounded-lg mt-6"
        />
      )}
    </div>
  );
}
