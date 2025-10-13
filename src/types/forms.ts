import type { QuestionType } from "./questionTypes";

export interface GridOption {
  rows: string[];
  columns: string[];
}

export interface ShowWhen {
  questionId: string;
  value: string | number;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  questions: FollowUpQuestion[];
}

export interface FollowUpQuestion {
  id: string;
  text: string;
  type: QuestionType;
  required?: boolean;
  options?: string[];
  gridOptions?: GridOption;
  min?: number;
  max?: number;
  step?: number;
  showWhen?: ShowWhen;
  parentId?: string;
  imageUrl?: string;
  description?: string;
  sectionId?: string;
  followUpQuestions?: FollowUpQuestion[]; // Support nested follow-ups
  requireFollowUp?: boolean; // Make follow-up mandatory for certain question types
}

export interface Question {
  id: string;
  title: string;
  description: string;
  logoUrl?: string;
  imageUrl?: string;
  sections: Section[];
  followUpQuestions: FollowUpQuestion[];
  parentFormId?: string;
  parentFormTitle?: string;
  locationEnabled?: boolean;
}

export interface Response {
  id: string;
  questionId: string;
  answers: Record<string, any>;
  timestamp: string;
  parentResponseId?: string;
  assignedTo?: string;
  assignedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  status?: "pending" | "verified" | "rejected";
  notes?: string;
  submissionMetadata?: {
    ipAddress?: string;
    userAgent?: string;
    browser?: string;
    device?: string;
    os?: string;
    location?: {
      country?: string;
      countryCode?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      timezone?: string;
      isp?: string;
    };
    capturedLocation?: {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      source?: "browser" | "ip" | "manual" | "unknown";
      capturedAt?: string;
    };
    submittedAt?: string;
  };
}

export interface Profile {
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  avatar?: string;
  userId: string;
  username?: string;
}
