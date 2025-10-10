// Shared types for Management components

export interface ManagementSection {
  id: string;
  label: string;
  description: string;
}

export interface ManagementCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export interface ManagementButtonProps {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

// Common management colors and styles
export const MANAGEMENT_COLORS = {
  primary: "blue",
  secondary: "gray",
  success: "green",
  warning: "yellow",
  danger: "red",
} as const;

export type ManagementColor = keyof typeof MANAGEMENT_COLORS;
