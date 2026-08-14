// ShareAnalyticsModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Mail, Send, Users, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';

interface ShareAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
  analyticsData?: any;
}

const ShareAnalyticsModal: React.FC<ShareAnalyticsModalProps> = ({
  isOpen,
  onClose,
  formId,
  formTitle,
  analyticsData
}) => {
  // State declarations
  const [invites, setInvites] = useState<Array<{ email: string; phone?: string }>>([]);
  const [channels, setChannels] = useState<string[]>(['email']);
  const [customMessage, setCustomMessage] = useState('');
  const [shareMode, setShareMode] = useState<'link' | 'pdf' | 'both'>('both');
  const [isSending, setIsSending] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Show toast function
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const result = await apiClient.uploadAnalyticsInvites(formId, file);

      if (result && result.preview) {
        setPreview(result.preview);
        const invitesFromFile = result.preview.map((item: any) => ({
          email: item.email || '',
          phone: item.phone || ''
        }));
        setInvites(invitesFromFile);
        showToast(`Uploaded ${invitesFromFile.length} invites successfully!`, 'success');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      showToast(error.message || 'Failed to upload file', 'error');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Handle manual invite addition
  const handleAddInvite = () => {
    setInvites([...invites, { email: '', phone: '' }]);
  };

  const handleRemoveInvite = (index: number) => {
    setInvites(invites.filter((_, i) => i !== index));
  };

  const handleInviteChange = (index: number, field: 'email' | 'phone', value: string) => {
    const updated = [...invites];
    updated[index][field] = value;
    setInvites(updated);
  };

  // Handle send
  const handleSend = async () => {
    // Validate invites
    const validInvites = invites.filter(invite => invite.email || invite.phone);

    if (validInvites.length === 0) {
      showToast('Please add at least one valid invite (email or phone)', 'error');
      return;
    }

    if (channels.length === 0) {
      showToast('Please select at least one channel', 'error');
      return;
    }

    try {
      setIsSending(true);

      console.log('📤 Sending analytics invites:', {
        formId,
        invitesCount: validInvites.length,
        channels,
        shareMode,
        hasCustomMessage: !!customMessage,
        hasAnalyticsData: !!analyticsData
      });

      // Generate PDF HTML if shareMode includes PDF
      let pdfHtml = '';
      if (shareMode === 'pdf' || shareMode === 'both') {
        // You'll need to implement generatePDFHtml based on your analyticsData
        // For now, we'll pass a simple placeholder
        pdfHtml = `<h1>${formTitle} Analytics Report</h1><p>Report generated at ${new Date().toISOString()}</p>`;

        // If you have analyticsData, you can generate a proper HTML report
        if (analyticsData) {
          pdfHtml = generateAnalyticsPDFHtml(formTitle, analyticsData);
        }
      }

      // Call the API
      const result = await apiClient.sendAnalyticsInvites(
        formId,
        validInvites,
        channels,
        customMessage || 'Please review the analytics report.',
        pdfHtml,
        shareMode
      );

      console.log('📥 API Response:', result);

      // Check if result exists
      if (!result) {
        throw new Error('No response from server');
      }

      const sent = result.sent || 0;
      const failed = result.failed || 0;
      const allSuccessful = result.allSuccessful || false;

      if (allSuccessful) {
        showToast(`Successfully sent ${sent} invites!`, 'success');
        // Reset form
        setInvites([]);
        setCustomMessage('');
        setTimeout(() => onClose(), 2000);
      } else {
        showToast(`Sent ${sent} invites, ${failed} failed.`, 'error');
      }
    } catch (error: any) {
      console.error('❌ Error sending invites:', error);
      showToast(error.message || 'Failed to send invites. Please try again.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Generate Analytics PDF HTML
  const generateAnalyticsPDFHtml = (title: string, data: any): string => {
    // This is a placeholder - you should implement proper HTML generation
    // based on your analytics data structure
    return `
      <!DOCTYPE html>
      <html>
        <head><title>${title} - Analytics Report</title></head>
        <body>
          <h1>${title}</h1>
          <h2>Analytics Report</h2>
          <p>Generated: ${new Date().toISOString()}</p>
          <hr/>
          <h3>Summary</h3>
          <pre>${JSON.stringify(data, null, 2)}</pre>
        </body>
      </html>
    `;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Share Analytics: {formTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Upload Section */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Upload Invites (Excel/CSV)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-indigo-50 file:text-indigo-700
                hover:file:bg-indigo-100
                dark:file:bg-indigo-900/20 dark:file:text-indigo-400"
            />
            {uploading && (
              <div className="flex items-center gap-2 mt-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span className="text-sm text-gray-500">Uploading...</span>
              </div>
            )}
            {preview.length > 0 && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                ✓ {preview.length} invites loaded
              </p>
            )}
          </div>

          {/* Manual Invites */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Invites ({invites.length})
              </label>
              <button
                onClick={handleAddInvite}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {invites.map((invite, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="email"
                    placeholder="Email"
                    value={invite.email}
                    onChange={(e) => handleInviteChange(index, 'email', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                  <input
                    type="tel"
                    placeholder="Phone (optional)"
                    value={invite.phone}
                    onChange={(e) => handleInviteChange(index, 'phone', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    onClick={() => handleRemoveInvite(index)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Channels */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Channels
            </label>
            <div className="flex gap-3">
              {['email', 'whatsapp', 'sms'].map((channel) => (
                <label key={channel} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={channels.includes(channel)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setChannels([...channels, channel]);
                      } else {
                        setChannels(channels.filter(c => c !== channel));
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm capitalize">{channel}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Share Mode */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Share Mode
            </label>
            <div className="flex gap-3">
              {['link', 'pdf', 'both'].map((mode) => (
                <label key={mode} className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={shareMode === mode}
                    onChange={() => setShareMode(mode as 'link' | 'pdf' | 'both')}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="text-sm capitalize">{mode}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Custom Message (Optional)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a custom message to your invites..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none h-20"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || invites.length === 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Invites
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium z-50 transition-all ${toast.type === 'success' ? 'bg-green-500' :
            toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareAnalyticsModal;