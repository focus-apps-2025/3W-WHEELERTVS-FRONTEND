import React, { useEffect, useState } from 'react';
import { Link2, X } from 'lucide-react';

import type { Section, BranchingRule } from '../../types/forms';

interface SectionBranchingConfigProps {
  questionId: string;
  sectionId: string;
  options: string[];
  sections: Section[];
  existingRules?: BranchingRule[];
  onSave: (rules: BranchingRule[]) => void;
  onUpdateSection: (sectionId: string, updates: Partial<Section>) => void;
  onClose: () => void;
}

export const SectionBranchingConfig: React.FC<SectionBranchingConfigProps> = ({
  questionId,
  sectionId,
  options,
  sections,
  existingRules = [],
  onSave,
  onUpdateSection,
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

  const hasOtherSections = sections.length > 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Configure Section Routing</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!hasOtherSections ? (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <h4 className="text-lg font-semibold text-yellow-900 mb-2">No Additional Sections Available</h4>
              <p className="text-sm text-yellow-800 mb-4">
                To link this question to another section, you need to create more sections first.
              </p>
              <div className="bg-white dark:bg-gray-900 border border-yellow-200 rounded p-3 text-left text-xs text-yellow-900 mb-4">
                <p className="font-medium mb-2">📋 What to do:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Close this dialog</li>
                  <li>Click "Add New Page (Section)" button</li>
                  <li>Create at least one more section</li>
                  <li>Come back to configure routing</li>
                </ol>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
              >
                Got it, let me create sections
              </button>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  Map each option to the section it should navigate to when selected by the user.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div>Option</div>
                  <div>Mapping (Go to)</div>
                  <div>Then (After mapped section)</div>
                </div>
                {options.map(option => {
                  const rule = rules.find(r => r.optionLabel === option && !r.isOtherOption);
                  const targetSection = sections.find(s => s.id === rule?.targetSectionId);
                  
                  return (
                    <div key={option} className="grid grid-cols-3 items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{option}</p>
                        {rule && (
                          <button
                            onClick={() => handleRemoveRule(option)}
                            className="text-gray-400 hover:text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <select
                        value={rule?.targetSectionId || ''}
                        onChange={e => handleOptionChange(option, e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">No routing (Continue to next)</option>
                        <option value="end">Submit Form here (End)</option>
                        {sections.map((section, idx) => (
                          <option key={section.id} value={section.id}>
                            → Section {idx + 1}: {section.title}
                          </option>
                        ))}
                      </select>
                      
                      <div className="flex items-center">
                        {rule && rule.targetSectionId && rule.targetSectionId !== 'end' && targetSection ? (
                          <select
                            value={targetSection.nextSectionId === 'end' ? 'end' : 'continue'}
                            onChange={e => onUpdateSection(targetSection.id, { 
                              nextSectionId: e.target.value === 'end' ? 'end' : undefined 
                            })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-900"
                          >
                            <option value="continue">Continue to next</option>
                            <option value="end">Submit here (End)</option>
                          </select>
                        ) : (
                          <span className="text-xs text-gray-400 italic px-3">
                            {rule?.targetSectionId === 'end' ? 'Already ending' : 'No mapping'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {hasOtherSections && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex items-center gap-4 mb-4">
                <input
                  type="checkbox"
                  id="otherOption"
                  checked={otherOptionEnabled}
                  onChange={e => setOtherOptionEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="otherOption" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable "Other" option with free text entry
                </label>
              </div>
              {otherOptionEnabled && (
                <div className="ml-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                    Route "Other" responses to:
                  </label>
                  <select
                    value={otherTargetSection}
                    onChange={e => handleOtherOptionChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Section</option>
                    <option value="end">Submit Form here (End)</option>
                    {sections.map(section => (
                      <option key={section.id} value={section.id}>
                        {section.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {hasOtherSections && (
          <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800"
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
        )}
      </div>
    </div>
  );
};
