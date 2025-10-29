import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Loader } from "lucide-react";
import { apiClient } from "../../../api/client";
import { FormSectionLinkingSettings } from "../../management/sections/FormSectionLinkingSettings";

export default function SettingsFormSectionLinking() {
  const { formId } = useParams<{ formId: string }>();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadForm();
  }, [formId]);

  const loadForm = async () => {
    if (!formId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getFormById(formId);
      if (data.form) {
        setForm(data.form);
      }
    } catch (err) {
      console.error("Error loading form:", err);
      setError("Failed to load form");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-2">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
        <p className="text-red-700">{error || "Form not found"}</p>
      </div>
    );
  }

  return (
    <FormSectionLinkingSettings
      formId={formId || ""}
      formTitle={form.title}
      sections={form.sections}
    />
  );
}
