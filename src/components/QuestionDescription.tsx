import React from "react";

interface QuestionDescriptionProps {
  title: string;
  description: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
}

export default function QuestionDescription({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
}: QuestionDescriptionProps) {
  return (
    <div className="card p-6 space-y-6 bg-neutral-50">
      <div>
        <label className="block text-sm font-medium text-primary-600 mb-3">
          Form Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="input-field"
          placeholder="Enter form title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary-600 mb-3">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="input-field resize-none"
          rows={4}
          placeholder="Enter form description"
        />
      </div>
    </div>
  );
}
