import type { Section } from '../types';

const STORAGE_KEY = 'form_sections';

export const sectionsApi = {
  getAll: (): Record<string, Section[]> => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  },

  getByFormId: (formId: string): Section[] => {
    const data = sectionsApi.getAll();
    return data[formId] || [];
  },

  save: (formId: string, sections: Section[]): void => {
    const data = sectionsApi.getAll();
    data[formId] = sections;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  delete: (formId: string): void => {
    const data = sectionsApi.getAll();
    delete data[formId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  deleteMany: (formIds: string[]): void => {
    const data = sectionsApi.getAll();
    formIds.forEach(id => delete data[id]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
};