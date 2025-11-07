import React from "react";
import { Plus } from "lucide-react";
import type { Section } from "../../types/forms";
import SectionEditor from "./SectionEditor";

interface SectionsListProps {
  sections?: Section[];
  onSectionsChange: (sections: Section[]) => void;
}

export default function SectionsList({
  sections = [],
  onSectionsChange,
}: SectionsListProps) {
  const addSection = () => {
    const newSection: Section = {
      id: crypto.randomUUID(),
      title: "",
      weightage: 0,
      questions: [],
    };
    onSectionsChange([...sections, newSection]);
  };

  const copySection = (index: number) => {
    const sectionToCopy = sections[index];
    const newSection: Section = {
      ...sectionToCopy,
      id: crypto.randomUUID(),
      title: `${sectionToCopy.title} (Copy)`,
      questions: sectionToCopy.questions.map((q) => ({
        ...q,
        id: crypto.randomUUID(),
      })),
    };
    const updatedSections = [...sections];
    updatedSections.splice(index + 1, 0, newSection);
    onSectionsChange(updatedSections);
  };

  const updateSection = (index: number, updates: Partial<Section>) => {
    const updatedSections = [...sections];
    updatedSections[index] = { ...updatedSections[index], ...updates };
    onSectionsChange(updatedSections);
  };

  const removeSection = (index: number) => {
    onSectionsChange(sections.filter((_, i) => i !== index));
  };

  const moveSection = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= sections.length) return;
    const updatedSections = [...sections];
    const [movedSection] = updatedSections.splice(fromIndex, 1);
    updatedSections.splice(toIndex, 0, movedSection);
    onSectionsChange(updatedSections);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-medium text-primary-600">Sections</h3>
        <button
          onClick={addSection}
          className="btn-primary flex items-center px-5 py-2.5"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Section
        </button>
      </div>

      <div className="space-y-6">
        {sections.map((section, index) => (
          <SectionEditor
            key={section.id}
            section={section}
            onUpdate={(updates) => updateSection(index, updates)}
            onRemove={() => removeSection(index)}
            onCopy={() => copySection(index)}
            onMoveUp={
              index > 0 ? () => moveSection(index, index - 1) : undefined
            }
            onMoveDown={
              index < sections.length - 1
                ? () => moveSection(index, index + 1)
                : undefined
            }
          />
        ))}

        {sections.length === 0 && (
          <div className="text-center py-16 card p-8 bg-neutral-50">
            <p className="text-primary-500 text-lg">
              No sections added yet. Click "Add Section" to create your first
              section.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
