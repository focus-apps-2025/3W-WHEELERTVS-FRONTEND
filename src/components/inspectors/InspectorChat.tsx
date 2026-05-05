import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiClient } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { 
  MessageCircle, 
  Send, 
  Reply, 
  User, 
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  Edit,
  BarChart3,
  Eye
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Function to render message with images
const renderMessageWithImages = (message: string) => {
  if (!message) return null;

  console.log('🖼️ renderMessageWithImages called with:', message);

  // Split message by image markdown syntax
  const parts = message.split(/(!\[.*?\]\(.*?\))/g);
  console.log('🖼️ Message parts:', parts);

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        // Check if this part is an image markdown
        const imageMatch = part.match(/!\[.*?\]\((.*?)\)/);
        if (imageMatch) {
          const imageUrl = imageMatch[1];
          return (
            <div key={index} className="inline-block">
              <img
                src={imageUrl}
                alt="Evidence"
                className="max-w-32 max-h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(imageUrl, '_blank')}
                onError={(e) => {
                  console.error('Image failed to load:', imageUrl);
                  e.currentTarget.style.display = 'none';
                  // Show fallback text
                  const fallback = document.createElement('div');
                  fallback.className = 'text-xs text-red-500 mt-1';
                  fallback.textContent = 'Image failed to load';
                  e.currentTarget.parentNode?.appendChild(fallback);
                }}
                onLoad={() => console.log('Image loaded successfully:', imageUrl)}
              />
            </div>
          );
        }
        // Regular text part
        return part.trim() ? (
          <span key={index} className="whitespace-pre-wrap">{part}</span>
        ) : null;
      })}
    </div>
  );
};

