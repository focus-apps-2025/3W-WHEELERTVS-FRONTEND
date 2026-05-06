import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "../api/client";
import SectionContent from "./preview/SectionContent";
import ThankYouMessage from "./ThankYouMessage";
import {
  MapPin,
  RefreshCw,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Sun,
  Moon,
  AlertTriangle,
  Database,
  Sparkles,
  Zap,
  Clipboard,
  Users,
  Send,
  X,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../context/NotificationContext";
import { useQuestionLogic } from "../hooks/useQuestionLogic";
import { useAuth } from "../context/AuthContext";
import type { Question, Response, Section, FollowUpQuestion } from "../types";
import {
  getLevel2Options,
  getLevel3Options,
  getLevel4Options,
  getLevel5Options,
  getLevel6Options,
} from "../config/npsHierarchy";

interface Form {
  id: string;
  title: string;
  description: string;
  sections: any[];
  viewType?: "section-wise" | "question-wise";
  followUpQuestions?: any[];
  chassisNumbers?: Array<{ chassisNumber: string; partDescription: string }> | string[];
  chassisTenantAssignments?: Record<string, string[]>;
}

interface PreviewFormProps {
  questions?: Question[];
  onSubmit?: (response: Response) => Promise<void> | void;
  branchingRules?: any[];
  viewType?: "section-wise" | "question-wise";
  onQuestionChange?: (
    questionId: string,
    questionText: string,
    questionType: string,
    sectionId: string,
    sectionTitle: string,
    answer?: any,
  ) => void;
  onSectionComplete?: (
    sectionId: string,
    sectionTitle: string,
    timeSpentSeconds: number,
    questionCount: number
  ) => void;
  formSessionId?: string | null;
  chassisNumbers?: Array<{ chassisNumber: string; partDescription: string }> | string[];
  chassisTenantAssignments?: Record<string, string[]>;
}

export default function PreviewForm({
  questions: propQuestions,
  onSubmit: propOnSubmit,
  branchingRules: propBranchingRules = [],
  viewType = "section-wise",
  onQuestionChange,
  onSectionComplete,
  formSessionId,
  chassisNumbers: propChassisNumbers,
  chassisTenantAssignments: propChassisTenantAssignments,
}: PreviewFormProps) {
  const { id: formId } = useParams<{ id: string }>();
  const { tenant, user } = useAuth();

  // Debug log to check auth state
  useEffect(() => {
    console.log("[PREVIEW FORM] Auth state changed - user:", user);
    console.log("[PREVIEW FORM] Auth state changed - tenant:", tenant?.slug);
  }, [user, tenant]);
  const tenantSlug = tenant?.slug;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get("inviteId");
  const [form, setForm] = useState<Form | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [branchingRules, setBranchingRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(true);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [locationDisplayName, setLocationDisplayName] = useState<string | null>(
    null,
  );
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [navigationHistory, setNavigationHistory] = useState<number[]>([0]);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(
    new Set(),
  );
  const [branchingAlert, setBranchingAlert] = useState<string | null>(null);
  const [parentSectionIndex, setParentSectionIndex] = useState<number | null>(
    null,
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousQuestionId, setPreviousQuestionId] = useState<string | null>(
    null,
  );
  const [sectionStartTime, setSectionStartTime] = useState<Date>(new Date());
  const [sectionQuestionCount, setSectionQuestionCount] = useState(0);
  const [visitedSectionIndices, setVisitedSectionIndices] = useState<
    Set<number>
  >(new Set([0]));
  const [sectionNavigationHistory, setSectionNavigationHistory] = useState<
    number[]
  >([0]);

  const allFormQuestions = useMemo(() => {
    const getAllQuestions = (questions: any[]): any[] => {
      let all: any[] = [];
      (questions || []).forEach((q) => {
        all.push(q);
        if (q.followUpQuestions && q.followUpQuestions.length > 0) {
          all = all.concat(getAllQuestions(q.followUpQuestions));
        }
      });
      return all;
    };

    const allQs: any[] = [];
    form?.sections?.forEach((s: any) => {
      allQs.push(...getAllQuestions(s.questions));
      if (s.subsections) {
        s.subsections.forEach((ss: any) => {
          allQs.push(...getAllQuestions(ss.questions));
        });
      }
    });

    if (form?.followUpQuestions) {
      allQs.push(...getAllQuestions(form.followUpQuestions));
    }
    return allQs;
  }, [form]);

  const [sectionSubmitting, setSectionSubmitting] = useState(false);
  const [suggestedAnswers, setSuggestedAnswers] = useState<Record<
    string,
    any
  > | null>(null);
  const [fetchingSuggestionsForId, setFetchingSuggestionsForId] = useState<
    string | null
  >(null);
  const [lastSuggestionSource, setLastSuggestionSource] = useState<
    string | null
  >(null);
  const [previousUniqueAnswers, setPreviousUniqueAnswers] = useState<any[]>([]);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [triggeringQuestionId, setTriggeringQuestionId] = useState<string | null>(null);
  const [globalRankAnswers, setGlobalRankAnswers] = useState<Record<string, any> | null>(null);
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [previousAnswers, setPreviousAnswers] = useState<string[]>([]);
  const [showMobileAssistant, setShowMobileAssistant] = useState(false);
  const { darkMode, toggleDarkMode } = useTheme();
  const { showSuccess, showConfirm, showError: showNotifyError } = useNotification();
  const { getOrderedVisibleQuestions } = useQuestionLogic();

  // Normalize chassis numbers for display
  const chassisNumbers = useMemo(() => {
    const rawChassis = propChassisNumbers || form?.chassisNumbers || [];
    return rawChassis.map((cn: any) =>
      typeof cn === 'string' ? { chassisNumber: cn, partDescription: '' } : cn
    );
  }, [propChassisNumbers, form?.chassisNumbers]);

  const chassisTenantAssignments = useMemo(() => {
    return propChassisTenantAssignments || form?.chassisTenantAssignments || {};
  }, [propChassisTenantAssignments, form?.chassisTenantAssignments]);

  const isValidFileInput = (value: any): boolean => {
    if (!value) return false;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (parsed && parsed.url && parsed.location) {
          return !!parsed.url;
        }
      } catch {}
      return value.trim().length > 0;
    }
    return false;
  };

  const isAnswerProvided = (q: any, answer: any) => {
    if (q.type === "file") {
      return isValidFileInput(answer);
    }
    if (q.type === "productNPSTGWBuckets") {
      if (!answer || typeof answer !== "object" || !answer.level1) return false;
      const l2Opts = getLevel2Options(answer.level1);
      if (l2Opts.length > 0 && !answer.level2) return false;
      if (answer.level2) {
        const l3Opts = getLevel3Options(answer.level1, answer.level2);
        if (l3Opts.length > 0 && !answer.level3) return false;
      }
      if (answer.level3) {
        const l4Opts = getLevel4Options(answer.level1, answer.level2, answer.level3);
        if (l4Opts.length > 0 && !answer.level4) return false;
      }
      if (answer.level4) {
        const l5Opts = getLevel5Options(answer.level1, answer.level2, answer.level3, answer.level4);
        if (l5Opts.length > 0 && !answer.level5) return false;
      }
      if (answer.level5) {
        const l6Opts = getLevel6Options(answer.level1, answer.level2, answer.level3, answer.level4, answer.level5);
        if (l6Opts.length > 0 && !answer.level6) return false;
      }
      return true;
    }
    if (q.type === "chassis-with-zone" || q.type === "chassis-without-zone") {
      if (!answer || typeof answer !== "object") return false;
      const { chassisNumber, status, zone, defectCategory, defects } = answer;
      if (!chassisNumber?.trim() || !status) return false;
      if (status === 'Rejected' || status === 'Rework') {
        if (q.type === "chassis-with-zone") {
          if (!zone || (Array.isArray(zone) && zone.length === 0)) return false;
        }
        const hasCategory = Array.isArray(defectCategory) ? defectCategory.length > 0 : !!defectCategory;
        if (!hasCategory || !Array.isArray(defects) || defects.length === 0) return false;
      }
      return true;
    }
    if (q.type === "checkbox") {
      return Array.isArray(answer) && answer.length > 0;
    }
    if (q.type === "radio-grid" || q.type === "checkbox-grid" || q.type === "grid") {
      if (!answer || typeof answer !== "object") return false;
      const rows = q.gridOptions?.rows || q.rows || [];
      if (rows.length === 0) return true;
      return rows.every((row: any) => {
        const rowId = typeof row === "string" ? row : row.id || row;
        const rowAnswer = answer[rowId];
        if (q.type === "checkbox-grid") {
          return Array.isArray(rowAnswer) && rowAnswer.length > 0;
        }
        return rowAnswer !== undefined && rowAnswer !== null && String(rowAnswer).trim() !== "";
      });
    }
    return answer !== undefined && answer !== null && String(answer).trim() !== "";
  };

  const validateSections = (sectionsToValidate: any[]) => {
    let isValid = true;
    const newErrors = new Set<string>();

    sectionsToValidate.forEach((section) => {
      if (!section) return;
      const allQuestions = [...section.questions];
      const subSections = form?.sections.filter(
          (s) => s.isSubsection && s.parentSectionId === section.id,
        ) || [];

      subSections.forEach((ss) => {
        allQuestions.push(...ss.questions);
      });

      const visibleQuestions = getOrderedVisibleQuestions(allQuestions, answers);

      visibleQuestions.forEach((q) => {
        if (!q.required) return;
        const qId = q.id || (q as any)._id;
        if (!qId) return;
        const answer = answers[qId];
        const provided = isAnswerProvided(q, answer);
        if (!provided) {
          isValid = false;
          newErrors.add(qId);
        }
      });
    });

    setValidationErrors(newErrors);

    if (!isValid) {
      showNotifyError("Please fill in all required questions");
      setTimeout(() => {
        const firstError = document.querySelector('[data-error="true"]');
        if (firstError) {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }

    return isValid;
  };

  const clearSavedData = () => {
    console.log("[PreviewForm] clearSavedData called (no-op in preview)");
  };

  // Fetch form data
  useEffect(() => {
    const fetchForm = async () => {
      if (propQuestions && propQuestions.length > 0) {
        const mockForm: Form = {
          id: formId || "preview",
          title: "Preview Form",
          description: "This is a preview of your form",
          sections: [],
          viewType: viewType,
          chassisNumbers: propChassisNumbers,
          chassisTenantAssignments: propChassisTenantAssignments,
        };

        const firstQ = propQuestions[0];
        if (firstQ.sections && firstQ.sections.length > 0) {
          mockForm.title = firstQ.title;
          mockForm.description = firstQ.description;
          mockForm.sections = firstQ.sections;
        } else {
          mockForm.sections = [
            {
              id: "default",
              title: firstQ.title,
              description: firstQ.description,
              questions: propQuestions,
            },
          ];
        }

        mockForm.sections = mockForm.sections.map((section: any) => {
          const allQuestions: any[] = [];
          const flattenQuestions = (questions: any[], parentId?: string) => {
            (questions || []).forEach((question: any) => {
              const { followUpQuestions, ...mainQuestion } = question;
              if (parentId && !mainQuestion.showWhen) {
                mainQuestion.showWhen = {
                  questionId: parentId,
                  value: mainQuestion.showWhen?.value || "",
                };
              }
              allQuestions.push(mainQuestion);
              if (followUpQuestions && followUpQuestions.length > 0) {
                flattenQuestions(followUpQuestions, question.id);
              }
            });
          };
          flattenQuestions(section.questions || []);
          return {
            ...section,
            id: section.id || section._id,
            questions: allQuestions,
          };
        });

        setForm(mockForm);
        setBranchingRules(propBranchingRules);
        setLoading(false);
        return;
      }

      if (!formId) return;

      try {
        const response = await apiClient.getPublicForm(formId, tenantSlug, inviteId);
        const fetchedForm = response.form;

        if (fetchedForm && (!fetchedForm.sections || fetchedForm.sections.length === 0)) {
          fetchedForm.sections = [
            {
              id: "default",
              title: fetchedForm.title,
              description: fetchedForm.description,
              questions: fetchedForm.followUpQuestions || [],
            },
          ];
        }

        if (fetchedForm && fetchedForm.sections) {
          fetchedForm.sections = fetchedForm.sections.map((section: any) => {
            const allQuestions: any[] = [];
            const flattenQuestions = (questions: any[], parentId?: string) => {
              (questions || []).forEach((question: any) => {
                const { followUpQuestions, ...mainQuestion } = question;
                if (parentId && !mainQuestion.showWhen) {
                  mainQuestion.showWhen = {
                    questionId: parentId,
                    value: mainQuestion.showWhen?.value || "",
                  };
                }
                allQuestions.push(mainQuestion);
                if (followUpQuestions && followUpQuestions.length > 0) {
                  flattenQuestions(followUpQuestions, question.id);
                }
              });
            };
            flattenQuestions(section.questions || []);
            return {
              ...section,
              id: section.id || section._id,
              nextSectionId: section.nextSectionId || (section as any)._nextSectionId,
              questions: allQuestions,
            };
          });
        }

        setForm(fetchedForm);

        try {
          const rulesResponse = await apiClient.getSectionBranchingPublic(formId, tenantSlug);
          if (rulesResponse && rulesResponse.sectionBranching) {
            setBranchingRules(rulesResponse.sectionBranching);
          }
        } catch (rulesErr) {
          console.warn("[PreviewForm] Failed to fetch branching rules:", rulesErr);
        }
      } catch (err: any) {
        if (err.response?.message === "ALREADY_SUBMITTED") {
          showConfirm(
            "You have already responded to this form using this link. Are you sure you want to re-submit? Your previous response will be kept, but a new one will be created.",
            async () => {
              try {
                const response = await apiClient.getPublicForm(formId!, tenantSlug);
                setForm(response.form);
                const rulesResponse = await apiClient.getSectionBranchingPublic(formId!, tenantSlug);
                if (rulesResponse && rulesResponse.sectionBranching) {
                  setBranchingRules(rulesResponse.sectionBranching);
                }
              } catch (retryErr: any) {
                setError("Failed to load form after confirmation");
              }
            },
            "Already Responded",
            "Yes, Continue",
            "Go Home",
            () => navigate("/forms/analytics"),
          );
          return;
        }
        setError("Failed to load form");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [formId, tenantSlug, propQuestions, propBranchingRules, viewType, propChassisNumbers, propChassisTenantAssignments]);

  // Location tracking
  useEffect(() => {
    const getLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            });
            setLocationError(null);
          },
          (err) => {
            console.warn("Location access denied or unavailable:", err.message);
            setLocationError(
              "Location access denied. Please enable location permissions in your browser settings and refresh the page.",
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000,
          },
        );
      } else {
        setLocationError("Geolocation is not supported by this browser.");
      }
    };

    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then(function (permissionStatus) {
          if (permissionStatus.state === "denied") {
            setLocationError(
              "Location access denied. Please enable location permissions in your browser settings and refresh the page.",
            );
            return;
          }
          getLocation();
        })
        .catch(() => {
          getLocation();
        });
    } else {
      getLocation();
    }
  }, []);

  // Reverse geocode location
  useEffect(() => {
    const reverseGeocode = async () => {
      if (!location || locationDisplayName || reverseGeocoding) return;
      setReverseGeocoding(true);
      try {
        const response = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.latitude}&longitude=${location.longitude}&localityLanguage=en`,
        );
        if (response.ok) {
          const data = await response.json();
          const parts = [
            data.locality,
            data.city,
            data.principalSubdivision,
            data.countryName,
          ].filter(Boolean);
          if (parts.length > 0) {
            setLocationDisplayName(parts.join(", "));
          }
        }
      } catch (error) {
        console.warn("Reverse geocoding failed:", error);
      } finally {
        setReverseGeocoding(false);
      }
    };
    reverseGeocode();
  }, [location, locationDisplayName, reverseGeocoding]);

  const handleConfirmLocation = () => {
    setLocationConfirmed(true);
  };

  const handleRefreshLocation = () => {
    setLocation(null);
    setLocationError(null);
    setLocationDisplayName(null);
    const getLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            });
            setLocationError(null);
          },
          (err) => {
            console.warn("Location access denied or unavailable:", err.message);
            setLocationError(
              "Location access denied. Please enable location permissions in your browser settings and refresh the page.",
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000,
          },
        );
      } else {
        setLocationError("Geolocation is not supported by this browser.");
      }
    };
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then(function (permissionStatus) {
          if (permissionStatus.state === "denied") {
            setLocationError(
              "Location access denied. Please enable location permissions in your browser settings and refresh the page.",
            );
            return;
          }
          getLocation();
        })
        .catch(() => {
          getLocation();
        });
    } else {
      getLocation();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !formId) return;

    const mainSections = getMainSections();
    const historyIndices = Array.from(new Set(navigationHistory));
    const sectionsToValidate = mainSections.filter((_, idx) => historyIndices.includes(idx));

    if (!validateSections(sectionsToValidate)) return;

    showConfirm(
      "Are you sure you want to submit your response? You won't be able to change it later.",
      async () => {
        await performSubmission();
      },
      "Confirm Submission",
      "Submit Now",
      "Review Form",
    );
  };

  const performSubmission = async () => {
     if (formSessionId && chassisNumbers.length > 0) {
    if (!answers['chassis_number']) {
      showNotifyError("Please select a Chassis Number before submitting");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
  }
    setSubmitting(true);
    try {
      console.log("[PREVIEW FORM] User object full:", JSON.stringify(user));
      console.log("[PREVIEW FORM] User is null?", user === null);
      console.log("[PREVIEW FORM] User is undefined?", user === undefined);
      console.log("[PREVIEW FORM] User firstName:", user?.firstName);
      console.log("[PREVIEW FORM] User lastName:", user?.lastName);
      console.log("[PREVIEW FORM] User email:", user?.email);
      console.log("[PREVIEW FORM] User username:", user?.username);

      // Build user info - fallback to tenant info if user is not available
      let submittedByValue: string | undefined = undefined;
      if (user) {
        submittedByValue =
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.username || user.email || undefined;
      }
      console.log("[PREVIEW FORM] submittedByValue:", submittedByValue);

      const submissionData: any = {
        answers: answers,
        inviteId: inviteId || null,
        submittedBy: submittedByValue,
        submitterContact: user
          ? {
              email: user.email || "",
              phone: user.phone || "",
            }
          : {},
      };

      console.log(
        "[PREVIEW FORM] Submission data submittedBy:",
        submissionData.submittedBy,
      );
      console.log(
        "[PREVIEW FORM] Submission data submitterContact:",
        submissionData.submitterContact,
      );

      if (location) {
        submissionData.location = {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          source: "browser",
          capturedAt: new Date().toISOString(),
        };
      }

      // Also add timing data if available
      if (formSessionId) {
        submissionData.sessionId = formSessionId;
        submissionData.startedAt = sectionStartTime;
        submissionData.completedAt = new Date();
      }

      if (propOnSubmit) {
        await propOnSubmit({
          id: "preview-response",
          formId: formId || "preview",
          answers: answers,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any);
        showSuccess("Preview submission successful!");
        setSubmitted(true);
        return;
      }

      if (!formId) return;

      const response = await apiClient.submitResponse(formId, tenantSlug, submissionData);
      clearSavedData();

      // Check for follow-up form redirection
      let followUpFormId: string | null = null;
      if (form && form.sections) {
        for (const section of form.sections) {
          if (!section.questions) continue;
          for (const question of section.questions) {
            const answer = answers[question.id];
            if (answer && question.followUpConfig) {
              if (Array.isArray(answer)) {
                for (const val of answer) {
                  if (question.followUpConfig[val]?.linkedFormId) {
                    followUpFormId = question.followUpConfig[val].linkedFormId;
                    break;
                  }
                }
              } else if (question.followUpConfig[answer]?.linkedFormId) {
                followUpFormId = question.followUpConfig[answer].linkedFormId;
              }
            }
            if (followUpFormId) break;
          }
          if (followUpFormId) break;
        }
      }

      if (followUpFormId) {
        showConfirm(
          `Form submitted successfully! You will now be redirected to a follow-up form.`,
          () => navigate(`/${tenantSlug}/forms/${followUpFormId}`),
          "Success",
          "Continue",
          "Go Home",
          () => navigate(`/${tenantSlug}`),
        );
        return;
      }

      // Check for child forms
      try {
        const childFormsData = await apiClient.getChildForms(formId);
        if (childFormsData.childForms && childFormsData.childForms.length > 0) {
          const nextChildForm = childFormsData.childForms.find(
            (cf: any) => cf.isActive && cf.isVisible,
          );
          if (nextChildForm) {
            showConfirm(
              `Form submitted successfully! You will now be redirected to the next form: "${nextChildForm.title}"`,
              () => navigate(`/${tenantSlug}/forms/${nextChildForm.id}`),
              "Success",
              "Continue",
              "Go Home",
              () => navigate(`/${tenantSlug}`),
            );
            return;
          }
        }
      } catch (childFormErr) {
        console.warn("Could not fetch child forms:", childFormErr);
      }

      showSuccess("Form submitted successfully!");
      setSubmitted(true);
    } catch (err) {
      showNotifyError("Failed to submit form");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResponseChange = (questionId: string, value: any) => {
    // Track question change for analytics
    if (!answers[questionId] && value && onQuestionChange && getMainSections()[currentSectionIndex]) {
      const currentSection = getMainSections()[currentSectionIndex];
      const question = currentSection.questions?.find((q: any) => q.id === questionId);
      if (question) {
        onQuestionChange(
          questionId,
          question.text || "Unknown Question",
          question.type || "unknown",
          currentSection.id,
          currentSection.title || "Untitled Section",
          value
        );
      }
    }

    setAnswers((prev) => ({ ...prev, [questionId]: value }));

    // Suggestion logic
    const normalizedQId = questionId.endsWith("_tracking") ? questionId.replace("_tracking", "") : questionId;
    const normalizeKey = (s: string) => String(s || "").toLowerCase().replace(/_tracking$/, "").replace(/^_/, "").trim();
    const normalizedTarget = normalizeKey(normalizedQId);

    const question = allFormQuestions.find((q) => {
      const qId = (q.id || (q as any)._id) as string;
      if (!qId) return false;
      return qId === normalizedQId || qId.toLowerCase() === normalizedQId.toLowerCase() || normalizeKey(qId) === normalizedTarget;
    });

    // Only fetch suggestions if trackResponseQuestion OR trackResponseRank is enabled
    const isTrackQuestionEnabled = question && (
      question.trackResponseQuestion === true || 
      String(question.trackResponseQuestion) === "true"
    );
    const isTrackRankEnabled = question && (
      question.trackResponseRank === true ||
      String(question.trackResponseRank) === "true"
    );
    const isAnyTrackingEnabled = isTrackQuestionEnabled || isTrackRankEnabled;

    if (fetchingSuggestionsForId !== questionId) {
      setPreviousUniqueAnswers([]);
    }

    const getExistingSuggestion = (qId: string) => {
      if (!suggestedAnswers) return null;
      const normalize = (s: string) => String(s || "").toLowerCase().replace(/_tracking$/, "").replace(/^_/, "").trim();
      const target = normalize(qId);
      if (Array.isArray(suggestedAnswers)) {
        if (suggestedAnswers.length === 0) return null;
        const firstRecord = suggestedAnswers[0].answers;
        const matchKey = Object.keys(firstRecord).find(k => normalize(k) === target);
        return matchKey ? firstRecord[matchKey] : null;
      }
      if (suggestedAnswers[qId] !== undefined) return suggestedAnswers[qId];
      const matchKey = Object.keys(suggestedAnswers).find(k => normalize(k) === target);
      return matchKey ? suggestedAnswers[matchKey] : null;
    };

    const searchValue = (typeof value === 'object' && value?.chassisNumber) ? value.chassisNumber : value;
    const currentMatchingSuggestion = getExistingSuggestion(questionId);
    const isAlreadySuggested = currentMatchingSuggestion !== null &&
      String(currentMatchingSuggestion).trim().toLowerCase() === String(searchValue).trim().toLowerCase();

    const isMeaningful = (typeof value === "string" && value.trim().length >= 1) ||
      typeof value === "number" ||
      ((question?.type === "chassis-with-zone" || question?.type === "chassis-without-zone") && value?.chassisNumber?.trim().length >= 1);

    // Only fetch suggestions if any tracking is enabled (trackResponseQuestion OR trackResponseRank)
    if (isMeaningful && formId && !isAlreadySuggested && isAnyTrackingEnabled) {
      const timeoutId = (window as any)._suggestionTimeout;
      if (timeoutId) clearTimeout(timeoutId);
      (window as any)._suggestionTimeout = setTimeout(() => {
        const currentFetchSource = `${normalizedQId}:${searchValue}`;
        if (fetchingSuggestionsForId !== currentFetchSource) {
          fetchSuggestions(normalizedQId, value);
        }
      }, 800);
    }
  };

  const fetchSuggestions = async (questionId: string, value: any) => {
    if (!formId) return;

    const searchValue = (typeof value === 'object' && value?.chassisNumber) ? value.chassisNumber : value;

    const getExistingSuggestion = (qId: string) => {
      if (!suggestedAnswers) return null;
      const normalize = (s: string) => String(s || "").toLowerCase().replace(/_tracking$/, "").replace(/^_/, "").trim();
      const target = normalize(qId);
      if (Array.isArray(suggestedAnswers)) {
        if (suggestedAnswers.length === 0) return null;
        const firstRecord = suggestedAnswers[0].answers;
        const matchKey = Object.keys(firstRecord).find(k => normalize(k) === target);
        return matchKey ? firstRecord[matchKey] : null;
      }
      if (suggestedAnswers[qId] !== undefined) return suggestedAnswers[qId];
      const matchKey = Object.keys(suggestedAnswers).find(k => normalize(k) === target);
      return matchKey ? suggestedAnswers[matchKey] : null;
    };

    const currentMatchingSuggestion = getExistingSuggestion(questionId);
    const searchSource = `${questionId}:${searchValue}`;
    if (lastSuggestionSource === searchSource ||
      (currentMatchingSuggestion !== null &&
        String(currentMatchingSuggestion).trim().toLowerCase() === String(searchValue).trim().toLowerCase())) {
      return;
    }

    try {
      setFetchingSuggestionsForId(searchSource);
      setTriggeringQuestionId(questionId);

      apiClient.getQuestionPreviousAnswers(formId, questionId, tenantSlug)
        .then(res => {
          if (res && res.answers) {
            setPreviousUniqueAnswers(res.answers);
          }
        })
        .catch(err => console.warn("[PreviewForm] Failed to fetch previous answers:", err));

      const result = await apiClient.getSuggestedAnswers(formId, questionId, searchValue, tenantSlug);
      setLastSuggestionSource(`${questionId}:${searchValue}`);

      if (result && result.suggestedAnswers) {
        const rawSuggestions = Array.isArray(result.suggestedAnswers) ? result.suggestedAnswers : [];
        
        // Exact match filter: only show if the triggering question's value matches exactly
        const normalize = (v: any) => String(v || "").trim().toLowerCase();
        const searchValNormalized = normalize(searchValue);
        
        const suggestions = rawSuggestions.filter(s => {
          const val = s.answers?.[questionId];
          if (typeof val === 'object' && val?.chassisNumber) {
            return normalize(val.chassisNumber) === searchValNormalized;
          }
          return normalize(val) === searchValNormalized;
        });

        const totalAnswersCount = suggestions.length;
        const hasSubstantialData = totalAnswersCount > 0;

        setSuggestedAnswers(suggestions);
        if (hasSubstantialData && suggestions[0]) {
          setSelectedRank(1);
          setGlobalRankAnswers(suggestions[0].answers || null);
          setGlobalRank(suggestions[0].rank || 1);
          showSuccess(`${totalAnswersCount} previous records found!`);
        } else {
          setSuggestedAnswers({ _no_match: true });
          setGlobalRankAnswers(null);
          setGlobalRank(null);
        }
      } else {
        setSuggestedAnswers({ _no_match: true });
        setGlobalRankAnswers(null);
        setGlobalRank(null);
      }
    } catch (err) {
      console.error("[PreviewForm] Failed to fetch suggestions:", err);
    } finally {
      const fetchSource = `${questionId}:${searchValue}`;
      setFetchingSuggestionsForId((prev) => prev === fetchSource ? null : prev);
    }
  };

  const applySuggestions = (specificAnswers?: Record<string, any>, targetQuestionId?: string, rank?: number) => {
    const suggestionsToApply = specificAnswers || (Array.isArray(suggestedAnswers) ? suggestedAnswers[0]?.answers : suggestedAnswers);
    if (!suggestionsToApply || suggestionsToApply._no_match) return;

    if (rank !== undefined) setSelectedRank(rank);

    const effectiveTargetId = targetQuestionId ||
      (fetchingSuggestionsForId?.split(':')[0]) ||
      (lastSuggestionSource?.split(':')[0]);

    setAnswers((prev) => {
      const newAnswers = { ...prev };
      const normalize = (s: string) => String(s || "").toLowerCase().replace(/_tracking$/, "").replace(/^_/, "").trim();

      Object.keys(suggestionsToApply).forEach((key) => {
        if (key.startsWith("_") && !key.includes("tracking")) return;
        const val = suggestionsToApply[key];
        if (val === null || val === undefined || String(val).trim() === "") return;

        const normalizedKey = normalize(key);
        const question = allFormQuestions.find((q) => {
          const qId = (q.id || (q as any)._id) as string;
          if (!qId) return false;
          return qId === key || qId.toLowerCase() === key.toLowerCase() || normalize(qId) === normalizedKey;
        });

        if (question) {
          const qId = question.id || (question as any)._id;

          // If targetQuestionId is provided, we only apply to THAT specific question
          // If it is NULL, we apply EVERYTHING in the record (Apply All feature)
          if (targetQuestionId) {
            const normalizedTarget = normalize(targetQuestionId);
            if (normalize(qId) !== normalizedTarget) {
              return;
            }
          }

          if (key.endsWith("_tracking")) {
            newAnswers[`${qId}_tracking`] = val;
          } else {
            newAnswers[qId] = val;
          }
        }
      });
      return newAnswers;
    });
  };

  const activeTrackQuestion = useMemo(() => {
    const qId = triggeringQuestionId || (lastSuggestionSource?.split(':')[0]);
    if (!qId) return null;
    
    const question = allFormQuestions.find(q => (q.id || (q as any)._id) === qId);
    if (!question || !(question.trackResponseQuestion === true || String(question.trackResponseQuestion) === "true")) {
      return null;
    }
    return question;
  }, [triggeringQuestionId, lastSuggestionSource, allFormQuestions]);

  const handleLoadSampleData = () => {
    if (!form) return;

    const sampleResponses: Record<string, any> = { ...answers };

    allFormQuestions.forEach((question: any) => {
      const qId = question.id || question._id;
      if (!qId) return;
      if (sampleResponses[qId] !== undefined && sampleResponses[qId] !== "") return;

      switch (question.type) {
        case "text":
        case "paragraph":
        case "email":
        case "tel":
        case "url":
          sampleResponses[qId] = `Sample ${question.text || qId}`;
          break;
        case "number":
          sampleResponses[qId] = 42;
          break;
        case "radio":
        case "select":
        case "dropdown":
        case "yesNoNA":
        case "radio-image":
        case "search-select":
          if (question.options && question.options.length > 0) {
            sampleResponses[qId] = question.options[0].label || question.options[0];
          } else if (question.type === "yesNoNA") {
            sampleResponses[qId] = "Yes";
          }
          break;
        case "checkbox":
        case "multiple_choice":
          if (question.options && question.options.length > 0) {
            sampleResponses[qId] = [question.options[0].label || question.options[0]];
          }
          break;
        case "rating":
        case "rating-number":
        case "satisfaction-rating":
          sampleResponses[qId] = 5;
          break;
        case "scale":
          sampleResponses[qId] = 5;
          break;
        case "slider":
        case "slider-feedback":
          sampleResponses[qId] = 50;
          break;
        case "date":
          sampleResponses[qId] = new Date().toISOString().split("T")[0];
          break;
        case "time":
          sampleResponses[qId] = "12:00";
          break;
        case "datetime":
          sampleResponses[qId] = new Date().toISOString().slice(0, 16);
          break;
        case "emoji-reaction":
        case "emoji-reaction-feedback":
          sampleResponses[qId] = "happy";
          break;
        case "emoji-star":
        case "emoji-star-feedback":
          sampleResponses[qId] = 4;
          break;
        case "grid":
        case "radio-grid":
        case "checkbox-grid":
          if (question.rows && question.columns) {
            const gridData: any = {};
            question.rows.forEach((row: any) => {
              const rId = row.id || row;
              gridData[rId] = question.columns[0].id || question.columns[0];
            });
            sampleResponses[qId] = gridData;
          }
          break;
      }
    });

    setAnswers(sampleResponses);
    showSuccess("Sample data loaded successfully for all questions!");
  };

  // Section navigation functions
  const getMainSections = () => {
    if (!form) return [];
    const baseSections = form.sections.filter((s) => !s.isSubsection);

    const effectiveViewType = form?.viewType || (form as any)?.view_type || "section-wise";

    if (effectiveViewType === "question-wise") {
      const virtualSections: any[] = [];
      baseSections.forEach((section, sIdx) => {
        const visibleQuestions = getOrderedVisibleQuestions(section.questions, answers);
        if (visibleQuestions.length === 0) {
          virtualSections.push({
            ...section,
            questions: [],
            isVirtual: true,
            originalSectionId: section.id,
            originalSectionIndex: sIdx,
            totalOriginalSections: baseSections.length,
            questionIndex: 0,
            totalQuestionsInSection: 0,
          });
        } else {
          visibleQuestions.forEach((q, qIdx) => {
            virtualSections.push({
              ...section,
              id: `${section.id}_v${qIdx}`,
              title: section.title,
              description: qIdx === 0 ? section.description : "",
              questions: [q],
              isVirtual: true,
              originalSectionId: section.id,
              originalSectionIndex: sIdx,
              totalOriginalSections: baseSections.length,
              questionIndex: qIdx,
              totalQuestionsInSection: visibleQuestions.length,
            });
          });
        }
      });
      return virtualSections;
    }

    // Build section hierarchy for section-wise view
    const sectionsMap = new Map<string, any>();
    const rootSections: any[] = [];

    baseSections.forEach((section) => {
      sectionsMap.set(section.id, { ...section, subsections: [] });
    });

    baseSections.forEach((section) => {
      const mappedSection = sectionsMap.get(section.id);
      const parentId = section.parentSectionId;
      const isSub = section.isSubsection === true || section.isSubsection === 'true' || (parentId && parentId !== '');

      if (isSub && parentId) {
        const parent = sectionsMap.get(parentId) || Array.from(sectionsMap.values()).find(s => s._id === parentId);
        if (parent) {
          parent.subsections.push(mappedSection);
        } else {
          rootSections.push(mappedSection);
        }
      } else {
        rootSections.push(mappedSection);
      }
    });

    return rootSections;
  };

  const getLinkedSectionIds = (): Set<string> => {
    const linkedIds = new Set<string>();
    if (!form) return linkedIds;

    branchingRules.forEach((rule) => {
      if (rule.targetSectionId && rule.targetSectionId.toLowerCase() !== "end") {
        linkedIds.add(rule.targetSectionId);
      }
    });

    form.sections.forEach((section) => {
      if (section.nextSectionId && section.nextSectionId.toLowerCase() !== "end") {
        linkedIds.add(section.nextSectionId);
      }
      if (section.isSubsection || (section as any).parentSectionId) {
        linkedIds.add(section.id || (section as any)._id);
      }
    });

    return linkedIds;
  };

  const getNextSequentialIndex = (currentIndex: number): number => {
    if (!form) return -1;
    const mainSections = getMainSections();
    const linkedSectionIds = getLinkedSectionIds();
    let nextIdx = currentIndex + 1;

    while (nextIdx < mainSections.length) {
      const sectionId = mainSections[nextIdx].id;
      if (!linkedSectionIds.has(sectionId)) {
        return nextIdx;
      }
      nextIdx++;
    }
    return -1;
  };

  const getNextSectionIndex = () => {
    if (!form) return currentSectionIndex + 1;

    const mainSections = getMainSections();
    const currentMainSection = mainSections[currentSectionIndex];
    if (!currentMainSection) return currentSectionIndex + 1;

    const effectiveViewType = form?.viewType || (form as any)?.view_type || "section-wise";

    if (effectiveViewType === "question-wise" && currentMainSection.isVirtual) {
      if (currentMainSection.questionIndex < currentMainSection.totalQuestionsInSection - 1) {
        return currentSectionIndex + 1;
      }
    }

    // Get all sections in the current group
    const currentGroupSections = form.sections.filter(
      (s) => s.id === currentMainSection.id || (s.isSubsection && s.parentSectionId === currentMainSection.id),
    );
    const currentGroupSectionIds = currentGroupSections.map((s) => s.id);

    const findMatchingRule = (question: any, userAnswer: any) => {
      if (userAnswer === undefined || userAnswer === null) return null;
      const questionRules = branchingRules.filter((rule) => rule.questionId === question.id);
      if (questionRules.length === 0) return null;

      const matchingRules = questionRules.filter((rule) => currentGroupSectionIds.includes(rule.sectionId));

      for (const rule of matchingRules) {
        const ruleOptionLower = rule.optionLabel?.toLowerCase();
        const userAnswerStr = Array.isArray(userAnswer) ? userAnswer.join(",") : String(userAnswer);
        const userAnswerLower = userAnswerStr.toLowerCase();

        if (rule.isOtherOption) {
          const exactMatchExists = matchingRules.some((r) => !r.isOtherOption && r.optionLabel?.toLowerCase() === userAnswerLower);
          if (!exactMatchExists && userAnswerLower) return rule;
        } else if (Array.isArray(userAnswer)) {
          if (userAnswer.some((val) => String(val).toLowerCase() === ruleOptionLower)) return rule;
        } else if (userAnswerLower === ruleOptionLower) {
          return rule;
        }
      }
      return null;
    };

    // Check branching rules
    for (const section of currentGroupSections) {
      const visibleQuestions = getOrderedVisibleQuestions(section.questions, answers);
      for (const question of visibleQuestions) {
        const matchedRule = findMatchingRule(question, answers[question.id]);
        if (matchedRule) {
          if (matchedRule.targetSectionId?.toLowerCase() === "end") {
            return mainSections.length;
          }
          const targetSection = form.sections.find((s) => s.id === matchedRule.targetSectionId && !s.isSubsection);
          if (targetSection) {
            const targetIndex = mainSections.findIndex((s) => s.id === targetSection.id);
            if (targetIndex !== -1) {
              return targetIndex;
            }
          }
        }
      }
    }

    // Check section-level navigation
    if (currentMainSection.nextSectionId) {
      if (currentMainSection.nextSectionId.toLowerCase() === "end") {
        return mainSections.length;
      }
      const targetSection = form.sections.find((s) => s.id === currentMainSection.nextSectionId && !s.isSubsection);
      if (targetSection) {
        const targetIndex = mainSections.findIndex((s) => s.id === targetSection.id);
        if (targetIndex !== -1) {
          return targetIndex;
        }
      }
    }

    const nextSequential = getNextSequentialIndex(currentSectionIndex);
    if (nextSequential !== -1) {
      return nextSequential;
    }

    return mainSections.length;
  };

  const checkSectionRequiredAnswers = (section: any): boolean => {
    if (!section) return true;

    const visibleQuestions = getOrderedVisibleQuestions(section.questions || [], answers);
    const hasRequiredAnswers = visibleQuestions.every(
      (q) => !q.required || answers[q.id || q._id]
    );
    if (!hasRequiredAnswers) return false;

    if (section.subsections && section.subsections.length > 0) {
      const allSubsectionsValid = section.subsections.every((sub: any) => checkSectionRequiredAnswers(sub));
      if (!allSubsectionsValid) return false;
    }

    return true;
  };

  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !formId) return;

    const mainSections = getMainSections();
    const currentMainSection = mainSections[currentSectionIndex];

    // Track section completion for analytics
    if (onSectionComplete && formSessionId) {
      const timeSpentSeconds = Math.floor((new Date().getTime() - sectionStartTime.getTime()) / 1000);
      let questionCount = currentMainSection.questions?.length || 0;
      if (currentMainSection.subsections) {
        currentMainSection.subsections.forEach((sub: any) => {
          questionCount += sub.questions?.length || 0;
        });
      }
      onSectionComplete(
        currentMainSection.id,
        currentMainSection.title || "Untitled Section",
        timeSpentSeconds,
        questionCount
      );
    }

    setSectionStartTime(new Date());
    if (currentSectionIndex === 0 && formSessionId && chassisNumbers.length > 0) {
  if (!answers['chassis_number']) {
    showNotifyError("Please select a Chassis Number to continue");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
}

    if (!validateSections([currentMainSection])) return;

    setSectionSubmitting(true);
    try {
      const submissionData: any = {
        answers: answers,
        sectionIndex: currentSectionIndex,
        isSectionSubmit: true,
        inviteId: inviteId || null,
        // ✅ ADD THESE LINES
        submittedBy:
          user?.firstName && user?.lastName
            ? `${user.firstName} ${user.lastName}`
            : user?.username || user?.email || undefined,
        submitterContact: {
          email: user?.email || "",
          phone: user?.phone || "",
        },
      };

      if (location) {
        submissionData.location = {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          source: "browser",
          capturedAt: new Date().toISOString(),
        };
      }

      if (!propOnSubmit && formId && formId !== "preview") {
        await apiClient.submitResponse(formId, tenantSlug, submissionData);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const nextSectionIndex = getNextSectionIndex();

      if (nextSectionIndex < mainSections.length) {
        setNavigationHistory((prev) => [...prev, nextSectionIndex]);
        setSectionNavigationHistory((prev) => [...prev, nextSectionIndex]);
        setVisitedSectionIndices((prev) => new Set(prev).add(nextSectionIndex));
        setCurrentSectionIndex(nextSectionIndex);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        handleSubmit(e);
      }
    } catch (err) {
      showNotifyError("Failed to submit section");
      console.error("[handleSectionSubmit] Error:", err);
    } finally {
      setSectionSubmitting(false);
    }
  };

  const handlePrevSection = () => {
    if (parentSectionIndex !== null) {
      setCurrentSectionIndex(parentSectionIndex);
      setParentSectionIndex(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (sectionNavigationHistory.length > 1) {
      const newHistory = [...sectionNavigationHistory];
      newHistory.pop();
      const prevSectionIndex = newHistory[newHistory.length - 1];
      setSectionNavigationHistory(newHistory);
      setNavigationHistory((prev) => {
        const newNavHistory = [...prev];
        newNavHistory.pop();
        return newNavHistory;
      });
      setCurrentSectionIndex(prevSectionIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNextSection = () => {
    const mainSections = getMainSections();
    const nextSectionIndex = getNextSectionIndex();
    if (form && nextSectionIndex < mainSections.length) {
      setNavigationHistory((prev) => [...prev, nextSectionIndex]);
      setSectionNavigationHistory((prev) => [...prev, nextSectionIndex]);
      setVisitedSectionIndices((prev) => new Set(prev).add(nextSectionIndex));
      setCurrentSectionIndex(nextSectionIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const renderAssistantContent = () => {
    if (!suggestedAnswers || suggestedAnswers._no_match) return null;

    if (fetchingSuggestionsForId) {
      return (
        <div className="space-y-6 py-12 px-5 text-center">
          <div className="relative inline-flex">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <RefreshCw className="h-4 w-4 text-emerald-500 animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <p className={`text-[11px] font-black uppercase tracking-widest ${darkMode ? "text-emerald-400" : "text-emerald-600"}`}>
              Searching...
            </p>
            <p className={`text-[9px] font-bold ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
              Checking records
            </p>
          </div>
        </div>
      );
    }

    if (!Array.isArray(suggestedAnswers) || suggestedAnswers.length === 0) {
      return (
        <div className="py-12 px-5 flex flex-col items-center justify-center text-center gap-4 opacity-30">
          <Zap className="h-10 w-10" />
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest">
              Assistant Ready
            </p>
            <p className="text-[9px] font-medium leading-tight">
              Start typing to see<br />smart recommendations
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
          <div className={`p-5 rounded-2xl ${darkMode ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"} border shadow-sm shadow-emerald-500/5 animate-in zoom-in-95 duration-500`}>
            <div className="flex items-center gap-3 mb-3 text-emerald-500">
              <Sparkles className="h-5 w-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Previous Entries
              </span>
            </div>
            <p className={`text-[10px] font-bold leading-relaxed ${darkMode ? "text-emerald-400/80" : "text-emerald-600/80"}`}>
              Found {suggestedAnswers.length} historical records for this chassis.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                Selected Rank:
              </span>
              <div className={`text-[14px] font-black ${darkMode ? "text-emerald-400" : "text-emerald-600"}`}>
                #{selectedRank || 1} Record Applied
              </div>
            </div>

            <div className="space-y-3">
              <span className={`text-[9px] font-black uppercase tracking-widest ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                Switch Record:
              </span>
              <div className="flex flex-wrap gap-2">
                {suggestedAnswers.map((suggestion: any) => (
                  <button
                    key={suggestion.rank}
                    type="button"
                    onClick={() => setSelectedRank(suggestion.rank)}
                    className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-[12px] font-black transition-all hover:scale-105 active:scale-95 ${
                      selectedRank === suggestion.rank
                        ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                        : darkMode
                          ? "bg-slate-900 border-slate-800 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400"
                          : "bg-white border-slate-100 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-600 shadow-sm"
                    }`}
                  >
                    {suggestion.rank}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <span className={`text-[9px] font-black uppercase tracking-widest ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                Record Content:
              </span>
              <div className="space-y-3">
                {(() => {
                  const activeRecord = suggestedAnswers.find((s) => s.rank === (selectedRank || 1));
                  if (!activeRecord) return null;

                  const entries = Object.entries(activeRecord.answers);
                  const uniqueEntries = new Map();
                  const normalizeKey = (s: string) => String(s || "").toLowerCase().replace(/_tracking$/, "").replace(/^_/, "").trim();
                  const activeTargetId = triggeringQuestionId || (lastSuggestionSource?.split(':')[0]);
                  const normalizedActiveTarget = activeTargetId ? normalizeKey(activeTargetId) : null;

                  entries.forEach(([key, val]) => {
                    if (key.startsWith("_") || !val || (typeof val === "string" && val.trim() === "")) return;
                    const baseKey = key.replace("_tracking", "");
                    if (normalizedActiveTarget && normalizeKey(baseKey) !== normalizedActiveTarget) return;
                    const isTracking = key.endsWith("_tracking");
                    if (!uniqueEntries.has(baseKey)) {
                      uniqueEntries.set(baseKey, { main: null, tracking: null });
                    }
                    const entry = uniqueEntries.get(baseKey);
                    if (isTracking) entry.tracking = val;
                    else entry.main = val;
                  });

                  const items = Array.from(uniqueEntries.entries());
                  if (items.length === 0) {
                    return <p className={`text-[10px] italic ${darkMode ? "text-slate-600" : "text-slate-400"}`}>No historical record for this specific question.</p>;
                  }

                  return items.map(([baseKey, data]) => {
                    const question = allFormQuestions.find((q) => (q.id || q._id) === baseKey);
                    const qText = question?.text || baseKey;
                    const formatVal = (v: any) => {
                      if (!v) return null;
                      if (typeof v === "object") {
                        if (v.chassisNumber) {
                          const parts = [];
                          if (v.status) parts.push(`Status: ${v.status}`);
                          if (v.zone?.length) parts.push(`Zones: ${v.zone.join(", ")}`);
                          if (v.defectCategory) parts.push(`Category: ${v.defectCategory}`);
                          if (v.defects?.length) parts.push(`Defects: ${v.defects.map((d: any) => (typeof d === "string" ? d : d.name)).join(", ")}`);
                          return parts.length ? parts.join(" | ") : v.chassisNumber;
                        }
                        return JSON.stringify(v);
                      }
                      return String(v);
                    };

                    const mainDisplay = formatVal(data.main);
                    const trackingDisplay = formatVal(data.tracking);

                    if (!mainDisplay && !trackingDisplay) return null;

                    return (
                      <div key={baseKey} className={`p-4 rounded-xl border ${darkMode ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-100"} space-y-3`}>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-tight text-slate-400 mb-1">{qText}</p>
                          {trackingDisplay && (
                            <p className={`text-[10px] font-bold ${darkMode ? "text-blue-400" : "text-blue-600"} break-words mb-1`}>
                              <span className="opacity-50 text-[8px] mr-1">TRACKING:</span> {trackingDisplay}
                            </p>
                          )}
                          {mainDisplay && (
                            <p className={`text-[10px] font-bold ${darkMode ? "text-emerald-400" : "text-emerald-600"} break-words`}>{mainDisplay}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => applySuggestions(activeRecord.answers, baseKey, activeRecord.rank)}
                          className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/20"
                        >
                          Apply This Answer
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSuggestedAnswers(null);
              setLastSuggestionSource(null);
              setSelectedRank(null);
              setShowMobileAssistant(false);
            }}
            className={`w-full py-4 rounded-xl ${darkMode ? "text-slate-500 hover:text-slate-300 hover:bg-slate-800" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"} text-[10px] font-black uppercase tracking-[0.2em] transition-all`}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  };

  const isLastSection = (() => {
    if (!form) return true;
    const mainSections = getMainSections();
    const currentMainSection = mainSections[currentSectionIndex];
    if (!currentMainSection) return true;

    const allSectionsToCheck = form.sections.filter(
      (s) => s.id === currentMainSection.id || (s.isSubsection && s.parentSectionId === currentMainSection.id),
    );

    for (const section of allSectionsToCheck) {
      const visibleQuestions = getOrderedVisibleQuestions(section.questions, answers);
      for (const q of visibleQuestions) {
        const answer = answers[q.id];
        if (answer !== undefined && answer !== null) {
          const rule = (branchingRules || []).find(
            (r: any) =>
              r.sectionId === section.id &&
              r.questionId === q.id &&
              (Array.isArray(answer)
                ? answer.some((v) => v?.toString().toLowerCase() === r.optionLabel?.toLowerCase())
                : answer.toString().toLowerCase() === r.optionLabel?.toLowerCase()),
          );
          if (rule?.targetSectionId && rule.targetSectionId.toLowerCase() === "end") {
            return true;
          }
        }
      }
    }

    if (currentMainSection.nextSectionId && currentMainSection.nextSectionId.toLowerCase() === "end") {
      return true;
    }

    const nextSequential = getNextSequentialIndex(currentSectionIndex);
    const hasBranchingToSection = allSectionsToCheck.some((section) =>
      section.questions.some((q) =>
        branchingRules.some(
          (rule) =>
            rule.sectionId === section.id &&
            rule.questionId === q.id &&
            rule.targetSectionId &&
            rule.targetSectionId.toLowerCase() !== "end",
        ),
      ),
    );
    const hasDirectLink = currentMainSection.nextSectionId &&
      currentMainSection.nextSectionId.toLowerCase() !== "end" &&
      form.sections.some((s) => s.id === currentMainSection.nextSectionId);

    return nextSequential === -1 && !hasBranchingToSection && !hasDirectLink;
  })();

  // Loading state
  if (loading) {
    return (
      <div
        className={`min-h-screen ${darkMode ? "bg-slate-950 text-slate-400" : "bg-slate-50 text-slate-500"} flex flex-col items-center justify-center gap-3 transition-colors duration-300`}
      >
        <div className="relative">
          <div
            className={`h-12 w-12 rounded-full border-4 ${darkMode ? "border-slate-800" : "border-slate-200"} border-t-blue-500 animate-spin`}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-blue-500" />
          </div>
        </div>
        <p className="text-xs font-medium animate-pulse">Loading form...</p>
      </div>
    );
  }

  // Submitted state
  if (submitted) {
    return (
      <ThankYouMessage
        redirectPath={propOnSubmit ? undefined : `/dashboard`}
        customMessage={form?.description}
      />
    );
  }

  // Error state
  if (error || !form) {
    return (
      <div
        className={`min-h-screen ${darkMode ? "bg-slate-950" : "bg-slate-50"} flex items-center justify-center p-4 transition-colors duration-300`}
      >
        <div
          className={`max-w-sm w-full ${darkMode ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-100"} border rounded-xl p-5 text-center`}
        >
          <div
            className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${darkMode ? "bg-red-500/20 text-red-500" : "bg-red-100 text-red-600"} mb-3`}
          >
            <MapPin className="h-5 w-5" />
          </div>
          <h3
            className={`text-base font-semibold ${darkMode ? "text-white" : "text-slate-900"} mb-1.5`}
          >
            Error
          </h3>
          <p
            className={`text-xs ${darkMode ? "text-red-400/80" : "text-red-500"} mb-5`}
          >
            {error || "Form not found"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-red-500 text-white text-sm rounded-lg font-medium hover:bg-red-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Location confirmation state
  if (!locationConfirmed) {
    return (
      <div
        className={`min-h-screen ${darkMode ? "bg-slate-950 text-slate-200" : "bg-slate-50 text-slate-700"} selection:bg-blue-500/30 text-xs transition-colors duration-300`}
      >
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div
            className={`absolute top-0 left-1/4 w-[400px] h-[400px] ${darkMode ? "bg-blue-600/5" : "bg-blue-600/10"} rounded-full blur-[100px] -translate-y-1/2`}
          />
          <div
            className={`absolute bottom-0 right-1/4 w-[400px] h-[400px] ${darkMode ? "bg-indigo-600/5" : "bg-indigo-600/10"} rounded-full blur-[100px] translate-y-1/2`}
          />
        </div>

        <div className="relative mx-auto max-w-2xl px-6 py-12">
          <div
            className={`mb-6 rounded-xl border ${darkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white shadow-sm"} overflow-hidden backdrop-blur-sm`}
          >
            <div
              className={`border-b ${darkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-100 bg-slate-50/50"} px-6 py-6`}
            >
              <h1
                className={`text-2xl font-black tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}
              >
                {form.title}
              </h1>
              {form.description && (
                <p
                  className={`mt-2 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"} leading-relaxed`}
                >
                  {form.description}
                </p>
              )}
            </div>
          </div>

          <div
            className={`rounded-xl border ${darkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white shadow-sm"} overflow-hidden backdrop-blur-sm`}
          >
            <div
              className={`border-b ${darkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-100 bg-slate-50/50"} px-6 py-4 flex items-center justify-between`}
            >
              <h2
                className={`text-base font-bold ${darkMode ? "text-white" : "text-slate-900"}`}
              >
                Location Verification
              </h2>
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-full transition-all duration-300 ${
                  darkMode
                    ? "bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50"
                    : "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                }`}
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="p-6">
              <p
                className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"} leading-relaxed`}
              >
                Completing this step helps the people understand where answers
                are coming from. We will use the confirmed location details only
                for operational insights.
              </p>

              {location ? (
                <div
                  className={`mt-6 rounded-xl border ${darkMode ? "border-emerald-500/10 bg-emerald-500/5" : "border-emerald-100/50 bg-emerald-50/30"} p-6`}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${darkMode ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"}`}
                    >
                      <MapPin className="h-4 w-4" />
                    </div>
                    <span
                      className={`text-sm font-bold ${darkMode ? "text-emerald-400" : "text-emerald-900"}`}
                    >
                      Location captured successfully
                    </span>
                  </div>
                  <div className="grid gap-5 text-xs sm:grid-cols-3">
                    <div>
                      <p className={`font-bold ${darkMode ? "text-slate-300" : "text-slate-900"}`}>
                        Coordinates
                      </p>
                      <p className={`mt-1 font-mono ${darkMode ? "text-slate-500" : "text-slate-600"}`}>
                        {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                      </p>
                    </div>
                    <div>
                      <p className={`font-bold ${darkMode ? "text-slate-300" : "text-slate-900"}`}>
                        Approximate area
                      </p>
                      <p className={`mt-1 ${darkMode ? "text-slate-500" : "text-slate-600"} line-clamp-2`}>
                        {locationDisplayName || "Loading..."}
                      </p>
                    </div>
                    <div>
                      <p className={`font-bold ${darkMode ? "text-slate-300" : "text-slate-900"}`}>
                        Accuracy
                      </p>
                      <p className={`mt-1 ${darkMode ? "text-slate-500" : "text-slate-600"}`}>
                        ±{Math.round(location.accuracy)}m
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={handleRefreshLocation}
                      className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 ${
                        darkMode
                          ? "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                      }`}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Refresh
                    </button>
                    <button
                      onClick={handleConfirmLocation}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all duration-200 shadow-lg shadow-blue-500/10 active:scale-[0.98]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirm & Continue
                    </button>
                  </div>
                </div>
              ) : locationError ? (
                <div
                  className={`mt-6 rounded-xl border ${darkMode ? "border-red-500/10 bg-red-500/5" : "border-red-100/50 bg-red-50/30"} p-6`}
                >
                  <p className={`text-xs font-bold ${darkMode ? "text-red-400" : "text-red-700"}`}>
                    ⚠️ {locationError}
                  </p>
                  <button
                    onClick={() => locationError.includes("refresh") ? window.location.reload() : handleRefreshLocation()}
                    className={`mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 ${
                      darkMode
                        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : "bg-red-50 text-red-700 hover:bg-red-100"
                    }`}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {locationError.includes("refresh") ? "Refresh Page" : "Try Again"}
                  </button>
                </div>
              ) : (
                <div
                  className={`mt-6 flex items-center gap-3 rounded-lg border ${darkMode ? "border-blue-500/20 bg-blue-500/5" : "border-blue-100 bg-blue-50/50"} px-6 py-4`}
                >
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                  <span className={`text-xs font-bold ${darkMode ? "text-blue-400" : "text-blue-700"}`}>
                    Capturing your location...
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main form view
  const mainSections = getMainSections();
  const currentSection = mainSections[currentSectionIndex];
  const effectiveViewType = form?.viewType || (form as any)?.view_type || "section-wise";

  const subsections = form.sections.filter(
    (s) => s.isSubsection && s.parentSectionId === currentSection?.id,
  );
  const allSectionsToDisplay = currentSection ? [currentSection, ...subsections] : [];

  let progressPercentage = 0;
  let progressLabel = "";

  if (effectiveViewType === "question-wise" && currentSection?.isVirtual) {
    progressPercentage = ((currentSection.originalSectionIndex + 1) / currentSection.totalOriginalSections) * 100;
    progressLabel = `${currentSection.originalSectionIndex + 1} / ${currentSection.totalOriginalSections}`;
  } else {
    progressPercentage = ((currentSectionIndex + 1) / mainSections.length) * 100;
    progressLabel = `${currentSectionIndex + 1} / ${mainSections.length}`;
  }

  return (
    <div
      className={`min-h-screen ${darkMode ? "bg-slate-950 text-slate-200" : "bg-slate-50 text-slate-700"} selection:bg-blue-500/30 text-[11px] transition-colors duration-300`}
    >
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute top-0 left-1/4 w-[400px] h-[400px] ${darkMode ? "bg-blue-600/5" : "bg-blue-600/10"} rounded-full blur-[100px] -translate-y-1/2`}
        />
        <div
          className={`absolute bottom-0 right-1/4 w-[400px] h-[400px] ${darkMode ? "bg-indigo-600/5" : "bg-indigo-600/10"} rounded-full blur-[100px] translate-y-1/2`}
        />
      </div>

      {/* Header Section */}
      <div
        className={`sticky top-0 z-40 border-b ${darkMode ? "border-slate-800 bg-slate-950/80" : "border-slate-200 bg-white/80"} backdrop-blur-xl transition-colors duration-300`}
      >
        <div className="mx-auto max-w-[90%] px-4 py-3">
          <div className="flex items-center justify-between gap-6">
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1
                  className={`text-base font-black tracking-tight ${darkMode ? "text-white" : "text-slate-900"} truncate`}
                >
                  {form.title}
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap animate-pulse">
                  Preview Mode
                </span>
              </div>
              {form.description && (
                <p
                  className={`text-[10px] font-medium leading-relaxed ${darkMode ? "text-slate-500" : "text-slate-400"}`}
                >
                  {form.description}
                </p>
              )}
            </div>

            {form.sections && (
              <div className="flex items-center gap-4 flex-1 max-w-md">
                <div
                  className={`flex-1 h-1 overflow-hidden rounded-full ${darkMode ? "bg-slate-800" : "bg-slate-200"}`}
                >
                  <div
                    className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-all duration-700 ease-out"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className={`text-[10px] font-black ${darkMode ? "text-blue-400" : "text-blue-600"}`}>
                    {Math.round(progressPercentage)}%
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                    {progressLabel}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              {suggestedAnswers && !suggestedAnswers._no_match && (
                <button
                  type="button"
                  onClick={() => {
                    setSuggestedAnswers(null);
                    setLastSuggestionSource(null);
                    setSelectedRank(null);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                    darkMode
                      ? "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"
                      : "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Clear Suggestions
                </button>
              )}

              <button
                onClick={handleLoadSampleData}
                className={`p-1.5 rounded-full transition-all duration-300 ${
                  darkMode
                    ? "bg-blue-500/10 text-blue-400 hover:text-white hover:bg-blue-500/20"
                    : "bg-blue-50 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                }`}
                title="Load Sample Data"
              >
                <Database className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={toggleDarkMode}
                className={`p-1.5 rounded-full transition-all duration-300 ${
                  darkMode
                    ? "bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50"
                    : "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                }`}
              >
                {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative py-8">
        <div className="mx-auto max-w-[98%] px-4">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Form Column */}
            <div className="flex-1 w-full min-w-0 space-y-4 max-w-5xl mx-auto">
              {/* Chassis Number Selection (If enabled and at first section) */}
              {formSessionId && chassisNumbers.length > 0 && currentSectionIndex === 0 && (
                <div className={`p-8 rounded-2xl border-2 ${darkMode ? "bg-purple-500/5 border-purple-500/20" : "bg-purple-50 border-purple-100"} shadow-sm relative overflow-hidden group`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 font-bold">
                    <Clipboard className={`w-16 h-16 ${darkMode ? "text-purple-400" : "text-purple-600"}`} />
                    </div>
                  <h2 className={`text-xl font-bold ${darkMode ? "text-purple-300" : "text-purple-900"} mb-6 flex items-center gap-2`}>
                    <div className={`p-2 rounded-lg ${darkMode ? "bg-purple-800/30" : "bg-purple-100"}`}>
                      <Users className={`w-5 h-5 ${darkMode ? "text-purple-400" : "text-purple-600"}`} />
                      </div>
                      Select Chassis Number *
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {chassisNumbers.map((cn: { chassisNumber: string; partDescription: string }) => {
                          const chassisAssignments = chassisTenantAssignments;
                      const isVisibleToTenant = !user?.tenantId ||
                            !chassisAssignments[cn.chassisNumber] ||
                            chassisAssignments[cn.chassisNumber].length === 0 ||
                        chassisAssignments[cn.chassisNumber].includes(user.tenantId);

                          if (!isVisibleToTenant) return null;

                      const displayValue = cn.partDescription ? `${cn.chassisNumber}-${cn.partDescription}` : cn.chassisNumber;

                          return (
                            <button
                              key={cn.chassisNumber}
                              type="button"
                          onClick={() => handleResponseChange('chassis_number', cn.chassisNumber)}
                              className={`p-4 rounded-xl text-left border-2 transition-all duration-200 group relative overflow-hidden ${
                            answers['chassis_number'] === cn.chassisNumber
                                  ? `border-purple-600 ${darkMode ? "bg-gray-800" : "bg-white"} shadow-lg ring-4 ring-purple-100 dark:ring-purple-900/30 scale-[1.02]`
                                  : `border-white dark:border-gray-700 ${darkMode ? "bg-gray-800/60" : "bg-white/60"} hover:border-purple-300 dark:hover:border-purple-500 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md`
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                              <span className={`font-bold ${answers['chassis_number'] === cn.chassisNumber ? "text-purple-700 dark:text-purple-300" : "text-gray-600 dark:text-gray-400"}`}>
                                    {cn.chassisNumber}
                                  </span>
                                  {cn.partDescription && (
                                <span className={`text-xs ${answers['chassis_number'] === cn.chassisNumber ? "text-purple-500 dark:text-purple-400" : "text-gray-500 dark:text-gray-400"}`}>
                                      {cn.partDescription}
                                    </span>
                                  )}
                                </div>
                            {answers['chassis_number'] === cn.chassisNumber && (
                                  <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                                    <Send className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </div>
                          <div className={`mt-1 text-[10px] uppercase tracking-wider font-bold ${answers['chassis_number'] === cn.chassisNumber ? "text-purple-400 dark:text-purple-500" : "text-gray-400"}`}>
                            {answers['chassis_number'] === cn.chassisNumber ? 'Selected Chassis' : 'Available'}
                              </div>
                            </button>
                          );
                    })}
                    </div>
                  </div>
                )}

              <form id="customer-form" onSubmit={handleSubmit} className="space-y-0">
                <div className="space-y-4">
                  <div
                    className={`rounded-xl border ${darkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white shadow-sm shadow-slate-200/50"} overflow-hidden backdrop-blur-sm`}
                  >
                    <div
                      className={`border-b ${darkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-100 bg-slate-50/50"} px-6 py-6`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className={`inline-flex items-center gap-2.5 ${(currentSection.title || (currentSection.description && currentSection.description !== form.description)) ? 'mb-3' : ''}`}>
                            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-[11px] shadow-lg shadow-blue-500/20">
                              {currentSectionIndex + 1}
                            </div>
                            <div className="flex flex-col">
                              <span className={`text-[8px] font-black uppercase tracking-[0.25em] ${darkMode ? "text-slate-600" : "text-slate-400"}`}>
                                {effectiveViewType === "question-wise" && currentSection.isVirtual
                                  ? `Section ${currentSection.originalSectionIndex + 1}`
                                  : "Current Phase"}
                              </span>
                              <span className={`text-[10px] font-bold ${darkMode ? "text-blue-400" : "text-blue-600"}`}>
                                {effectiveViewType === "question-wise" && currentSection.isVirtual ? (
                                  <>Question {currentSection.questionIndex + 1} of {currentSection.totalQuestionsInSection}</>
                                ) : (
                                  <>0{currentSectionIndex + 1} of 0{mainSections.length}</>
                                )}
                              </span>
                            </div>
                          </div>
                          {currentSection.title && currentSection.title !== form.title && (
                            <h2 className={`text-lg font-black tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}>
                                {currentSection.title || currentSection.name}
                              </h2>
                            )}
                          {currentSection.description && currentSection.description !== form.description && (
                            <p className={`mt-1 text-xs ${darkMode ? "text-slate-500" : "text-slate-500"}`}>
                                {currentSection.description}
                              </p>
                            )}
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-8 space-y-6">
                      {allSectionsToDisplay.map((section) => (
                        <div key={section.id}>
                          {section.isSubsection && (
                            <div className={`mb-4 pb-2 border-b ${darkMode ? "border-emerald-500/10" : "border-emerald-100/50"}`}>
                              <h3 className={`text-sm font-bold ${darkMode ? "text-emerald-400" : "text-emerald-700"}`}>
                                {section.title}
                              </h3>
                              {section.description && (
                                <p className={`text-[11px] ${darkMode ? "text-emerald-500/60" : "text-emerald-600/80"}`}>
                                  {section.description}
                                </p>
                              )}
                            </div>
                          )}
                          <SectionContent
                            section={section}
                            formTitle={form.title}
                            answers={answers}
                            onAnswerChange={handleResponseChange}
                            validationErrors={validationErrors}
                            formId={formId}
                            tenantSlug={tenantSlug}
                            suggestedAnswers={suggestedAnswers}
                            lastSuggestionSource={lastSuggestionSource}
                            onApplyFullSuggestion={applySuggestions}
                            fetchingSuggestionsForId={fetchingSuggestionsForId}
                            rankMatchedAnswers={globalRankAnswers}
                            currentRank={globalRank}
                            onPreviousAnswersChange={setPreviousAnswers}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Assistant Sidebar */}
            {activeTrackQuestion && suggestedAnswers && !suggestedAnswers._no_match && (
              <div className="hidden lg:block w-[380px] sticky top-24 animate-in fade-in slide-in-from-right-4 duration-500 z-20">
                <div className={`rounded-2xl border ${darkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white shadow-xl shadow-slate-200/50"} overflow-hidden backdrop-blur-sm`}>
                  <div className={`border-b ${darkMode ? "border-slate-800 bg-slate-900/60" : "border-slate-50 bg-slate-50/80"} px-6 py-4`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${darkMode ? "bg-blue-500/20" : "bg-blue-50"}`}>
                        <Sparkles className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Assistant</span>
                        <h3 className={`text-sm font-black ${darkMode ? "text-white" : "text-slate-900"}`}>Found Records!</h3>
                      </div>
                    </div>
                  </div>
                  {renderAssistantContent()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Navigation */}
      <div
        className={`sticky bottom-0 z-40 border-t ${darkMode ? "border-slate-800 bg-slate-950/90" : "border-slate-200 bg-white/90"} backdrop-blur-xl transition-colors duration-300`}
      >
        <div className="mx-auto max-w-[90%] px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate("/forms/analytics")}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
                  darkMode
                    ? "bg-slate-800/50 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                Back to Portal
              </button>

              {/* Location Status Badge */}
              <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />

              <div className="flex items-center gap-2">
                {location ? (
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${darkMode ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border-emerald-100 text-emerald-700"}`}
                  >
                    <MapPin className="h-3 w-3" />
                    <span className="text-[9px] font-black uppercase tracking-tight truncate max-w-[100px] sm:max-w-[150px]">
                      {locationDisplayName ||
                        `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                    </span>
                  </div>
                ) : locationError ? (
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${darkMode ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-100 text-red-700"}`}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    <span className="text-[9px] font-black uppercase tracking-tight">
                      Location Disabled
                    </span>
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${darkMode ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-700"}`}
                  >
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-[9px] font-black uppercase tracking-tight">
                      Capturing...
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {currentSectionIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrevSection}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[9.5px] font-bold uppercase tracking-wider transition-all duration-200 ${
                    darkMode
                      ? "bg-slate-800/50 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  <ChevronUp className="h-3 w-3" />
                  <span>Previous</span>
                </button>
              )}

              {!isLastSection ? (
                <button
                  type="button"
                  onClick={handleSectionSubmit}
                  disabled={sectionSubmitting}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-[9.5px] font-bold uppercase tracking-wider text-white hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 transition-all duration-200 shadow-lg shadow-blue-500/20"
                >
                  {sectionSubmitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Next Section</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="submit"
                  form="customer-form"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-[9.5px] font-bold uppercase tracking-wider text-white hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 transition-all duration-200 shadow-lg shadow-emerald-500/20"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Submit Response</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Mobile Assistant Toggle */}
      {activeTrackQuestion && suggestedAnswers && !suggestedAnswers._no_match && (
        <button
          onClick={() => setShowMobileAssistant(true)}
          className="lg:hidden fixed bottom-24 right-6 z-50 p-4 rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-500/40 animate-bounce transition-transform active:scale-95"
        >
          <Sparkles className="h-6 w-6" />
          {suggestedAnswers && Array.isArray(suggestedAnswers) && suggestedAnswers.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold ring-2 ring-white">
              {suggestedAnswers.length}
            </span>
          )}
        </button>
      )}

      {/* Mobile Assistant Modal */}
      {showMobileAssistant && (
        <div className="lg:hidden fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShowMobileAssistant(false)}
          />
          <div className={`relative w-full sm:max-w-lg max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-3xl border-t sm:border border-slate-200 dark:border-slate-800 ${darkMode ? "bg-slate-900 shadow-2xl shadow-black" : "bg-white shadow-2xl"} animate-in slide-in-from-bottom-full duration-500 flex flex-col`}>
            {/* Modal Header */}
            <div className={`p-4 border-b flex items-center justify-between sticky top-0 z-10 ${darkMode ? "bg-slate-900/95 border-slate-800" : "bg-white/95 border-slate-100"} backdrop-blur-md`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${darkMode ? "bg-blue-500/20" : "bg-blue-50"}`}>
                  <Sparkles className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Assistant</span>
                  <h3 className={`text-sm font-black ${darkMode ? "text-white" : "text-slate-900"}`}>Historical Records</h3>
                </div>
              </div>
              <button 
                onClick={() => setShowMobileAssistant(false)}
                className={`p-2 rounded-xl transition-colors ${darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {renderAssistantContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
