import React, { useState, useEffect } from "react";
import {
  X,
  Mail,
  MessageCircle,
  FileText,
  Link as LinkIcon,
  Play,
  Pause,
  StopCircle,
  History,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { useNotification } from "../../context/NotificationContext";

interface AutoSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
}

interface Recipient {
  type: 'email' | 'whatsapp';
  value: string;
}

export default function AutoSendModal({
  isOpen,
  onClose,
  formId,
  formTitle,
}: AutoSendModalProps) {
  const [activeTab, setActiveTab] = useState<'setup' | 'history'>('setup');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>({
    enabled: false,
    includePdf: false,
    includeLink: false,
    status: 'stopped',
    recipients: []
  });
  const [history, setHistory] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({});
  const [page, setPage] = useState(1);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      fetchHistory();
    }
  }, [isOpen, formId, page]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAutoSendConfig(formId);
      if (response.success) {
        setConfig(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch config:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await apiClient.getAutoSendHistory(formId, page);
      if (response.success) {
        setHistory(response.data.history);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  const handleSaveConfig = async (newConfig = config) => {
    try {
      setSaving(true);
      const response = await apiClient.updateAutoSendConfig(formId, newConfig);
      if (response.success) {
        setConfig(response.data);
        showSuccess("Configuration updated successfully", "Success");
      }
    } catch (err: any) {
      showError(err.message || "Failed to update configuration", "Error");
    } finally {
      setSaving(false);
    }
  };

  const addRecipient = () => {
    setConfig({
      ...config,
      recipients: [...config.recipients, { type: 'email', value: '' }]
    });
  };

  const updateRecipient = (index: number, field: string, value: string) => {
    const newRecipients = [...config.recipients];
    newRecipients[index] = { ...newRecipients[index], [field]: value };
    setConfig({ ...config, recipients: newRecipients });
  };

  const removeRecipient = (index: number) => {
    const newRecipients = config.recipients.filter((_: any, i: number) => i !== index);
    setConfig({ ...config, recipients: newRecipients });
  };

  const toggleStatus = async (newStatus: 'active' | 'paused' | 'stopped') => {
    const newConfig = {
      ...config,
      status: newStatus,
      enabled: newStatus === 'active'
    };
    await handleSaveConfig(newConfig);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[110] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Auto Send Setup
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{formTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab('setup')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'setup'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Setup & Controls
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Sent History
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'setup' ? (
            <div className="space-y-8">
              {/* Controls */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">
                  Automation Controls
                </h3>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => toggleStatus('active')}
                    disabled={config.status === 'active' || saving}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                      config.status === 'active'
                        ? 'bg-green-100 text-green-700 border border-green-200 cursor-default'
                        : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                    }`}
                  >
                    <Play className="w-4 h-4" />
                    {config.status === 'active' ? 'Running' : 'Start / Restart'}
                  </button>
                  <button
                    onClick={() => toggleStatus('paused')}
                    disabled={config.status === 'paused' || config.status === 'stopped' || saving}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                      config.status === 'paused'
                        ? 'bg-yellow-100 text-yellow-700 border border-yellow-200 cursor-default'
                        : config.status === 'stopped'
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-yellow-500 text-white hover:bg-yellow-600 shadow-sm'
                    }`}
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                  <button
                    onClick={() => toggleStatus('stopped')}
                    disabled={config.status === 'stopped' || saving}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                      config.status === 'stopped'
                        ? 'bg-red-100 text-red-700 border border-red-200 cursor-default'
                        : 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
                    }`}
                  >
                    <StopCircle className="w-4 h-4" />
                    Stop
                  </button>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${config.status === 'active' ? 'bg-green-500 animate-pulse' : config.status === 'paused' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                  Currently {config.status} - Each 24 hours once
                </div>
              </div>

              {/* Options */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">
                  Content Options
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={config.includePdf}
                      onChange={(e) => setConfig({ ...config, includePdf: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300"
                    />
                    <div className="ml-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-red-500" />
                      <span className="font-medium text-gray-700 dark:text-gray-200">Include PDF Report</span>
                    </div>
                  </label>
                  <label className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={config.includeLink}
                      onChange={(e) => setConfig({ ...config, includeLink: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300"
                    />
                    <div className="ml-3 flex items-center gap-2">
                      <LinkIcon className="w-5 h-5 text-blue-500" />
                      <span className="font-medium text-gray-700 dark:text-gray-200">Include Form Link</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Recipients */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                    Recipients
                  </h3>
                  <button
                    onClick={addRecipient}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Recipient
                  </button>
                </div>
                <div className="space-y-3">
                  {config.recipients.map((recipient: any, index: number) => (
                    <div key={index} className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                      <select
                        value={recipient.type}
                        onChange={(e) => updateRecipient(index, 'type', e.target.value)}
                        className="w-32 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="email">Email</option>
                        <option value="whatsapp">WhatsApp</option>
                      </select>
                      <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          {recipient.type === 'email' ? (
                            <Mail className="h-4 w-4 text-gray-400" />
                          ) : (
                            <MessageCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        <input
                          type={recipient.type === 'email' ? 'email' : 'tel'}
                          value={recipient.value}
                          onChange={(e) => updateRecipient(index, 'value', e.target.value)}
                          placeholder={recipient.type === 'email' ? "email@example.com" : "+91..."}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        onClick={() => removeRecipient(index)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {config.recipients.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-gray-500">
                      No recipients added. Add someone to start sending.
                    </div>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => handleSaveConfig()}
                  disabled={saving}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  Save Configuration
                </button>
              </div>
            </div>
          ) : (
            /* History Tab */
            <div className="space-y-4">
              {history.length > 0 ? (
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Recipient</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {history.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.recipient}</td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5">
                              {item.type === 'email' ? <Mail className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                              {item.type}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(item.sentAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No history found for this form.</p>
                </div>
              )}
              
              {/* Pagination (Simplified) */}
              {pagination.pages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="px-3 py-1">Page {page} of {pagination.pages}</span>
                  <button
                    disabled={page === pagination.pages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