// Advanced Question Display Component for InspectorChat
const QuestionDisplayRenderer = ({ question, suggestion, onSuggestionChange, user, responseId, submitterId }: any) => {
  const [selectedOption, setSelectedOption] = useState(suggestion?.selected || '');
  const [selectedZones, setSelectedZones] = useState<string[]>(suggestion?.zones || []);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with suggestion prop changes
  useEffect(() => {
    setSelectedOption(suggestion?.selected || '');
  }, [suggestion?.selected]);

  useEffect(() => {
    setSelectedZones(suggestion?.zones || []);
  }, [suggestion?.zones]);

  // Determine question type (Zone In vs Zone Out)
  const isZoneIn = question?.text?.toLowerCase().includes('zone') &&
                   (question?.text?.toLowerCase().includes('in') ||
                    question?.type?.toLowerCase().includes('zone'));

  const isZoneOut = question?.text?.toLowerCase().includes('zone') &&
                    (question?.text?.toLowerCase().includes('out') ||
                     question?.type?.toLowerCase().includes('zone-out'));

  // Get selectable options (filter out follow-up related options)
  const options = question?.options || suggestion?.options || [];
  const selectableOptions = options.filter((opt: string) => {
    const lowerOpt = opt.toLowerCase();
    return !(
      lowerOpt.includes('remark') ||
      lowerOpt.includes('enter response') ||
      lowerOpt.includes('file update') ||
      lowerOpt.includes('manual upload') ||
      lowerOpt.includes('#1') ||
      lowerOpt.includes('historical record')
    );
  });

  // Determine what follow-ups to show based on question type and selected option
  const showFollowUps = () => {
    // Always show follow-ups if an option is selected, regardless of question type
    return !!selectedOption;
  };

  const needsZoneSelection = isZoneIn && (selectedOption?.toLowerCase().includes('reject') || selectedOption?.toLowerCase().includes('rework'));
  const shouldShowFollowUps = showFollowUps();

  // Debug: Uncomment to troubleshoot
  // console.log('InspectorChat QuestionDisplayRenderer:', {
  //   isZoneIn,
  //   isZoneOut,
  //   selectedOption,
  //   needsZoneSelection,
  //   shouldShowFollowUps,
  //   question: question?.text,
  //   questionType: question?.type
  // });

  // Debug logging for troubleshooting
  console.log('QuestionDisplayRenderer:', {
    question: question?.text,
    options: question?.options,
    suggestionOptions: suggestion?.options,
    selectableOptions,
    selectedOption,
    shouldShowFollowUps
  });

  if (selectableOptions.length > 0) {
    return (
      <div className="space-y-3 mt-2" onClick={e => e.stopPropagation()}>
        {/* Question Type Indicator */}
        {(isZoneIn || isZoneOut) && (
          <div className="text-xs font-bold text-center py-1 px-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
            {isZoneIn ? '🔍 ZONE IN INSPECTION' : '📤 ZONE OUT INSPECTION'}
          </div>
        )}

        {/* Main Options */}
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-2">
            Select Option
          </label>
          <div className="flex flex-wrap gap-2">
            {selectableOptions.map((opt: string) => {
              const isSelected = selectedOption === opt;
              return (
                <button
                  key={opt}
                  onClick={() => {
                     setSelectedOption(opt);
                     const status = `${opt} by ${user?.name || user?.email || 'Unknown'}`;
                     onSuggestionChange({ ...(suggestion || {}), selected: opt, status });
                   }}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg border-2 transition-all
                    ${isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-300'
                    }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Zone Selection (for Zone In + Reject/Rework) */}
        {needsZoneSelection && (
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800">
            <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest block mb-2">
              Select Zones
            </label>
            <div className="flex flex-wrap gap-2">
              {['Zone A+', 'Zone A', 'Zone B', 'Zone C'].map((zone) => (
                <button
                  key={zone}
                  onClick={() => {
                    const newZones = selectedZones.includes(zone)
                      ? selectedZones.filter(z => z !== zone)
                      : [...selectedZones, zone];
                    setSelectedZones(newZones);
                    onSuggestionChange({ ...(suggestion || {}), zones: newZones });
                  }}
                  className={`px-3 py-1.5 text-[9px] font-bold rounded-lg border-2 transition-all
                    ${selectedZones.includes(zone)
                      ? 'bg-orange-600 border-orange-600 text-white shadow-md'
                      : 'bg-white dark:bg-gray-800 border-orange-200 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:border-orange-300'
                    }`}
                >
                  {zone}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Follow-ups (Remarks + File Upload) */}
        {shouldShowFollowUps && (
          <>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border-2 border-amber-300 dark:border-amber-600">
              <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-1">
                📝 Remarks {selectedOption ? `for ${selectedOption}` : ''}
              </label>
              <textarea
                rows={2}
                value={suggestion?.remark || ''}
                onChange={(e) => onSuggestionChange({ ...(suggestion || {}), remark: e.target.value })}
                placeholder="Enter remarks..."
                className="w-full p-2 text-xs bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-700 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none resize-none"
              />
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-300 dark:border-blue-600">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1.5">
                📎 File Upload {selectedOption ? `for ${selectedOption}` : ''}
              </label>
              <input
                ref={fileInputRef}
                key={`file-input-${selectedOption}`} // Key changes when selectedOption changes
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    console.log('File input changed, selected file:', file.name);
                    try {
                      console.log('Uploading file for', selectedOption, ':', file.name);
                      const result = await apiClient.uploadFile(file, "form");
                      console.log('Upload result:', result);
                      const uploadedUrl = apiClient.resolveUploadedFileUrl(result);
                      console.log('Resolved uploaded URL:', uploadedUrl);

                      if (uploadedUrl) {
                        // Add the image URL to the suggestion
                        const imageMarkdown = `![${selectedOption} Evidence](${uploadedUrl})`;
                        const newSuggestion = {
                          ...(suggestion || {}),
                          images: [...(suggestion?.images || []), uploadedUrl],
                          imageMarkdown: (suggestion?.imageMarkdown || '') + '\n' + imageMarkdown
                        };
                        console.log('New suggestion object:', newSuggestion);
                        onSuggestionChange(newSuggestion);
                        console.log('File uploaded successfully:', uploadedUrl);

                        // Reset the file input after successful upload
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                          console.log('File input reset');
                        }
                      } else {
                        console.error('No uploaded URL received');
                        alert('File upload failed: No URL received');
                      }
                    } catch (error) {
                      console.error('File upload failed:', error);
                      alert('File upload failed. Please try again.');

                      // Reset the file input on error too
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }
                  } else {
                    console.log('No file selected');
                  }
                }}
                className="w-full p-2 text-xs bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {selectedOption && responseId && activeThread?.submittedBy && (
              <button
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    const reviewData = {
                      responseId,
                      reviewerId: user._id,
                      submitterId,
                      reviewOption: selectedOption,
                      tenantId: user.tenantId || user.tenant?._id
                    };
                    console.log('Submitting review:', reviewData);
                    await apiClient.submitReview(reviewData);
                    alert('Review submitted successfully');
                    // Refresh messages to update review status
                    fetchMessages();
                    // Perhaps disable further changes
                    onSuggestionChange({ ...(suggestion || {}), submitted: true });
                  } catch (error) {
                    console.error('Failed to submit review:', error);
                    alert('Failed to submit review: ' + (error as Error).message);
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting || suggestion?.submitted}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            )}
          </>
        )}

        {/* Instruction Text */}
        {selectedOption && !shouldShowFollowUps && (
          <div className="text-xs text-center py-2 px-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
            Select an option above to see follow-up requirements
          </div>
        )}
      </div>
    );
  }

  // Fallback for simple text
  return (
    <div className="mt-1 p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
      <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 italic">
        {typeof suggestion === 'string' ? `"${suggestion}"` : 'Response data available'}
      </p>
    </div>
  );
};

