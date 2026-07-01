import React, { InputHTMLAttributes } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  placeholder?: string;
  floatingLabel?: boolean;
  helpText?: string;
}

export default function FormField({
  label,
  placeholder = " ",
  floatingLabel = true,
  helpText,
  className = "",
  id,
  ...props
}: FormFieldProps) {
  const fieldId = id || `field-${Math.random().toString(36).substr(2, 9)}`;

  if (floatingLabel) {
    return (
      <div className="relative">
        <input
          {...props}
          id={fieldId}
          className={`input-field peer ${className}`}
          placeholder={placeholder}
        />
        <label
          htmlFor={fieldId}
          className="absolute left-4 top-3 text-primary-400 transition-all duration-200 peer-placeholder-shown:text-primary-400 peer-placeholder-shown:top-3 peer-focus:top-1 peer-focus:text-xs peer-focus:text-primary-600 peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-primary-600 pointer-events-none"
        >
          {label}
        </label>
        {helpText && (
          <div className="mt-1 text-xs text-primary-500">{helpText}</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-primary-700 mb-2"
      >
        {label}
      </label>
      <input
        {...props}
        id={fieldId}
        className={`input-field ${className}`}
        placeholder={placeholder}
      />
      {helpText && (
        <div className="mt-1 text-xs text-primary-500">{helpText}</div>
      )}
    </div>
  );
}
