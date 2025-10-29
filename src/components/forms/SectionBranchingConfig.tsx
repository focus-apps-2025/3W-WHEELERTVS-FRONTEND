import React, { useState } from 'react';
import { ChevronDown, Link2, X, Plus } from 'lucide-react';

interface BranchingRule {
  optionLabel: string;
  targetSectionId: string;
  isOtherOption?: boolean;
}

interface SectionBranchingConfigProps {
  questionId: string;
  sectionId: string;
  options: string[];
  sections: { id: string; title: string }[];
  existingRules?: BranchingRule[];
  onSave: (rules: BranchingRule[]) => void;
  onClose: () => void;
}

export const SectionBranchingConfig: React.FC<SectionBranchingConfigProps> = ({
  questionId,
  sectionId,
  options,
  sections,
  existingRules = [],
  onSave,
  onClose
}) => {
  const [rules, setRules] = useState<BranchingRule[]>(existingRules);
  const [otherOptionEnabled, setOtherOptionEnabled] = useState(
    existingRules.some(r => r.isOtherOption)
  );
  const [otherTargetSection, setOtherTargetSection] = useState(
    existingRules.find(r => r.isOtherOption)?.targetSectionId || ''
  );

  const handleOptionChange = (optionLabel: string, targetSectionId: string) => {
    setRules(prev => {
      const existing = prev.findIndex(r => r.optionLabel === optionLabel && !r.isOtherOption);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { optionLabel, targetSectionId };
        return updated;
      }
      return [...prev, { optionLabel, targetSectionId }];
    });
  };

  const handleRemoveRule = (optionLabel: string) => {
    setRules(prev => prev.filter(r => r.optionLabel !== optionLabel));
  };

  const handleOtherOptionChange = (targetSectionId: string) => {
    setOtherTargetSection(targetSectionId);
  };

  const handleSave = () => {
    let finalRules = [...rules];
    
    if (otherOptionEnabled && otherTargetSection) {
      finalRules = finalRules.filter(r => !r.isOtherOption);
      finalRules.push({
        optionLabel: 'Other',
        targetSectionId: otherTargetSection,
        isOtherOption: true
      });
    } else {
      finalRules = finalRules.filter(r => !r.isOtherOption);
    }
    
    onSave(finalRules);
  };

  const getTargetSectionLabel = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    return section ? section.title : 'Select Section';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Configure Section Routing</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              Map each option to the section it should navigate to when selected by the user.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900">Option Routing</h4>
            {options.map(option => {
              const rule = rules.find(r => r.optionLabel === option && !r.isOtherOption);
              return (
                <div key={option} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">{option}</p>
                  </div>
                  <select
                    value={rule?.targetSectionId || ''}
                    onChange={e => handleOptionChange(option, e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">No routing (Continue to next)</option>
                    {sections.map(section => (
                      <option key={section.id} value={section.id}>
                        → {section.title}
                      </option>
                    ))}
                  </select>
                  {rule && (
                    <button
                      onClick={() => handleRemoveRule(option)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-4 mb-4">
              <input
                type="checkbox"
                id="otherOption"
                checked={otherOptionEnabled}
                onChange={e => setOtherOptionEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="otherOption" className="text-sm font-medium text-gray-700">
                Enable "Other" option with free text entry
              </label>
            </div>
            {otherOptionEnabled && (
              <div className="ml-8 p-4 bg-gray-50 rounded-lg">
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Route "Other" responses to:
                </label>
                <select
                  value={otherTargetSection}
                  onChange={e => handleOtherOptionChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Section</option>
                  {sections.map(section => (
                    <option key={section.id} value={section.id}>
                      {section.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Link2 className="h-4 w-4" />
            Save Routing
          </button>
        </div>
      </div>
    </div>
  );
};
