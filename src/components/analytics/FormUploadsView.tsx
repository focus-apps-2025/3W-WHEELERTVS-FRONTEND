import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import JSZip from "jszip";
import {
  Folder,
  ArrowLeft,
  FileText,
  User,
  ExternalLink,
  Image as ImageIcon,
  File as FileIcon,
  Search,
  ChevronDown,
  ChevronRight,
  Info,
  X,
  Download,
  DownloadCloud,
  LayoutGrid,
  ClipboardList,
  Layers,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { useNotification } from "../../context/NotificationContext";

interface Response {
  _id: string;
  id: string;
  questionId: string;
  answers: Record<string, any>;
  createdAt: string;
  submittedBy?: string;
  submitterContact?: {
    email?: string;
    phone?: string;
  };
}

interface Question {
  id: string;
  text: string;
  type: string;
}

interface Section {
  id: string;
  title: string;
  questions: Question[];
}

interface Form {
  id: string;
  title: string;
  description?: string;
  sections?: Section[];
  followUpQuestions?: Question[];
}

interface UploadItem {
  url: string;
  response: Response;
}

interface QuestionUploads {
  question: Question;
  uploads: UploadItem[];
}

export default function FormUploadsView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
  
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [selectedUpload, setSelectedUpload] = useState<UploadItem | null>(null);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0 });
  const [viewMode, setViewMode] = useState<'questions' | 'submissions' | 'sections'>('questions');
  const [expandedSubmissions, setExpandedSubmissions] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const getSubmitterName = (response: Response) => {
    // 1. Prioritize first 2 questions of first section as requested
    if (form?.sections && form.sections.length > 0) {
      const firstSection = form.sections[0];
      const answers: string[] = [];
      
      // Get answers for up to first 2 questions
      for (let i = 0; i < Math.min(2, firstSection.questions.length); i++) {
        const q = firstSection.questions[i];
        const answer = response.answers[q.id];
        if (answer !== undefined && answer !== null && String(answer).trim()) {
          answers.push(String(answer).trim());
        }
      }
      
      if (answers.length > 0) {
        return answers.join(" - ");
      }
    }

    // 2. Try to find a name-like field in answers (Legacy/Fallback)
    if (form?.sections) {
      for (const section of form.sections) {
        for (const q of section.questions) {
          const text = q.text.toLowerCase();
          if (text.includes('name') || text.includes('full name') || text.includes('applicant') || text.includes('dealer')) {
            const answer = response.answers[q.id];
            if (answer && typeof answer === 'string' && answer.trim()) {
              return answer.trim();
            }
          }
        }
      }
    }

    // 3. Try submittedBy
    if (response.submittedBy && response.submittedBy.trim()) {
      return response.submittedBy.trim();
    }

    // 4. Try email or phone
    if (response.submitterContact?.email) return response.submitterContact.email;
    if (response.submitterContact?.phone) return response.submitterContact.phone;

    // 5. Fallback to ID
    return response.id.slice(-6);
  };

  const downloadAllAsZip = async () => {
    if (zipping || (viewMode === 'questions' ? questionUploads.length === 0 : viewMode === 'submissions' ? submissionUploads.length === 0 : sectionUploads.length === 0)) return;
    try {
      setZipping(true);
      
      const allFiles: { sectionTitle: string; submitterName: string; questionText: string; url: string; response: Response }[] = [];
      
      sectionUploads.forEach(({ section, uploads }) => {
        uploads.forEach(({ question, upload }) => {
          allFiles.push({
            sectionTitle: section.title,
            submitterName: getSubmitterName(upload.response),
            questionText: question.text,
            url: upload.url,
            response: upload.response
          });
        });
      });

      setZipProgress({ current: 0, total: allFiles.length });
      
      const zip = new JSZip();
      const CONCURRENCY_LIMIT = 5;
      let processedCount = 0;

      const processBatch = async (batch: typeof allFiles) => {
        await Promise.all(batch.map(async (fileInfo) => {
          const sectionName = fileInfo.sectionTitle.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
          const submitterName = fileInfo.submitterName.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
          const questionName = fileInfo.questionText.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
          
          const folderPath = `${sectionName}/${submitterName}`;
          let folder = zip.folder(folderPath);
          if (!folder) folder = zip;
          
          const proxyUrl = apiClient.getProxyUrl(fileInfo.url);
          
          try {
            const res = await fetch(proxyUrl, { mode: 'cors' });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const blob = await res.blob();
            const extension = getExtensionFromUrl(fileInfo.url, res.headers.get('content-type'));
            const fileName = `${questionName}_${fileInfo.response.id.slice(-5)}.${extension}`;
            folder.file(fileName, blob);
          } catch (err) {
            console.error(`Failed to fetch ${fileInfo.url}:`, err);
            folder.file(`FAILED_${questionName}.txt`, `URL: ${fileInfo.url}\nError: ${err}`);
          } finally {
            processedCount++;
            setZipProgress(prev => ({ ...prev, current: processedCount }));
          }
        }));
      };

      for (let i = 0; i < allFiles.length; i += CONCURRENCY_LIMIT) {
        await processBatch(allFiles.slice(i, i + CONCURRENCY_LIMIT));
      }

      const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      saveAs(content, `${form?.title?.replace(/[\\/:*?"<>|]/g, '_') || "uploads"}_structured.zip`);
    } catch (err) {
      console.error("ZIP Generation Error:", err);
      showError("Failed to generate ZIP. Please check your connection.");
    } finally {
      setZipping(false);
      setZipProgress({ current: 0, total: 0 });
    }
  };

  const downloadQuestionAsZip = async (question: Question, uploads: UploadItem[]) => {
    try {
      setZipping(true);
      setZipProgress({ current: 0, total: uploads.length });
      
      const zip = new JSZip();
      const sanitizedText = question.text.replace(/[\\/:*?"<>|]/g, '_').trim().substring(0, 80) || 'Question';
      const folderName = `${sanitizedText}_${question.id.slice(-5)}`;
      const folder = zip.folder(folderName) || zip;
      
      const CONCURRENCY_LIMIT = 5;
      let processedCount = 0;

      const processBatch = async (batch: UploadItem[], startIndex: number) => {
        await Promise.all(batch.map(async (upload, i) => {
          const index = startIndex + i;
          const proxyUrl = apiClient.getProxyUrl(upload.url);
          
          try {
            const res = await fetch(proxyUrl, { mode: 'cors' });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const blob = await res.blob();
            
            let extension = getExtensionFromUrl(upload.url, res.headers.get('content-type'));
            const submitterName = getSubmitterName(upload.response).replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
            const fileName = `${submitterName}_${upload.response.id.slice(-5)}_${index + 1}.${extension}`;
            folder.file(fileName, blob);
          } catch (err) {
            console.error(`Failed to fetch ${upload.url}:`, err);
            folder.file(`FAILED_TO_DOWNLOAD_${index + 1}.txt`, `Original URL: ${upload.url}\nError: ${err instanceof Error ? err.message : String(err)}`);
          } finally {
            processedCount++;
            setZipProgress(prev => ({ ...prev, current: processedCount }));
          }
        }));
      };

      for (let i = 0; i < uploads.length; i += CONCURRENCY_LIMIT) {
        const batch = uploads.slice(i, i + CONCURRENCY_LIMIT);
        await processBatch(batch, i);
      }

      const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      saveAs(content, `${folderName}.zip`);
    } catch (err) {
      console.error("Question ZIP Error:", err);
      showError("Failed to generate ZIP for this question.");
    } finally {
      setZipping(false);
      setZipProgress({ current: 0, total: 0 });
    }
  };

  const downloadSectionAsZip = async (section: Section, uploads: { question: Question; upload: UploadItem }[]) => {
    try {
      setZipping(true);
      setZipProgress({ current: 0, total: uploads.length });
      
      const zip = new JSZip();
      const folderName = section.title.replace(/[\\/:*?"<>|]/g, '_').trim().substring(0, 80) || 'Section';
      const folder = zip.folder(folderName) || zip;
      
      const CONCURRENCY_LIMIT = 5;
      let processedCount = 0;

      const processBatch = async (batch: typeof uploads, startIndex: number) => {
        await Promise.all(batch.map(async ({ question, upload }, i) => {
          const index = startIndex + i;
          const proxyUrl = apiClient.getProxyUrl(upload.url);
          
          try {
            const res = await fetch(proxyUrl, { mode: 'cors' });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const blob = await res.blob();
            
            let extension = getExtensionFromUrl(upload.url, res.headers.get('content-type'));
            const submitterName = getSubmitterName(upload.response).replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
            const questionName = question.text.replace(/[\\/:*?"<>|]/g, '_').substring(0, 30);
            const fileName = `${submitterName}_${questionName}_${upload.response.id.slice(-5)}_${index + 1}.${extension}`;
            folder.file(fileName, blob);
          } catch (err) {
            console.error(`Failed to fetch ${upload.url}:`, err);
            folder.file(`FAILED_TO_DOWNLOAD_${index + 1}.txt`, `Original URL: ${upload.url}\nError: ${err instanceof Error ? err.message : String(err)}`);
          } finally {
            processedCount++;
            setZipProgress(prev => ({ ...prev, current: processedCount }));
          }
        }));
      };

      for (let i = 0; i < uploads.length; i += CONCURRENCY_LIMIT) {
        const batch = uploads.slice(i, i + CONCURRENCY_LIMIT);
        await processBatch(batch, i);
      }

      const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      saveAs(content, `${folderName}.zip`);
    } catch (err) {
      console.error("Section ZIP Error:", err);
      showError("Failed to generate ZIP for this section.");
    } finally {
      setZipping(false);
      setZipProgress({ current: 0, total: 0 });
    }
  };

  const downloadSubmissionAsZip = async (name: string, response: Response, uploads: { question: Question; url: string }[]) => {
    try {
      setZipping(true);
      setZipProgress({ current: 0, total: uploads.length });
      
      const zip = new JSZip();
      const folderName = name.replace(/[\\/:*?"<>|]/g, '_').trim().substring(0, 80) || 'Submission';
      const folder = zip.folder(folderName) || zip;
      
      const CONCURRENCY_LIMIT = 5;
      let processedCount = 0;

      const processBatch = async (batch: typeof uploads, startIndex: number) => {
        await Promise.all(batch.map(async ({ question, url }, i) => {
          const index = startIndex + i;
          const proxyUrl = apiClient.getProxyUrl(url);
          
          try {
            const res = await fetch(proxyUrl, { mode: 'cors' });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const blob = await res.blob();
            
            let extension = getExtensionFromUrl(url, res.headers.get('content-type'));
            const questionName = question.text.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
            const fileName = `${questionName}_${index + 1}.${extension}`;
            folder.file(fileName, blob);
          } catch (err) {
            console.error(`Failed to fetch ${url}:`, err);
            folder.file(`FAILED_TO_DOWNLOAD_${index + 1}.txt`, `Original URL: ${url}\nError: ${err instanceof Error ? err.message : String(err)}`);
          } finally {
            processedCount++;
            setZipProgress(prev => ({ ...prev, current: processedCount }));
          }
        }));
      };

      for (let i = 0; i < uploads.length; i += CONCURRENCY_LIMIT) {
        const batch = uploads.slice(i, i + CONCURRENCY_LIMIT);
        await processBatch(batch, i);
      }

      const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      saveAs(content, `${folderName}.zip`);
    } catch (err) {
      console.error("Submission ZIP Error:", err);
      showError("Failed to generate ZIP for this submission.");
    } finally {
      setZipping(false);
      setZipProgress({ current: 0, total: 0 });
    }
  };

  const getExtensionFromUrl = (url: string, contentType: string | null): string => {
    let extension = "";
    if (url.startsWith('data:')) {
      const mimeMatch = url.match(/^data:([^;]+);/);
      if (mimeMatch && mimeMatch[1]) {
        return mimeMatch[1].split('/')[1]?.split('+')[0] || 'jpg';
      }
    }
    
    extension = url.split('.').pop()?.split(/[?#]/)[0] || '';
    if (!extension || extension.length > 4 || extension.includes(':')) {
      if (contentType) {
        return contentType.split('/')[1]?.split('+')[0] || 'jpg';
      } else {
        return 'jpg';
      }
    }
    return extension;
  };

  const saveAs = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const downloadSingleImage = async (url: string, fileName?: string) => {
    try {
      const proxyUrl = apiClient.getProxyUrl(url);
      // Try to download via fetch/blob first (allows custom filename and forced download)
      const response = await fetch(proxyUrl, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || url.split('/').pop()?.split(/[?#]/)[0] || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (err) {
      console.error("Download error, falling back to direct link:", err);
      // Fallback: Open in new tab if CORS or other error prevents blob download
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      // Note: download attribute only works for same-origin or with correct headers
      link.download = fileName || '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [formData, responsesData] = await Promise.all([
        apiClient.getForm(id!),
        apiClient.getFormResponses(id!)
      ]);

      if (!formData.form) {
        showError("Form not found");
        return;
      }

      setForm(formData.form);
      setResponses(responsesData.responses || []);
      
      // Initially expand all questions
      const fileQuestions = getAllFileQuestions(formData.form);
      setExpandedQuestions(new Set(fileQuestions.map(q => q.id)));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const getAllFileQuestions = (form: Form): Question[] => {
    const questions: Question[] = [];
    
    if (form.sections) {
      form.sections.forEach(section => {
        if (section.questions) {
          section.questions.forEach(q => {
            if (q.type === 'file') {
              questions.push(q);
            }
          });
        }
      });
    }
    
    if (form.followUpQuestions) {
      form.followUpQuestions.forEach(q => {
        if (q.type === 'file') {
          questions.push(q);
        }
      });
    }
    
    return questions;
  };

  const questionUploads = useMemo(() => {
    if (!form || !responses.length) return [];

    const fileQuestions = getAllFileQuestions(form);
    const results: QuestionUploads[] = [];

    fileQuestions.forEach(question => {
      const uploads: UploadItem[] = [];
      
      responses.forEach(response => {
        const answer = response.answers[question.id];
        if (answer) {
          if (Array.isArray(answer)) {
            answer.forEach(url => {
              if (typeof url === 'string' && url.trim() !== '') {
                uploads.push({ url, response });
              }
            });
          } else if (typeof answer === 'string' && answer.trim() !== '') {
            uploads.push({ url: answer, response });
          }
        }
      });

      if (uploads.length > 0) {
        results.push({ question, uploads });
      }
    });

    return results;
  }, [form, responses]);

  const submissionUploads = useMemo(() => {
    if (!form || !responses.length) return [];
    
    return responses.map(response => {
      const name = getSubmitterName(response);
      const uploads: { question: Question; url: string }[] = [];
      
      const fileQuestions = getAllFileQuestions(form);
      fileQuestions.forEach(q => {
        const answer = response.answers[q.id];
        if (answer) {
          if (Array.isArray(answer)) {
            answer.forEach(url => {
              if (typeof url === 'string' && url.trim()) {
                uploads.push({ question: q, url });
              }
            });
          } else if (typeof answer === 'string' && answer.trim()) {
            uploads.push({ question: q, url: answer });
          }
        }
      });
      
      return { response, name, uploads };
    }).filter(s => s.uploads.length > 0);
  }, [form, responses, getSubmitterName]);

  const sectionUploads = useMemo(() => {
    if (!form || !responses.length) return [];
    
    const results: { section: Section; uploads: { question: Question; upload: UploadItem }[] }[] = [];
    
    form.sections?.forEach(section => {
      const uploads: { question: Question; upload: UploadItem }[] = [];
      section.questions.forEach(question => {
        if (question.type === 'file') {
          responses.forEach(response => {
            const answer = response.answers[question.id];
            if (answer) {
              if (Array.isArray(answer)) {
                answer.forEach(url => {
                   if (typeof url === 'string' && url.trim()) {
                     uploads.push({ question, upload: { url, response } });
                   }
                });
              } else if (typeof answer === 'string' && answer.trim()) {
                uploads.push({ question, upload: { url: answer, response } });
              }
            }
          });
        }
      });
      if (uploads.length > 0) {
        results.push({ section, uploads });
      }
    });
    
    return results;
  }, [form, responses]);

  const filteredQuestionUploads = useMemo(() => {
    if (!searchTerm.trim()) return questionUploads;
    
    const term = searchTerm.toLowerCase();
    return questionUploads.filter(qu => 
      qu.question.text.toLowerCase().includes(term) ||
      qu.uploads.some(u => 
        (u.response.submittedBy || "").toLowerCase().includes(term) ||
        (u.response.submitterContact?.email || "").toLowerCase().includes(term)
      )
    );
  }, [questionUploads, searchTerm]);

  const toggleExpand = (questionId: string) => {
    const next = new Set(expandedQuestions);
    if (next.has(questionId)) {
      next.delete(questionId);
    } else {
      next.add(questionId);
    }
    setExpandedQuestions(next);
  };

  const toggleExpandSubmissions = (id: string) => {
    const next = new Set(expandedSubmissions);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedSubmissions(next);
  };

  const toggleExpandSections = (id: string) => {
    const next = new Set(expandedSections);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedSections(next);
  };

  const filteredSubmissions = useMemo(() => {
    if (!searchTerm.trim()) return submissionUploads;
    const term = searchTerm.toLowerCase();
    return submissionUploads.filter(s => 
      s.name.toLowerCase().includes(term) ||
      (s.response.submittedBy || "").toLowerCase().includes(term)
    );
  }, [submissionUploads, searchTerm]);

  const filteredSections = useMemo(() => {
    if (!searchTerm.trim()) return sectionUploads;
    const term = searchTerm.toLowerCase();
    return sectionUploads.filter(s => 
      s.section.title.toLowerCase().includes(term) ||
      s.uploads.some(u => u.question.text.toLowerCase().includes(term))
    );
  }, [sectionUploads, searchTerm]);

  const isImage = (url: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.startsWith('data:image/');
  };

  const getSubmitterDetails = (response: Response) => {
    if (!form || !form.sections || form.sections.length === 0) return null;
    
    const firstSection = form.sections[0];
    const details: { label: string; value: any }[] = [];
    
    firstSection.questions.forEach(q => {
      const answer = response.answers[q.id];
      if (answer !== undefined && answer !== null && answer !== "") {
        details.push({
          label: q.text,
          value: Array.isArray(answer) ? answer.join(", ") : String(answer)
        });
      }
    });
    
    return details;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-primary-50 rounded-full text-primary-600 transition-colors mr-2"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-primary-800 flex items-center gap-2">
              <Folder className="w-7 h-7 text-primary-600" />
              Form Uploads
            </h1>
            <p className="text-primary-600">{form?.title}</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center bg-primary-50 p-1 rounded-xl border border-primary-100 shadow-sm overflow-x-auto">
            <button
              onClick={() => setViewMode('questions')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                viewMode === 'questions' 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-primary-400 hover:text-primary-600'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Question-wise
            </button>
            <button
              onClick={() => setViewMode('sections')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                viewMode === 'sections' 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-primary-400 hover:text-primary-600'
              }`}
            >
              <Layers className="w-4 h-4" />
              Section-wise
            </button>
            <button
              onClick={() => setViewMode('submissions')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                viewMode === 'submissions' 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-primary-400 hover:text-primary-600'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Submission-wise
            </button>
          </div>
          
          <button
            onClick={downloadAllAsZip}
            disabled={zipping || (viewMode === 'questions' ? filteredQuestionUploads.length === 0 : viewMode === 'submissions' ? filteredSubmissions.length === 0 : filteredSections.length === 0)}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
          >
            {zipping ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <DownloadCloud className="w-4 h-4" />
            )}
            {zipping ? (
              zipProgress.total > 0 
                ? `Zipping ${zipProgress.current}/${zipProgress.total}...`
                : "Generating ZIP..."
            ) : "Download All as ZIP"}
          </button>
          
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <input
              type="text"
              placeholder="Search questions or submitters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-primary-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm"
            />
          </div>
        </div>
      </div>

      {(viewMode === 'questions' ? filteredQuestionUploads.length : viewMode === 'submissions' ? filteredSubmissions.length : filteredSections.length) === 0 ? (
        <div className="bg-white rounded-xl border border-primary-100 p-12 text-center">
          <ImageIcon className="w-16 h-16 text-primary-200 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary-800">No uploads found</h3>
          <p className="text-primary-500">There are no file or image uploads matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Question-wise View */}
          {viewMode === 'questions' && filteredQuestionUploads.map(({ question, uploads }) => (
            <div key={question.id} className="bg-white rounded-xl border border-primary-100 overflow-hidden shadow-sm">
              <button
                onClick={() => toggleExpand(question.id)}
                className="w-full flex items-center justify-between p-4 bg-primary-50/50 hover:bg-primary-50 transition-colors border-b border-primary-100"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-primary-200">
                    <FileText className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-primary-800">{question.text}</h3>
                    <p className="text-xs text-primary-500">{uploads.length} total uploads</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadQuestionAsZip(question, uploads);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-primary-200 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors text-xs font-medium"
                    title="Download these images as ZIP"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download ZIP</span>
                  </button>
                  {expandedQuestions.has(question.id) ? (
                    <ChevronDown className="w-5 h-5 text-primary-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-primary-400" />
                  )}
                </div>
              </button>
              
              {expandedQuestions.has(question.id) && (
                <div className="p-4 sm:p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {uploads.map((upload, index) => (
                      <div 
                        key={index}
                        className="group relative bg-primary-50/30 rounded-lg overflow-hidden border border-primary-100 aspect-square cursor-pointer hover:shadow-md transition-all"
                        onClick={() => setSelectedUpload(upload)}
                      >
                        {isImage(upload.url) ? (
                          <img 
                            src={upload.url} 
                            alt={`Upload ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                            <FileIcon className="w-10 h-10 text-primary-400 mb-2" />
                            <span className="text-[10px] text-primary-600 truncate w-full">
                              {upload.url.split('/').pop()}
                            </span>
                          </div>
                        )}
                        
                        <div className="absolute inset-0 bg-primary-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const name = getSubmitterName(upload.response).replace(/[\\/:*?"<>|]/g, '_');
                              downloadSingleImage(upload.url, `${name}_${index + 1}`);
                            }}
                            className="p-2.5 bg-white rounded-full text-primary-600 hover:bg-primary-50 transition-all transform hover:scale-110 shadow-lg"
                            title="Download image"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                          <div className="p-2.5 bg-primary-600 rounded-full text-white shadow-lg transform hover:scale-110 transition-all">
                            <Info className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Section-wise View */}
          {viewMode === 'sections' && filteredSections.map(({ section, uploads }) => (
            <div key={section.id} className="bg-white rounded-xl border border-primary-100 overflow-hidden shadow-sm">
              <button
                onClick={() => toggleExpandSections(section.id)}
                className="w-full flex items-center justify-between p-4 bg-primary-50/50 hover:bg-primary-50 transition-colors border-b border-primary-100"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-primary-200">
                    <Layers className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-primary-800">{section.title}</h3>
                    <p className="text-xs text-primary-500">{uploads.length} total uploads in this section</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadSectionAsZip(section, uploads);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-primary-200 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors text-xs font-medium"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download Section ZIP</span>
                  </button>
                  {expandedSections.has(section.id) ? (
                    <ChevronDown className="w-5 h-5 text-primary-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-primary-400" />
                  )}
                </div>
              </button>
              
              {expandedSections.has(section.id) && (
                <div className="p-4 sm:p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {uploads.map(({ question, upload }, index) => (
                      <div 
                        key={index}
                        className="group relative bg-primary-50/30 rounded-lg overflow-hidden border border-primary-100 aspect-square cursor-pointer hover:shadow-md transition-all"
                        onClick={() => setSelectedUpload(upload)}
                      >
                        {isImage(upload.url) ? (
                          <img src={upload.url} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                            <FileIcon className="w-10 h-10 text-primary-400 mb-2" />
                            <span className="text-[10px] text-primary-600 truncate w-full">{question.text}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-primary-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                           <div className="p-2.5 bg-primary-600 rounded-full text-white shadow-lg transform hover:scale-110 transition-all">
                            <Info className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50 text-white text-[8px] truncate">
                          {getSubmitterName(upload.response)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Submission-wise View */}
          {viewMode === 'submissions' && filteredSubmissions.map(({ response, name, uploads }) => (
            <div key={response.id} className="bg-white rounded-xl border border-primary-100 overflow-hidden shadow-sm">
              <button
                onClick={() => toggleExpandSubmissions(response.id)}
                className="w-full flex items-center justify-between p-4 bg-primary-50/50 hover:bg-primary-50 transition-colors border-b border-primary-100"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-primary-200">
                    <User className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-primary-800">{name}</h3>
                    <p className="text-xs text-primary-500">
                      {new Date(response.createdAt).toLocaleDateString()} • {uploads.length} uploads
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadSubmissionAsZip(name, response, uploads);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-primary-200 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors text-xs font-medium"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download ZIP</span>
                  </button>
                  {expandedSubmissions.has(response.id) ? (
                    <ChevronDown className="w-5 h-5 text-primary-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-primary-400" />
                  )}
                </div>
              </button>
              
              {expandedSubmissions.has(response.id) && (
                <div className="p-4 sm:p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {uploads.map((upload, index) => (
                      <div 
                        key={index}
                        className="group relative bg-primary-50/30 rounded-lg overflow-hidden border border-primary-100 aspect-square cursor-pointer hover:shadow-md transition-all"
                        onClick={() => setSelectedUpload({ url: upload.url, response })}
                      >
                        {isImage(upload.url) ? (
                          <img src={upload.url} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                            <FileIcon className="w-10 h-10 text-primary-400 mb-2" />
                            <span className="text-[10px] text-primary-600 truncate w-full">{upload.question.text}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-primary-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                           <div className="p-2.5 bg-primary-600 rounded-full text-white shadow-lg transform hover:scale-110 transition-all">
                            <Info className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50 text-white text-[8px] truncate">
                          {upload.question.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scaleIn">
            <div className="p-4 border-b border-primary-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary-50 rounded-xl">
                  <User className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-bold text-primary-800 leading-tight">Submission Details</h3>
                  <p className="text-[11px] text-primary-500 font-medium">
                    {new Date(selectedUpload.response.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const name = getSubmitterName(selectedUpload.response).replace(/[\\/:*?"<>|]/g, '_');
                    downloadSingleImage(selectedUpload.url, `${name}_download`);
                  }}
                  className="p-2.5 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-xl transition-all"
                  title="Download File"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setSelectedUpload(null)}
                  className="p-2.5 hover:bg-red-50 rounded-xl text-primary-400 hover:text-red-500 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1 min-w-0 w-full">
                <div className="bg-primary-50/30 rounded-2xl border border-primary-100 overflow-hidden mb-6 shadow-inner">
                  {isImage(selectedUpload.url) ? (
                    <div className="relative group/preview min-h-[300px] flex items-center justify-center bg-primary-100/20">
                      <img 
                        src={selectedUpload.url} 
                        alt="Upload Preview"
                        className="w-full h-auto max-h-[500px] object-contain mx-auto"
                      />
                    </div>
                  ) : (
                    <div className="py-24 flex flex-col items-center justify-center">
                      <div className="p-6 bg-white rounded-3xl shadow-sm border border-primary-100 mb-4">
                        <FileIcon className="w-16 h-16 text-primary-300" />
                      </div>
                      <p className="text-primary-600 font-semibold text-lg">No preview available</p>
                      <p className="text-primary-400 text-sm mt-1">This file type cannot be previewed directly</p>
                    </div>
                  )}
                  <div className="p-5 bg-white border-t border-primary-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[10px] text-primary-400 font-bold uppercase tracking-widest mb-1">Source URL</span>
                      <span className="text-xs text-primary-600 break-all font-mono bg-primary-50 px-2 py-1.5 rounded border border-primary-100/50">
                        {selectedUpload.url}
                      </span>
                    </div>
                    <a 
                      href={selectedUpload.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-primary-200 text-primary-700 rounded-xl hover:bg-primary-50 hover:border-primary-300 transition-all text-sm font-bold shadow-sm whitespace-nowrap"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Full Size
                    </a>
                  </div>
                </div>
              </div>
              
              <div className="w-full md:w-80 flex-shrink-0 sticky top-0">
                <div className="bg-white rounded-2xl border border-primary-100 p-5 shadow-sm">
                  <h4 className="font-bold text-primary-800 mb-5 flex items-center gap-2 text-lg">
                    <div className="p-1.5 bg-primary-600 rounded-lg">
                      <Info className="w-4 h-4 text-white" />
                    </div>
                    Submission Data
                  </h4>
                  <div className="space-y-5">
                    {getSubmitterDetails(selectedUpload.response)?.map((detail, idx) => (
                      <div key={idx} className="group">
                        <p className="text-[10px] text-primary-400 font-bold uppercase tracking-wider mb-1.5 group-hover:text-primary-600 transition-colors">{detail.label}</p>
                        <p className="text-[14px] text-primary-900 font-semibold leading-relaxed bg-primary-50/50 p-3 rounded-xl border border-transparent group-hover:border-primary-100 group-hover:bg-white transition-all break-words">
                          {detail.value}
                        </p>
                      </div>
                    ))}
                    
                    <div className="pt-4 mt-6 border-t border-primary-50">
                      <button
                        onClick={() => navigate(`/responses/${selectedUpload.response.id}`)}
                        className="w-full py-4 bg-primary-50 text-primary-700 rounded-2xl hover:bg-primary-600 hover:text-white transition-all text-sm font-bold flex items-center justify-center gap-2 shadow-sm border border-primary-100/50"
                      >
                        View Full Response
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
