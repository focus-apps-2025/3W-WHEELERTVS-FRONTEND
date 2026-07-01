import React from "react";
import { Eye } from "lucide-react";
import { Link } from "react-router-dom";

interface PreviewButtonProps {
  questionId: string;
}

export default function PreviewButton({ questionId }: PreviewButtonProps) {
  return (
    <Link
      to={`/forms/${questionId}/preview`}
      className="btn-primary flex items-center"
    >
      <Eye className="w-4 h-4 mr-2" />
      Preview Form
    </Link>
  );
}
