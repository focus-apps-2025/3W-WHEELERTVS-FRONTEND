export const questionTypes = [
  { value: "text", label: "Text" },
  { value: "paragraph", label: "Paragraph" },
  { value: "radio", label: "Multiple Choice" },
  { value: "yesNoNA", label: "Yes / No / N/A" },
  { value: "checkbox", label: "Checkboxes" },
  { value: "search-select", label: "Search/Filter Dropdown" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "tel", label: "Phone Number" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "file", label: "File Upload" },
  { value: "range", label: "Range" },
  { value: "rating", label: "Rating" },
  { value: "scale", label: "Linear Scale" },
  { value: "radio-grid", label: "Multiple Choice Grid" },
  { value: "checkbox-grid", label: "Checkbox Grid" },
  { value: "radio-image", label: "Image Choice" },
] as const;

export type QuestionType = (typeof questionTypes)[number]["value"];
