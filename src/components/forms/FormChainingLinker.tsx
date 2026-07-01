import React, { useState, useEffect } from 'react';
import { Link2, X, AlertCircle, CheckCircle, Loader, Trash2 } from 'lucide-react';

interface Form {
  id: string;
  title: string;
  description: string;
}

interface FormChainingLinkerProps {
  currentFormId: string;
  onFormLinked?: (nextFormId: string) => void;
}

export const FormChainingLinker: React.FC<FormChainingLinkerProps> = ({
  currentFormId,
  onFormLinked
}) => {
  const [availableForms, setAvailableForms] = useState<Form[]>([]);
  const [linkedForm, setLinkedForm] = useState<Form | null>(null);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAvailableForms();
    loadCurrentLink();
  }, [currentFormId]);

  const loadAvailableForms = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/forms', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load forms');
      }

      const result = await response.json();
      const forms = result.data.forms || [];
      const filtered = forms.filter((f: Form) => f.id !== currentFormId);
      setAvailableForms(filtered);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load forms';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentLink = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/forms/${currentFormId}/next-form`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return;
      }

      const result = await response.json();
      if (result.data.nextForm) {
        setLinkedForm(result.data.nextForm);
      }
    } catch (err) {
      console.error('Error loading current link:', err);
    }
  };

  const handleLinkForm = async () => {
    if (!selectedFormId) {
      setError('Please select a form');
      return;
    }

    setLinking(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/forms/${currentFormId}/link-next-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ nextFormId: selectedFormId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to link form');
      }

      const selectedForm = availableForms.find(f => f.id === selectedFormId);
      setLinkedForm(selectedForm || null);
      setSuccess('Form linked successfully!');
      setShowSelector(false);
      setSelectedFormId('');

      if (onFormLinked && selectedFormId) {
        onFormLinked(selectedFormId);
      }

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to link form';
      setError(errorMessage);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkForm = async () => {
    setLinking(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/forms/${currentFormId}/link-next-form`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to unlink form');
      }

      setLinkedForm(null);
      setSuccess('Form unlinked successfully!');

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unlink form';
      setError(errorMessage);
    } finally {
      setLinking(false);
    }
  };

  const filteredForms = availableForms.filter(
    form =>
      form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Link2 className="h-5 w-5 text-blue-600" />
          Form Chaining
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
          Link this form to another form. After submission, customers will automatically see the linked form.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader className="animate-spin h-6 w-6 text-blue-500" />
        </div>
      ) : linkedForm ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-blue-600 font-medium mb-2">Linked to:</p>
              <h4 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{linkedForm.title}</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">{linkedForm.description}</p>
            </div>
            <button
              onClick={handleUnlinkForm}
              disabled={linking}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              title="Unlink form"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-blue-200">
            <button
              onClick={() => setShowSelector(true)}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Change linked form
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No form linked yet</p>
          <button
            onClick={() => setShowSelector(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Link2 className="h-4 w-4" />
            Link a Form
          </button>
        </div>
      )}

      {showSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-96 flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Select Form to Link</h4>
              <button
                onClick={() => {
                  setShowSelector(false);
                  setSearchQuery('');
                  setSelectedFormId('');
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                placeholder="Search forms..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredForms.length === 0 ? (
                <div className="p-6 text-center text-gray-600 dark:text-gray-400">
                  No forms available
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredForms.map(form => (
                    <button
                      key={form.id}
                      onClick={() => setSelectedFormId(form.id)}
                      className={`w-full text-left p-4 hover:bg-blue-50 transition-colors ${
                        selectedFormId === form.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                    >
                      <h5 className="font-semibold text-gray-800 dark:text-gray-200">{form.title}</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{form.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowSelector(false);
                  setSearchQuery('');
                  setSelectedFormId('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkForm}
                disabled={!selectedFormId || linking}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-blue-400"
              >
                {linking ? 'Linking...' : 'Link Form'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
