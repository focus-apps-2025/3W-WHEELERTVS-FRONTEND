import type { Question, Response, Profile, StaffMember } from "../types";

const STORAGE_KEYS = {
  QUESTIONS: "form_questions",
  RESPONSES: "form_responses",
  PROFILE: "user_profile",
  SETTINGS: "user_settings",
  STAFF: "staff_members",
  FORM_VISIBILITY: "form_visibility",
  FORMS: "forms",
} as const;

// Questions API
export const questionsApi = {
  getAll: (): Question[] => {
    const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    return data ? JSON.parse(data) : [];
  },

  getById: (id: string): Question | undefined => {
    const questions = questionsApi.getAll();
    return questions.find((q) => q.id === id);
  },

  save: (question: Question): void => {
    const questions = questionsApi.getAll();
    const index = questions.findIndex((q) => q.id === question.id);

    if (index >= 0) {
      questions[index] = question;
    } else {
      questions.push(question);
    }

    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
  },

  delete: (id: string): void => {
    const questions = questionsApi.getAll();
    const updatedQuestions = questions.filter((q) => q.id !== id);
    localStorage.setItem(
      STORAGE_KEYS.QUESTIONS,
      JSON.stringify(updatedQuestions)
    );
  },

  deleteMany: (ids: string[]): void => {
    const questions = questionsApi.getAll();
    const updatedQuestions = questions.filter((q) => !ids.includes(q.id));
    localStorage.setItem(
      STORAGE_KEYS.QUESTIONS,
      JSON.stringify(updatedQuestions)
    );
  },
};

// Responses API
export const responsesApi = {
  getAll: (): Response[] => {
    const data = localStorage.getItem(STORAGE_KEYS.RESPONSES);
    return data ? JSON.parse(data) : [];
  },

  getByQuestionId: (questionId: string): Response[] => {
    const responses = responsesApi.getAll();
    return responses.filter((r) => r.questionId === questionId);
  },

  save: (response: Response): void => {
    const responses = responsesApi.getAll();
    const index = responses.findIndex((r) => r.id === response.id);

    if (index >= 0) {
      responses[index] = response;
    } else {
      responses.push(response);
    }

    localStorage.setItem(STORAGE_KEYS.RESPONSES, JSON.stringify(responses));
  },

  saveMany: (newResponses: Response[]): void => {
    const responses = responsesApi.getAll();

    newResponses.forEach((newResponse) => {
      const index = responses.findIndex((r) => r.id === newResponse.id);
      if (index >= 0) {
        responses[index] = newResponse;
      } else {
        responses.push(newResponse);
      }
    });

    localStorage.setItem(STORAGE_KEYS.RESPONSES, JSON.stringify(responses));
  },

  delete: (id: string): void => {
    const responses = responsesApi.getAll();
    const updatedResponses = responses.filter((r) => r.id !== id);
    localStorage.setItem(
      STORAGE_KEYS.RESPONSES,
      JSON.stringify(updatedResponses)
    );
  },

  deleteMany: (ids: string[]): void => {
    const responses = responsesApi.getAll();
    const updatedResponses = responses.filter((r) => !ids.includes(r.id));
    localStorage.setItem(
      STORAGE_KEYS.RESPONSES,
      JSON.stringify(updatedResponses)
    );
  },

  deleteByQuestionId: (questionId: string): void => {
    const responses = responsesApi.getAll();
    const updatedResponses = responses.filter(
      (r) => r.questionId !== questionId
    );
    localStorage.setItem(
      STORAGE_KEYS.RESPONSES,
      JSON.stringify(updatedResponses)
    );
  },
};

// Profile API
export const profileApi = {
  get: (): Profile | null => {
    const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
    return data ? JSON.parse(data) : null;
  },

  save: (profile: Profile): void => {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  },
};

// Settings API
export const settingsApi = {
  get: () => {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data
      ? JSON.parse(data)
      : {
          darkMode: false,
          notifications: true,
          emailUpdates: true,
          language: "en",
        };
  },

  save: (settings: any): void => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },
};

// Staff API
export const staffApi = {
  getAll: (): StaffMember[] => {
    const data = localStorage.getItem(STORAGE_KEYS.STAFF);
    return data ? JSON.parse(data) : [];
  },

  save: (member: StaffMember): void => {
    const staff = staffApi.getAll();
    const index = staff.findIndex((m) => m.id === member.id);

    if (index >= 0) {
      staff[index] = member;
    } else {
      staff.push(member);
    }

    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
  },

  delete: (id: string): void => {
    const staff = staffApi.getAll();
    localStorage.setItem(
      STORAGE_KEYS.STAFF,
      JSON.stringify(staff.filter((m) => m.id !== id))
    );
  },
};

// Form Visibility API
export const formVisibilityApi = {
  getAll: (): Record<string, boolean> => {
    const data = localStorage.getItem(STORAGE_KEYS.FORM_VISIBILITY);
    return data ? JSON.parse(data) : {};
  },

  setVisibility: (formId: string, isVisible: boolean): void => {
    const visibilityData = formVisibilityApi.getAll();
    visibilityData[formId] = isVisible;
    localStorage.setItem(
      STORAGE_KEYS.FORM_VISIBILITY,
      JSON.stringify(visibilityData)
    );
  },

  isVisible: (formId: string): boolean => {
    const visibilityData = formVisibilityApi.getAll();
    return visibilityData[formId] ?? false;
  },
};