export default function InspectorChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [reviews, setReviews] = useState<Record<string, any>>({});
  const prevMessagesRef = useRef<any[]>([]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
const response = await apiClient.getTenantMessages();
      console.log("[CHAT] Full API Response structure:", { success: response.success, hasData: !!response.data, isArray: Array.isArray(response.data) });
      
      // Handle both response formats: {success: true, data: [...]} or direct array
      let newMessages = [];
      if (Array.isArray(response.data)) {
        newMessages = response.data;
      } else if (Array.isArray(response)) {
        newMessages = response;
      } else if (response.data && Array.isArray(response.data.data)) {
        newMessages = response.data.data;
      }
      
      console.log("[CHAT] After setMessages, messages length:", newMessages.length);
      console.log("[CHAT] First message sample:", JSON.stringify(newMessages[0], null, 2));
        
      if (response.success || newMessages.length > 0) {
        const userId = String(user?._id || (user as any)?.id);
        const readThreads = JSON.parse(localStorage.getItem('readThreads') || '{}');
        
        const unread: Record<string, number> = {};
        const threadLastUserMsgTime: Record<string, number> = {};
        newMessages.forEach((msg: any) => {
          const resId = (typeof msg.responseId === 'object' && msg.responseId?._id) 
            ? msg.responseId._id 
            : (msg.responseId || 'unknown');
          const isFromMe = String(msg.from?._id || msg.from) === userId;
          if (isFromMe) {
            const msgTime = new Date(msg.createdAt).getTime();
            const current = threadLastUserMsgTime[resId] || 0;
            if (msgTime > current) {
              threadLastUserMsgTime[resId] = msgTime;
            }
          }
        });
        
        newMessages.forEach((msg: any) => {
          const resId = (typeof msg.responseId === 'object' && msg.responseId?._id) 
            ? msg.responseId._id 
            : (msg.responseId || 'unknown');
          const threadId = resId;
          const isFromMe = String(msg.from?._id || msg.from) === userId;
          const isRead = readThreads[threadId] || selectedThread === threadId;
          
          if (!isFromMe && !isRead) {
            const lastUserTime = threadLastUserMsgTime[threadId] || 0;
            const msgTime = new Date(msg.createdAt).getTime();
            if (msgTime > lastUserTime) {
              unread[threadId] = (unread[threadId] || 0) + 1;
            }
          }
        });
        
        // Load reviews for all unique response IDs
        const responseIds = [...new Set(newMessages.map((msg: any) => {
          const resId = (typeof msg.responseId === 'object' && msg.responseId?._id)
            ? msg.responseId._id
            : (msg.responseId || 'unknown');
          return resId;
        }).filter(id => id !== 'unknown'))];

        // Load cached reviews first
        const cachedReviews = JSON.parse(localStorage.getItem('chatReviews') || '{}');
        const reviewsData: Record<string, any> = { ...cachedReviews };

        console.log('Cached reviews:', cachedReviews);

        // Fetch fresh reviews from API
        for (const responseId of responseIds) {
          try {
            const reviewsResponse = await apiClient.getReviewsForResponse(responseId);
            if (reviewsResponse && reviewsResponse.success && reviewsResponse.reviews && reviewsResponse.reviews.length > 0) {
              reviewsData[responseId] = reviewsResponse.reviews[0]; // Get latest review
            } else if (reviewsData[responseId]) {
              // Keep cached review if API doesn't return data but we have cached data
              console.log(`Keeping cached review for response ${responseId}`);
            }
          } catch (reviewError) {
            console.warn(`Failed to load reviews for response ${responseId}, using cached data if available:`, reviewError);
            // Keep cached review on API failure
            if (!reviewsData[responseId]) {
              console.log(`No cached review available for response ${responseId}`);
            }
          }
        }

        // Cache the reviews data
        localStorage.setItem('chatReviews', JSON.stringify(reviewsData));

        prevMessagesRef.current = newMessages;
        setMessages(newMessages);
        setUnreadCounts(unread);
        setReviews(reviewsData);
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  // Load cached reviews on mount
  useEffect(() => {
    const cachedReviews = localStorage.getItem('chatReviews');
    if (cachedReviews) {
      try {
        setReviews(JSON.parse(cachedReviews));
      } catch (error) {
        console.warn('Failed to parse cached reviews:', error);
      }
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate total unread count
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  // Group messages by responseId and specific question ID to make them separate threads
  const threads = useMemo(() => messages.reduce((acc: any, msg) => {
    const currentReviews = reviews; // Use current reviews state
    console.log("[THREAD] Processing message:", msg._id, "responseId:", msg.responseId);
    
    // Handle both populated (object) and non-populated (string) responseId
    const resId = (typeof msg.responseId === 'object' && msg.responseId?._id) 
      ? msg.responseId._id 
      : (msg.responseId || 'unknown');
    
    console.log("[THREAD] resId:", resId);
    
    const formId = msg.formId || resId || 'general';
    const threadId = resId;
    
    if (!acc[threadId]) {
      // Find title if present
      let questionTitle = "General Message";
      if (msg.questionTitles && msg.questionTitles.length > 0) {
        questionTitle = msg.questionTitles[0];
      } else if (msg.questionContexts && msg.questionContexts.length > 0 && msg.questionContexts[0].title) {
        questionTitle = msg.questionContexts[0].title;
      }

      // Handle both populated and non-populated responseId
      const formTitle = (typeof msg.responseId === 'object' && msg.responseId?.formTitle) 
        ? msg.responseId.formTitle 
        : 'Service Request';
      const submittedBy = (typeof msg.responseId === 'object' && msg.responseId?.submittedBy) 
        ? msg.responseId.submittedBy 
        : 'Anonymous';

      acc[threadId] = {
        id: threadId,
        responseIdStr: resId,
        formId: formId,
        formTitle: formTitle,
        questionTitle: questionTitle,
        submittedBy: submittedBy,
        review: currentReviews[resId] || null,
        messages: []
      };
    }
    acc[threadId].messages.push(msg);
    return acc;
  }, {}), [messages, reviews]);

  const threadList = Object.values(threads).sort((a: any, b: any) => {
    const lastA = new Date(a.messages[0].createdAt).getTime();
    const lastB = new Date(b.messages[0].createdAt).getTime();
    return lastB - lastA;
  });

  const filteredThreads = threadList.filter((thread: any) => 
    thread.formTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.submittedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(thread.id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleReply = async () => {
    if (!replyText.trim() || !selectedThread) return;

    setIsSending(true);
    try {
      const thread: any = threads[selectedThread];
      const lastMessage = thread.messages[0]; // Messages are sorted by createdAt desc in getMyMessages

      await apiClient.post('/messages/reply', {
        parentMessageId: lastMessage._id,
        message: replyText
      });

      setReplyText("");
      fetchMessages();
    } catch (err) {
      console.error("Error sending reply:", err);
    } finally {
      setIsSending(false);
    }
  };

  const activeThread: any = selectedThread ? threads[selectedThread] : null;

  const renderFormattedAnswer = (answer: any): React.ReactNode => {
    if (answer === undefined || answer === null || answer === '') return <span className="text-gray-400 italic font-medium">No answer provided</span>;

    // Handle complex Chassis/Inspection object (Standard structure for defects)
    if (typeof answer === 'object' && !Array.isArray(answer) && (answer.chassisNumber || answer.status || answer.categories)) {
      const status = answer.status || 'Unknown';
      const statusColor = 
        status.toLowerCase() === 'accepted' || status.toLowerCase() === 'verified' ? 'text-green-600 bg-green-50 border-green-100' :
        status.toLowerCase() === 'rejected' ? 'text-red-600 bg-red-50 border-red-100' :
        'text-amber-600 bg-amber-50 border-amber-100';

      return (
        <div className="space-y-3 mt-2">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase border-2 ${statusColor} shadow-sm`}>
              {status}
            </span>
            {answer.chassisNumber && (
              <span className="text-[11px] font-extrabold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                VIN: {answer.chassisNumber}
              </span>
            )}
          </div>
          
          {answer.categories && answer.categories.length > 0 && (
            <div className="space-y-4 relative pl-3 ml-1 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-indigo-200 before:to-transparent dark:before:from-indigo-900/50">
              {answer.categories.map((cat: any, idx: number) => (
                <div key={idx} className="space-y-2 text-left">
                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    {cat.name}
                  </p>
                  <div className="space-y-2 pl-3">
                    {cat.defects?.map((defect: any, dIdx: number) => (
                      <div key={dIdx} className="bg-white dark:bg-gray-800/50 p-2 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                        <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                          {defect.name}
                        </span>
                        {defect.details?.fileUrl && (
                          <a 
                            href={defect.details.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block mb-1"
                          >
                            <img 
                              src={defect.details.fileUrl} 
                              alt="Evidence" 
                              className="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                            />
                          </a>
                        )}
                        {defect.details?.remark && (
                          <div className="flex items-start gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-1.5 rounded-lg border-l-2 border-indigo-400">
                             <MessageCircle className="w-3 h-3 mt-0.5 shrink-0" />
                             <span className="italic leading-relaxed">"{defect.details.remark}"</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Handle generic objects
    if (typeof answer === 'object' && !Array.isArray(answer)) {
      // Map of better header names
      const headerNames: Record<string, string> = {
        chassisNumber: 'Chassis Number',
        status: 'Status',
        zones: 'Zone',
        zonesData: 'Zones Data',
        evidenceUrl: 'Evidence'
      };
      
      // Filter out empty values and keys we don't want to show
      const entries = Object.entries(answer).filter(([key, val]) => {
        if (val === null || val === undefined || val === '') return false;
        if (key === 'zonesData' || key === '__v') return false;
        return true;
      });
      
      if (entries.length === 0) return <span className="text-gray-400 italic">No details</span>;
      
      return (
        <div className="space-y-2 mt-2">
          {entries.map(([key, val], idx) => {
            const valStr = String(val);
            const isImageUrl = valStr.match(/\.(jpg|jpeg|png|gif|webp)$/i) || valStr.includes('cloudfront.net') || valStr.includes('cloudinary');
            const displayKey = headerNames[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
            
            return (
              <div key={idx} className="flex flex-col">
                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter">{displayKey}</span>
                {isImageUrl ? (
                  <div className="flex items-center gap-2">
                    <a href={valStr} target="_blank" rel="noopener noreferrer">
                      <img src={valStr} alt="Evidence" className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                    </a>
                    <span className="text-[10px] text-gray-500">View Evidence</span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{valStr}</span>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // Handle plain URL strings
    if (typeof answer === 'string') {
      const isImageUrl = answer.match(/\.(jpg|jpeg|png|gif|webp)$/i) || answer.includes('cloudfront.net') || answer.includes('cloudinary');
      if (isImageUrl) {
        return (
          <a href={answer} target="_blank" rel="noopener noreferrer">
            <img src={answer} alt="Evidence" className="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
          </a>
        );
      }
    }

    // Handle array
    if (Array.isArray(answer)) {
      console.log("[RENDER ANSWER] Array answer:", answer);
      return (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {answer.map((val, idx) => {
            const valStr = String(val);
            const isImageUrl = valStr.match(/\.(jpg|jpeg|png|gif|webp)$/i) || valStr.includes('cloudfront.net') || valStr.includes('cloudinary');
            if (isImageUrl) {
              return (
                <a key={idx} href={valStr} target="_blank" rel="noopener noreferrer">
                  <img src={valStr} alt="Evidence" className="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                </a>
              );
            }
            if (!valStr || valStr === '') return null;
            return (
              <span key={idx} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-[10px] font-black border border-indigo-100 dark:border-indigo-800/50">
                {valStr}
              </span>
            );
          })}
        </div>
      );
    }

    return <span className="text-sm font-black text-gray-800 dark:text-gray-100">{String(answer)}</span>;
  };

  const renderReviewStatus = (review: any) => {
    if (!review) return null;

    console.log('renderReviewStatus called with review:', review);
    const reviewerName = review.reviewer?.name || review.reviewer?.email || 'Unknown';
    const reviewOption = review.option || review.reviewOption;
    const emoji = reviewOption === 'Accepted' ? '✅' : reviewOption === 'Rejected' ? '❌' : '🔄';

    console.log('Review details:', { reviewerName, reviewOption, emoji });
    return (
      <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
          Status: {emoji} {reviewOption} by {reviewerName}
        </span>
      </div>
    );
  };

  const renderSuggestion = (suggestion: any, user?: any) => {
    if (!suggestion || Object.keys(suggestion).length === 0) return null;

    // Ensure status is set if selected exists but status doesn't
    if (suggestion.selected && !suggestion.status) {
      suggestion.status = `${suggestion.selected} by ${user?.name || user?.email || 'Unknown'}`;
    }

    // Status display element
    let statusElement = null;
    if (suggestion.status) {
      const emoji = suggestion.status.toLowerCase().includes('accepted') ? '✅' :
                   suggestion.status.toLowerCase().includes('rejected') ? '❌' : '🔄';
      const statusColor = suggestion.status.toLowerCase().includes('accepted') ? 'text-green-600 bg-green-50 border-green-100' :
                         suggestion.status.toLowerCase().includes('rejected') ? 'text-red-600 bg-red-50 border-red-100' :
                         'text-amber-600 bg-amber-50 border-amber-100';
      statusElement = (
        <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <span className={`px-2 py-1 rounded-md text-[11px] font-black uppercase ${statusColor} border shadow-sm`}>
            Status: {emoji} {suggestion.status}
          </span>
        </div>
      );
    }

    const isChassisStructure = suggestion.status !== undefined ||
                               suggestion.chassisNumber !== undefined ||
                               suggestion.zonesData !== undefined ||
                               suggestion.zone !== undefined;

    if (isChassisStructure) {
      const sections: JSX.Element[] = [];

      if (suggestion.chassisNumber && suggestion.chassisNumber.trim()) {
        sections.push(
          <div key="chassis" className="p-2 rounded-lg border border-gray-200 dark:border-gray-700">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Chassis Number</span>
            <span className="text-[11px] font-mono font-bold text-gray-700 dark:text-gray-300">{suggestion.chassisNumber}</span>
          </div>
        );
      }

      if (suggestion.zonesData && typeof suggestion.zonesData === 'object') {
        Object.entries(suggestion.zonesData).forEach(([zoneName, zoneData]: [string, any]) => {
          if (zoneData?.categories && Array.isArray(zoneData.categories)) {
            zoneData.categories.forEach((category: any) => {
              const categoryName = category.name;
              const defects = category.defects || [];
              
              defects.forEach((defect: any) => {
                const defectName = defect.name;
                const remark = defect.details?.remark || defect.remark || '';
                const fileUrl = defect.details?.fileUrl || defect.fileUrl || '';
                
                sections.push(
                  <div key={`${zoneName}-${categoryName}-${defectName}`} className="p-3 rounded-lg border-l-4 border-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/20 space-y-2">
                    <div className="grid grid-cols-1 gap-2">
                      {zoneName && (
                        <div>
                          <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">Zone</span>
                          <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{zoneName}</p>
                        </div>
                      )}
                      {categoryName && (
                        <div>
                          <span className="text-[9px] font-bold text-purple-500 uppercase tracking-wider">Category</span>
                          <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{categoryName}</p>
                        </div>
                      )}
                      {defectName && (
                        <div>
                          <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Defect</span>
                          <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{defectName}</p>
                        </div>
                      )}
                      {remark && remark.trim() && (
                        <div>
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Remark</span>
                          <p className="text-[10px] italic text-gray-600 dark:text-gray-400">"{remark}"</p>
                        </div>
                      )}
                      {fileUrl && fileUrl.trim() && (
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Evidence :</span>
                          <a 
                            href={fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline mt-0 "
                          >
                            <Eye className="w-4 h-2 mt-1 " />
                            View Evidence
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            });
          }
        });
      }

      if (suggestion.zone && !suggestion.zonesData) {
        const zones = Array.isArray(suggestion.zone) ? suggestion.zone : [suggestion.zone];
        if (zones.length > 0) {
          sections.push(
            <div key="zones" className="p-2 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Zone(s)</span>
              <div className="flex flex-wrap gap-1">
                {zones.filter(z => z && z.trim()).map((zone, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold">
                    {zone}
                  </span>
                ))}
              </div>
            </div>
          );
        }
      }

      if (suggestion.categories && Array.isArray(suggestion.categories)) {
        suggestion.categories.forEach((category: any) => {
          const categoryName = category.name;
          const defects = category.defects || [];
          
          defects.forEach((defect: any) => {
            const defectName = defect.name;
            const remark = defect.details?.remark || defect.remark || '';
            const fileUrl = defect.details?.fileUrl || defect.fileUrl || '';
            
            sections.push(
              <div key={`${categoryName}-${defectName}`} className="p-3 rounded-lg border-l-4 border-purple-400 bg-purple-50/30 dark:bg-purple-900/20 space-y-2">
                <div className="grid grid-cols-1 gap-2">
                  {categoryName && (
                    <div>
                      <span className="text-[9px] font-bold text-purple-500 uppercase tracking-wider">Category</span>
                      <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{categoryName}</p>
                    </div>
                  )}
                  {defectName && (
                    <div>
                      <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Defect</span>
                      <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{defectName}</p>
                    </div>
                  )}
                  {remark && remark.trim() && (
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Remark</span>
                      <p className="text-[10px] italic text-gray-600 dark:text-gray-400">"{remark}"</p>
                    </div>
                  )}
                  {fileUrl && fileUrl.trim() && (
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Evidence</span>
                      <a 
                        href={fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline mt-1"
                      >
                        <Eye className="w-3 h-3" />
                        View Evidence
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          });
        });
      }

      if (suggestion.evidenceUrl && suggestion.evidenceUrl.trim()) {
        sections.push(
          <div key="evidence" className="p-2 rounded-lg border border-gray-200 dark:border-gray-700">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">General Evidence</span>
            <a 
              href={suggestion.evidenceUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline"
            >
              <Eye className="w-3 h-3" />
              View Evidence
            </a>
          </div>
        );
      }

      if (sections.length === 0 && !statusElement) return null;

      return (
        <div className="mt-1 p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
          {statusElement}
          <div className="space-y-2">
            {sections}
          </div>
        </div>
      );
    }

    const renderNested = (data: any, depth = 0) => {
      return Object.entries(data).map(([key, val]: [string, any], idx) => {
        if (key === 'selected' && suggestion.status) {
          return null; // Skip selected if status is shown separately
        }
        if (key === 'selected') {
          return (
            <div key={idx} className="flex items-center gap-1.5 mb-1">
              <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-black uppercase">
                Suggested: {String(val)}
              </span>
            </div>
          );
        }

        const valStr = String(val);
        const isImageUrl = valStr.match(/\.(jpg|jpeg|png|gif|webp)$/i) || valStr.includes('cloudfront.net') || valStr.includes('cloudinary');

        return (
          <div key={idx} className="pl-3 border-l border-indigo-200 dark:border-indigo-800 mt-1">
            {typeof val === 'object' ? renderNested(val, depth + 1) : isImageUrl ? (
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-400">Response:</span>
                <a 
                  href={valStr} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline"
                >
                  <Eye className="w-3 h-3" />
                  View Evidence
                </a>
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-400">Response:</span>
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 italic">"{valStr}"</span>
              </div>
            )}
          </div>
        );
      });
    };

    return (
      <div className="mt-2 p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm animate-pulse-slow">
        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
          <Edit className="w-2.5 h-2.5" />
          Admin Instructions
        </p>
        {statusElement}
        {renderNested(suggestion)}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900">
      {/* Sidebar: Thread List */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Chat System</h1>
              {totalUnread > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  {totalUnread}
                </span>
              )}
            </div>
            <button 
              onClick={fetchMessages}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && messages.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Loading chats...</div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No conversations found.</div>
          ) : (
            filteredThreads.map((thread: any) => {
              const unreadCount = unreadCounts[thread.id] || 0;
              return (
                <button
                  key={thread.id}
                  onClick={() => {
                    setSelectedThread(thread.id);
                    const readThreads = JSON.parse(localStorage.getItem('readThreads') || '{}');
                    readThreads[thread.id] = true;
                    localStorage.setItem('readThreads', JSON.stringify(readThreads));
                    if (unreadCount > 0) {
                      setUnreadCounts(prev => ({ ...prev, [thread.id]: 0 }));
                    }
                  }}
                  className={`w-full p-4 flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 transition-all ${
                    selectedThread === thread.id 
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-r-4 border-r-indigo-600' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    {unreadCount > 0 && (
                      <div className={`absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 bg-red-500 rounded-full flex items-center justify-center ${unreadCount > 9 ? 'w-auto px-2' : 'w-5'}`}>
                        <span className="text-[10px] font-bold text-white">{unreadCount}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        ID: {String(thread.responseIdStr || thread.id).substring(0, 16)}
                      </span>
                      <div className="flex items-center gap-1">
                        {thread.review && (
                          <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${
                            (thread.review.option || thread.review.reviewOption) === 'Accepted' ? 'bg-green-100 text-green-700' :
                            (thread.review.option || thread.review.reviewOption) === 'Rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {(thread.review.option || thread.review.reviewOption) === 'Accepted' ? '✓' :
                             (thread.review.option || thread.review.reviewOption) === 'Rejected' ? '✗' : '↻'}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          {new Date(thread.messages[0].createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeThread ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {activeThread.questionTitle}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Form: {activeThread.formTitle} • Ref: {String(activeThread.id).substring(0, 10)}...
                  </p>
                  {/* Review Status in Header */}
                  {activeThread?.review && (
                    <div className="mt-2">
                      {renderReviewStatus(activeThread.review)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const formId = activeThread.formId;
                    console.log("[OpenDashboard] formId:", formId);
                    console.log("[OpenDashboard] responseIdStr:", activeThread.responseIdStr);
                    navigate(`/forms/${formId}/analytics?responseId=${activeThread.responseIdStr}`);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Open Dashboard
                </button>
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <Filter className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Message History */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900/50">

              {/* Sample Zone In Question */}
              <div className="flex justify-start">
                <div className="max-w-[75%] bg-white dark:bg-gray-100 rounded-2xl shadow-sm p-4">
                  <p className="text-sm mb-2">Here's a Zone In inspection question:</p>
                  <QuestionDisplayRenderer
                    question={{
                      text: "Zone In Paint Quality Inspection",
                      type: "zone",
                      options: ["Paint uncover", "No bare / ED coating visible after painting", "Painting", "Accepted", "Rework", "Rejected", "Remark", "File update"]
                    }}
                    suggestion={{}}
                    onSuggestionChange={(newValue) => console.log('Zone In changed:', newValue)}
                    user={user}
                    responseId={activeThread?.responseIdStr}
                    submitterId={activeThread?.submittedBy?._id || activeThread?.submittedBy}
                  />
                </div>
              </div>

              {/* Sample Zone Out Question */}
              <div className="flex justify-start">
                <div className="max-w-[75%] bg-white dark:bg-gray-100 rounded-2xl shadow-sm p-4">
                  <p className="text-sm mb-2">Here's a Zone Out inspection question:</p>
                  <QuestionDisplayRenderer
                    question={{
                      text: "Zone Out Paint Quality Inspection",
                      type: "zone-out",
                      options: ["Paint uncover", "No bare / ED coating visible after painting", "Painting", "Accepted", "Rework", "Rejected", "Remark", "File update"]
                    }}
                    suggestion={{}}
                    onSuggestionChange={(newValue) => console.log('Zone Out changed:', newValue)}
                    user={user}
                    responseId={activeThread?.resId}
                    submitterId={activeThread?.from?._id}
                  />
                </div>
              </div>

              <div className="text-center text-gray-500 py-4">
                <p className="text-sm">💡 Try selecting different options above to see the zone-based follow-up logic</p>
                <p className="text-xs mt-1">
                  <strong>Zone In:</strong> Accept=remark+upload, Reject/Rework=zones+remark+upload<br/>
                  <strong>Zone Out:</strong> All options=remark+upload
                </p>
              </div>

              {[...activeThread.messages].reverse().map((msg, i) => {
                const isMe = String(msg.from?._id || msg.from) === String(user?._id || (user as any)?.id);
                console.log("[CHAT] Message:", i, "from:", msg.from, "isMe:", isMe, "userId:", user?._id, "userIdAlt:", (user as any)?.id);
                return (
                <div 
                  key={i} 
                  className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-5 duration-300`}
                >
                  <div className={`max-w-[75%] group`}>
                    <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed ${
                      isMe
                        ? 'bg-[#dcf8c6] text-gray-900 rounded-br-lg rounded-tr-lg rounded-tl-sm' 
                        : 'bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-200 rounded-bl-lg rounded-tl-lg rounded-tr-sm border border-gray-100 dark:border-gray-700'
                    }`}>
                      {msg.questionContexts && msg.questionContexts.length > 0 ? (
                        <div className="space-y-3">
                          {msg.questionContexts.map((ctx: any, idx: number) => (
                            <div key={idx} className="space-y-2">
                              <p className={`text-[12px] font-bold border-b pb-0.5 ${
                                isMe
                                  ? 'text-green-800 border-green-200' 
                                  : 'text-gray-500 dark:text-gray-400 border-indigo-100 dark:border-indigo-800/50 pb-0.5'
                              }`}>
                                {ctx.title}
                              </p>
                                <div className="mb-2">
                                  <QuestionDisplayRenderer
                                    question={ctx.question}
                                    suggestion={ctx.suggestion}
                                    onSuggestionChange={(newValue) => {
                                      // Handle question response changes in chat
                                      console.log('Question suggestion changed:', newValue);
                                    }}
                                    user={user}
                                    responseId={activeThread?.resId}
                                    submitterId={activeThread?.from?._id}
                                  />
                                </div>
                                {renderSuggestion(ctx.suggestion, user)}
                            </div>
                          ))}
                        </div>
                       ) : msg.questionTitles && msg.questionTitles.length > 0 && (
                         <div className={`mb-2 p-2 rounded-xl border ${
                           isMe
                             ? 'bg-[#c5e5c5] border-[#a8d6a8]'
                             : 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-100/50 dark:border-indigo-800/30'
                         }`}>
                           <p className={`text-[10px] uppercase font-black mb-1.5 flex items-center gap-1 ${
                             isMe ? 'text-green-700' : 'text-indigo-500'
                           }`}>
                             <Filter className="w-2.5 h-2.5" />
                             Linked Questions
                           </p>
                           <div className="flex flex-wrap gap-1">
                             {msg.questionTitles.map((title: string, idx: number) => (
                               <span key={idx} className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md border ${
                                 isMe
                                   ? 'bg-green-100 text-green-800 border-green-200'
                                   : 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800'
                               }`}>
                                 {title}
                               </span>
                             ))}
                           </div>
                           {/* Show QuestionDisplayRenderer for messages with suggestions */}
                            {msg.suggestion && (
                              <div className="mt-2">
                                <QuestionDisplayRenderer
                                  question={{ text: msg.questionTitles[0], options: ['Accepted', 'Rework', 'Rejected'] }}
                                  suggestion={msg.suggestion}
                                  onSuggestionChange={(newValue) => {
                                    console.log('Question suggestion changed:', newValue);
                                  }}
                                  user={user}
                                  responseId={activeThread?.resId}
                                  submitterId={activeThread?.from?._id}
                                />
                                {renderSuggestion(msg.suggestion, user)}
                              </div>
                            )}
                         </div>
                       )}
                       {renderMessageWithImages(msg.message)}
                     </div>
                     <div className={`flex items-center gap-1 mt-1.5 px-1 opacity-60`}>
                      <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">
                        {isMe ? 'You' : (msg.from?.name || msg.from?.firstName || msg.from?.email || msg.from?.first_name || 'User')} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {!isMe && (
                        <button 
                          onClick={() => {
                            setReplyText(`Replying to: "${msg.message.substring(0, 30)}..." \n`);
                            document.querySelector('textarea')?.focus();
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline ml-2 pointer-events-auto"
                        >
                          <Reply className="w-3 h-3" />
                          Reply
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <div className="relative flex items-center gap-3">
                <div className="flex-1 relative">
                  <textarea
                    rows={1}
                    placeholder="Type your reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full pl-4 pr-12 py-3 bg-gray-100 dark:bg-gray-700 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all resize-none overflow-hidden"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                  />
                  <button 
                    onClick={handleReply}
                    disabled={isSending || !replyText.trim()}
                    className="absolute right-2 top-1.5 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-90"
                  >
                    {isSending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-center text-gray-400">
                Shift + Enter for new line. Press Enter to send.
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-full shadow-xl ring-8 ring-indigo-50/50 dark:ring-indigo-900/10">
              <MessageCircle className="w-16 h-16 text-indigo-100 dark:text-indigo-900" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Zone-Based Inspection Chat</h2>
              <p className="text-sm mb-2">Select a conversation from the list to start messaging.</p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                This demo shows zone-based follow-up logic for inspection questions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
