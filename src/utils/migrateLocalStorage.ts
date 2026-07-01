/**
 * Utility to migrate legacy question types in localStorage
 * This should be run once when the app loads to fix any cached forms
 */

interface Question {
  id: string;
  type: string;
  [key: string]: any;
}

interface Form {
  id: string;
  sections?: Array<{
    questions?: Question[];
  }>;
  questions?: Question[];
  followUpQuestions?: Question[];
  [key: string]: any;
}

const LEGACY_TYPE_MAP: Record<string, string> = {
  select: "search-select",
  textarea: "paragraph",
};

/**
 * Recursively migrate question types in a question object
 */
function migrateQuestion(question: Question): boolean {
  let changed = false;

  // Migrate the question type if it's a legacy type
  if (question.type && LEGACY_TYPE_MAP[question.type]) {
    console.log(
      `Migrating question "${question.id}": ${question.type} -> ${
        LEGACY_TYPE_MAP[question.type]
      }`
    );
    question.type = LEGACY_TYPE_MAP[question.type];
    changed = true;
  }

  // Recursively migrate follow-up questions
  if (question.followUpQuestions && Array.isArray(question.followUpQuestions)) {
    for (const followUp of question.followUpQuestions) {
      if (migrateQuestion(followUp)) {
        changed = true;
      }
    }
  }

  return changed;
}

/**
 * Migrate a single form object
 */
function migrateForm(form: Form): boolean {
  let changed = false;

  // Migrate questions in sections
  if (form.sections && Array.isArray(form.sections)) {
    for (const section of form.sections) {
      if (section.questions && Array.isArray(section.questions)) {
        for (const question of section.questions) {
          if (migrateQuestion(question)) {
            changed = true;
          }
        }
      }
    }
  }

  // Migrate top-level questions (legacy structure)
  if (form.questions && Array.isArray(form.questions)) {
    for (const question of form.questions) {
      if (migrateQuestion(question)) {
        changed = true;
      }
    }
  }

  // Migrate top-level follow-up questions
  if (form.followUpQuestions && Array.isArray(form.followUpQuestions)) {
    for (const question of form.followUpQuestions) {
      if (migrateQuestion(question)) {
        changed = true;
      }
    }
  }

  return changed;
}

/**
 * Migrate all forms in localStorage
 */
export function migrateLocalStorageForms(): void {
  try {
    console.log("🔄 Checking localStorage for legacy question types...");

    let totalMigrated = 0;

    // Migrate 'form_questions' key
    const questionsData = localStorage.getItem("form_questions");
    if (questionsData) {
      try {
        const questions = JSON.parse(questionsData);
        if (Array.isArray(questions)) {
          let changed = false;
          for (const form of questions) {
            if (migrateForm(form)) {
              changed = true;
              totalMigrated++;
            }
          }
          if (changed) {
            localStorage.setItem("form_questions", JSON.stringify(questions));
            console.log(
              `✅ Migrated ${totalMigrated} forms in 'form_questions'`
            );
          }
        }
      } catch (e) {
        console.error("Error migrating form_questions:", e);
      }
    }

    // Migrate 'forms' key
    const formsData = localStorage.getItem("forms");
    if (formsData) {
      try {
        const forms = JSON.parse(formsData);
        if (Array.isArray(forms)) {
          let changed = false;
          for (const form of forms) {
            if (migrateForm(form)) {
              changed = true;
              totalMigrated++;
            }
          }
          if (changed) {
            localStorage.setItem("forms", JSON.stringify(forms));
            console.log(`✅ Migrated ${totalMigrated} forms in 'forms'`);
          }
        }
      } catch (e) {
        console.error("Error migrating forms:", e);
      }
    }

    if (totalMigrated > 0) {
      console.log(`✅ Migration complete! ${totalMigrated} forms updated.`);
    } else {
      console.log("✅ No legacy question types found in localStorage.");
    }
  } catch (error) {
    console.error("❌ Error during localStorage migration:", error);
  }
}

/**
 * Clear all form-related data from localStorage
 * Use this as a last resort if migration fails
 */
export function clearFormCache(): void {
  console.log("🗑️ Clearing form cache from localStorage...");
  localStorage.removeItem("form_questions");
  localStorage.removeItem("forms");
  console.log("✅ Form cache cleared!");
}
