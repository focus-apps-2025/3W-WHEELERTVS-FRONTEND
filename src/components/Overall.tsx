import React, { useState, useEffect, useMemo } from "react";
import html2pdf from "html2pdf.js";
import {
  BarChart2,
  FileText,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Activity,
  Award,
  Target,
  Zap,
  Calendar,
  RefreshCw,
  Download,
  AlertTriangle,
  PieChart,
  BarChart3,
  ChevronDown,
  MapPin,
  List,
  Mail,
  MessageCircle,
  MessageSquare,
  User,
  Eye,
  Edit2,
  Trash2,
} from "lucide-react";
import { Bar, Line, Doughnut, Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  RadialLinearScale,
} from "chart.js";
import { apiClient } from "../api/client";
import { formatTimestamp } from "../utils/dateUtils";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  RadialLinearScale,
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Form {
  _id: string;
  id?: string;
  title: string;
  sections?: any[];
}

interface LocationData {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
}

interface SubmissionMetadata {
  location?: LocationData;
  source?: string;
  ipAddress?: string;
}

interface ResponseStats {
  yes: number;
  no: number;
  na: number;
  accepted: number;
  rejected: number;
  rework: number;
}

interface Response {
  _id: string;
  id: string;
  questionId: string;
  formId?: string;
  parentResponseId?: string;
  answers: Record<string, any>;
  responseRanks?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  status?: string;
  yesNoScore?: { yes: number; total: number };
  stats?: ResponseStats;
  submissionMetadata?: SubmissionMetadata;
  dealerName?: string;
  dealerRank?: number;
  formTitle: string;
  firstQuestionText?: string;
  firstAnswerValue?: string;
}

interface GroupedByFormAndDate {
  [formTitle: string]: {
    [date: string]: Response[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractYesNoValues(value: any): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") {
    const n = value.trim().toLowerCase();
    return n ? [n] : [];
  }
  if (typeof value === "boolean") return [value ? "yes" : "no"];
  if (Array.isArray(value)) return value.flatMap(extractYesNoValues);
  if (typeof value === "object")
    return Object.values(value).flatMap(extractYesNoValues);
  return [];
}

function computeResponseStats(answers: Record<string, any>): ResponseStats {
  let yes = 0,
    no = 0,
    na = 0,
    accepted = 0,
    rejected = 0,
    rework = 0;
  const values = extractYesNoValues(answers);
  values.forEach((val) => {
    if (val === "yes") yes++;
    else if (val === "no") no++;
    else if (val === "na" || val === "n/a" || val === "n.a" || val === "n.a.")
      na++;
    else if (val === "accepted" || val === "accept") accepted++;
    else if (val === "rejected" || val === "reject") rejected++;
    else if (val === "rework") rework++;
  });
  return { yes, no, na, accepted, rejected, rework };
}

function collectYesNoQuestionIds(form: Form): string[] {
  const ids = new Set<string>();
  const processQuestion = (q: any) => {
    if (!q) return;
    if (q.type === "yesNoNA" && q.id) ids.add(q.id);
    q.followUpQuestions?.forEach(processQuestion);
  };
  form.sections?.forEach((s) => s.questions?.forEach(processQuestion));
  return Array.from(ids);
}

function computeYesNoScore(answers: Record<string, any>, form: Form) {
  const ids = collectYesNoQuestionIds(form);
  if (!ids.length) return undefined;
  let yes = 0;
  ids.forEach((id) => {
    if (extractYesNoValues(answers?.[id]).includes("yes")) yes++;
  });
  return { yes, total: ids.length };
}

function hasAnswerValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function renderAnswerDisplay(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value))
    return value.map(renderAnswerDisplay).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const s = value.value || value.text || value.label || "";
    return s ? String(s) : "";
  }
  return String(value);
}

function getComplianceColumns(form: Form | undefined, responses: Response[]) {
  if (!form || !form.sections) {
    return { useInspectionLabels: false, columns: ["yes", "no", "na"] };
  }
  let hasInspectionQuestions = false;

  const checkFormTitle = form.title?.toLowerCase() || "";
  if (
    checkFormTitle.includes("inspection") ||
    checkFormTitle.includes("chassis") ||
    checkFormTitle.includes("pdi") ||
    checkFormTitle.includes("rework") ||
    checkFormTitle.includes("accepted") ||
    checkFormTitle.includes("rejected") ||
    checkFormTitle.includes("verified") ||
    checkFormTitle.includes("audit") ||
    checkFormTitle.includes("workshop") ||
    checkFormTitle.includes("process audit")
  ) {
    hasInspectionQuestions = true;
  }

  if (!hasInspectionQuestions) {
    for (const section of form.sections) {
      const sectionTitle = section.title?.toLowerCase() || "";
      if (
        sectionTitle.includes("inspection") ||
        sectionTitle.includes("chassis") ||
        sectionTitle.includes("rework") ||
        sectionTitle.includes("accepted") ||
        sectionTitle.includes("rejected") ||
        sectionTitle.includes("verified") ||
        sectionTitle.includes("audit")
      ) {
        hasInspectionQuestions = true;
        break;
      }
      for (const q of section.questions || []) {
        const qType = (q.type || "").toLowerCase();
        const qText = (q.text || "").toLowerCase();
        if (
          qType.includes("chassis") ||
          qType.includes("zone") ||
          qType.includes("inspection") ||
          qText.includes("inspection") ||
          qText.includes("accepted") ||
          qText.includes("rejected") ||
          qText.includes("rework") ||
          (q.options &&
            q.options.some(
              (opt) =>
                String(opt).toLowerCase().includes("accepted") ||
                String(opt).toLowerCase().includes("rejected") ||
                String(opt).toLowerCase().includes("rework"),
            ))
        ) {
          hasInspectionQuestions = true;
          break;
        }
      }
      if (hasInspectionQuestions) break;
    }
  }

  if (hasInspectionQuestions) {
    let hasAcceptedRejectedRework = false;
    for (const r of responses) {
      const answers = r.answers || {};
      Object.values(answers).forEach((val) => {
        const vals = extractYesNoValues(val);
        if (vals.some((v) => ["accepted", "rejected", "rework"].includes(v))) {
          hasAcceptedRejectedRework = true;
        }
      });
      if (hasAcceptedRejectedRework) break;
    }
    if (hasAcceptedRejectedRework) {
      return {
        useInspectionLabels: true,
        columns: ["accepted", "rejected", "rework"],
      };
    }
  }

  return { useInspectionLabels: false, columns: ["yes", "no", "na"] };
}

function getComplianceLabel(
  columnType: string,
  useInspectionLabels: boolean,
): string {
  if (useInspectionLabels) {
    switch (columnType) {
      case "accepted":
        return "Accepted";
      case "rejected":
        return "Rejected";
      case "rework":
        return "Rework";
      default:
        return columnType;
    }
  }
  switch (columnType) {
    case "yes":
      return "Yes";
    case "no":
      return "No";
    case "na":
      return "N/A";
    default:
      return columnType;
  }
}

function getComplianceColor(columnType: string): string {
  switch (columnType) {
    case "yes":
      return "text-green-700 dark:text-green-400";
    case "no":
      return "text-red-700 dark:text-red-400";
    case "na":
      return "text-slate-600 dark:text-slate-400";
    case "accepted":
      return "text-emerald-700 dark:text-emerald-400";
    case "rejected":
      return "text-red-700 dark:text-red-400";
    case "rework":
      return "text-amber-700 dark:text-amber-400";
    default:
      return "text-gray-700 dark:text-gray-300";
  }
}

function getComplianceCount(stats: ResponseStats, columnType: string): number {
  switch (columnType) {
    case "yes":
      return stats.yes;
    case "no":
      return stats.no;
    case "na":
      return stats.na;
    case "accepted":
      return stats.accepted;
    case "rejected":
      return stats.rejected;
    case "rework":
      return stats.rework;
    default:
      return 0;
  }
}

function getRankStyle(answer: any): string {
  const str =
    typeof answer === "object"
      ? JSON.stringify(answer)
      : String(answer).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = [
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-emerald-50 text-emerald-700 border-emerald-200",
    "bg-amber-50 text-amber-700 border-amber-200",
    "bg-orange-50 text-orange-700 border-orange-200",
    "bg-rose-50 text-rose-700 border-rose-200",
    "bg-purple-50 text-purple-700 border-purple-200",
    "bg-teal-50 text-teal-700 border-teal-200",
  ];
  return colors[Math.abs(hash) % colors.length];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Overall() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [showFormFilter, setShowFormFilter] = useState(false);
  const [expandScore, setExpandScore] = useState(false);
  const [expandRate, setExpandRate] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "requests">("summary");
  const [expandedForms, setExpandedForms] = useState<string[]>([]);
  const [showSectionSelector, setShowSectionSelector] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  const toggleForm = (formTitle: string) => {
    setExpandedForms((prev) =>
      prev.includes(formTitle)
        ? prev.filter((t) => t !== formTitle)
        : [...prev, formTitle],
    );
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const element = document.getElementById("pdf-content-container");
      if (!element) return;

      const noPdfEls = element.querySelectorAll(".no-pdf");
      const originalDisplays: string[] = [];
      noPdfEls.forEach((el: any) => {
        originalDisplays.push(el.style.display);
        el.style.display = "none";
      });

      const opt = {
        margin: 0.3,
        filename: `Overall_Analytics_${new Date().toISOString().split("T")[0]}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, windowWidth: 1200 },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(element).save();

      noPdfEls.forEach((el: any, index) => {
        el.style.display = originalDisplays[index];
      });
    } catch (err) {
      console.error("PDF generation failed", err);
    } finally {
      setIsDownloading(false);
    }
  };

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [responsesData, formsData] = await Promise.all([
        apiClient.getResponses(),
        apiClient.getForms(),
      ]);

      const formsMap = formsData.forms.reduce(
        (map: Record<string, Form>, form: any) => {
          if (form?._id) map[form._id] = form;
          if (form?.id) map[form.id] = form;
          return map;
        },
        {},
      );

      const dealerQuestionMap = new Map<string, string>();
      Object.values(formsMap).forEach((form: any) => {
        const fid = form._id || form.id;
        if (!fid) return;
        if (form.sections?.length > 0) {
          const first = form.sections[0];
          if (first.questions?.length > 0) {
            for (const q of first.questions) {
              const txt = (q.text || q.label || "").toLowerCase();
              if (
                txt.includes("dealer") ||
                txt.includes("distributor") ||
                txt.includes("store") ||
                txt.includes("business")
              ) {
                dealerQuestionMap.set(fid, q.id);
                break;
              }
            }
          }
        }
      });

      const extractDealer = (response: any, form: Form | undefined) => {
        if (!form || !response.answers) return { name: null, rank: null };
        const fid = form._id || form.id;
        if (!fid) return { name: null, rank: null };
        const dqid = dealerQuestionMap.get(fid);
        if (dqid) {
          const ans = response.answers[dqid];
          if (ans && hasAnswerValue(ans)) {
            return {
              name: renderAnswerDisplay(ans),
              rank: response.responseRanks?.[dqid] || null,
            };
          }
        }
        if (form.sections?.length > 0) {
          const first = form.sections[0];
          if (first.questions?.length > 0) {
            for (const q of first.questions) {
              const ans = response.answers[q.id];
              if (ans && hasAnswerValue(ans)) {
                return {
                  name: renderAnswerDisplay(ans),
                  rank: response.responseRanks?.[q.id] || null,
                };
              }
            }
          }
        }
        return { name: null, rank: null };
      };

      const withTitles = responsesData.responses.map((r: any) => {
        const form = formsMap[r.questionId];
        const dealer = extractDealer(r, form);

        let firstQ = "Unknown Question";
        let firstA = "N/A";
        if (form && form.sections?.length > 0) {
          for (const section of form.sections) {
            if (section.questions?.length > 0) {
              const q = section.questions[0];
              firstQ = q.text || q.label || q.id || "Unknown Question";
              firstA = renderAnswerDisplay(r.answers?.[q.id]) || "N/A";
              break;
            }
          }
        } else if (r.answers && Object.keys(r.answers).length > 0) {
          const firstKey = Object.keys(r.answers)[0];
          firstQ = firstKey;
          firstA = renderAnswerDisplay(r.answers[firstKey]) || "N/A";
        }

        return {
          ...r,
          formTitle: form?.title || "Unknown Form",
          yesNoScore: form ? computeYesNoScore(r.answers, form) : undefined,
          stats: computeResponseStats(r.answers),
          dealerName: dealer.name || "Unknown",
          dealerRank: dealer.rank,
          firstQuestionText: firstQ,
          firstAnswerValue: firstA,
        };
      });

      setResponses(withTitles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load responses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const uniqueForms = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    responses.forEach((r) => {
      const key = r.questionId || r.formId || "";
      if (key && !map.has(key)) map.set(key, { id: key, title: r.formTitle });
    });
    return Array.from(map.values()).sort((a, b) =>
      a.title.localeCompare(b.title),
    );
  }, [responses]);

  const filteredResponses = useMemo(() => {
    return responses.filter((r) => {
      const matchSearch =
        r.formTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (typeof r.dealerName === "string" &&
          r.dealerName.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchForm =
        selectedFormIds.length === 0 ||
        selectedFormIds.includes(r.questionId || r.formId || "");
      return matchSearch && matchForm;
    });
  }, [responses, searchQuery, selectedFormIds]);

  const groupedResponses: GroupedByFormAndDate = useMemo(() => {
    return filteredResponses.reduce((groups, r) => {
      const formTitle = r.formTitle || "Unknown Form";
      if (!groups[formTitle]) groups[formTitle] = {};
      const date = new Date(r.createdAt).toDateString();
      if (!groups[formTitle][date]) groups[formTitle][date] = [];
      groups[formTitle][date].push(r);
      return groups;
    }, {} as GroupedByFormAndDate);
  }, [filteredResponses]);

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const totalResponses = responses.length;
  const totalYes = responses.reduce((s, r) => s + (r.yesNoScore?.yes || 0), 0);
  const totalQuestions = responses.reduce(
    (s, r) => s + (r.yesNoScore?.total || 0),
    0,
  );
  const totalNo = totalQuestions - totalYes;
  const overallScore =
    totalQuestions > 0 ? ((totalYes / totalQuestions) * 100).toFixed(1) : "0.0";
  const yesPercent =
    totalQuestions > 0 ? ((totalYes / totalQuestions) * 100).toFixed(1) : "0.0";
  const noPercent =
    totalQuestions > 0 ? ((totalNo / totalQuestions) * 100).toFixed(1) : "0.0";

  // Form-level aggregation
  const formStats = useMemo(() => {
    const map = new Map<
      string,
      { title: string; count: number; yes: number; total: number }
    >();
    responses.forEach((r) => {
      const key = r.questionId || r.formId || "";
      if (!key) return;
      if (!map.has(key))
        map.set(key, { title: r.formTitle, count: 0, yes: 0, total: 0 });
      const s = map.get(key)!;
      s.count++;
      s.yes += r.yesNoScore?.yes || 0;
      s.total += r.yesNoScore?.total || 0;
    });
    return Array.from(map.values());
  }, [responses]);

  // Section-level stats aggregated from all responses
  const sectionStats = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        title: string;
        yes: number;
        no: number;
        na: number;
        accepted: number;
        rejected: number;
        rework: number;
        total: number;
      }
    >();
    responses.forEach((r) => {
      if (!r.stats) return;
      const key = r.questionId || r.formId || "";
      const title = r.formTitle;
      if (!key) return;
      if (!map.has(key))
        map.set(key, {
          id: key,
          title,
          yes: 0,
          no: 0,
          na: 0,
          accepted: 0,
          rejected: 0,
          rework: 0,
          total: 0,
        });
      const s = map.get(key)!;
      s.yes += r.stats.yes;
      s.no += r.stats.no;
      s.na += r.stats.na;
      s.accepted += r.stats.accepted;
      s.rejected += r.stats.rejected;
      s.rework += r.stats.rework;
      s.total +=
        r.stats.yes +
        r.stats.no +
        r.stats.na +
        r.stats.accepted +
        r.stats.rejected +
        r.stats.rework;
    });
    return Array.from(map.values());
  }, [responses]);

  const visibleSectionStats = useMemo(() => {
    if (selectedSectionIds.length === 0) return sectionStats;
    return sectionStats.filter((s) => selectedSectionIds.includes(s.id));
  }, [sectionStats, selectedSectionIds]);

  const sectionSummaryRows = useMemo(
    () =>
      visibleSectionStats.map((s) => ({
        ...s,
        yesPercent: s.total > 0 ? ((s.yes + s.accepted) / s.total) * 100 : 0,
        noPercent: s.total > 0 ? ((s.no + s.rejected) / s.total) * 100 : 0,
        naPercent: s.total > 0 ? ((s.na + s.rework) / s.total) * 100 : 0,
        yesCount: s.yes + s.accepted,
        noCount: s.no + s.rejected,
        naCount: s.na + s.rework,
      })),
    [visibleSectionStats],
  );

  const summaryTotals = useMemo(
    () =>
      sectionSummaryRows.reduce(
        (acc, r) => ({
          total: acc.total + r.total,
          yesCount: acc.yesCount + r.yesCount,
          noCount: acc.noCount + r.noCount,
          naCount: acc.naCount + r.naCount,
        }),
        { total: 0, yesCount: 0, noCount: 0, naCount: 0 },
      ),
    [sectionSummaryRows],
  );

  const generateTableBarChart = (
    yesPct: number,
    noPct: number,
    naPct: number,
  ) => {
    const y = Math.round(yesPct),
      n = Math.round(noPct),
      na = Math.round(naPct);
    return (
      <div className="flex h-4 w-32 rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
        {y > 0 && (
          <div
            className="bg-green-500"
            style={{ width: `${y}%` }}
            title={`Yes ${y}%`}
          />
        )}
        {n > 0 && (
          <div
            className="bg-red-500"
            style={{ width: `${n}%` }}
            title={`No ${n}%`}
          />
        )}
        {na > 0 && (
          <div
            className="bg-gray-400"
            style={{ width: `${na}%` }}
            title={`N/A ${na}%`}
          />
        )}
      </div>
    );
  };

  // Daily trend (last 7 days)
  const dailyTrend = useMemo(() => {
    const days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const dateStr = d.toDateString();
      const count = responses.filter(
        (r) => new Date(r.createdAt).toDateString() === dateStr,
      ).length;
      days.push({ date: label, count });
    }
    return days;
  }, [responses]);

  // ─── Chart Data ────────────────────────────────────────────────────────────

  const lineData = {
    labels: dailyTrend.map((d) => d.date),
    datasets: [
      {
        label: "Responses",
        data: dailyTrend.map((d) => d.count),
        borderColor: "#1d4ed8",
        backgroundColor: "rgba(29,78,216,0.12)",
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: "#1d4ed8",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#374151" }, grid: { color: "#e5e7eb" } },
      y: {
        ticks: { color: "#374151" },
        grid: { color: "#e5e7eb" },
        beginAtZero: true,
      },
    },
  };

  const radarData = {
    labels: visibleSectionStats.map((s) =>
      s.title.length > 14 ? s.title.slice(0, 14) + "…" : s.title,
    ),
    datasets: [
      {
        label: "Yes %",
        data: visibleSectionStats.map((s) =>
          s.total > 0 ? ((s.yes + s.accepted) / s.total) * 100 : 0,
        ),
        backgroundColor: "rgba(34,197,94,0.2)",
        borderColor: "rgba(34,197,94,1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(34,197,94,1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgba(34,197,94,1)",
      },
      {
        label: "No %",
        data: visibleSectionStats.map((s) =>
          s.total > 0 ? ((s.no + s.rejected) / s.total) * 100 : 0,
        ),
        backgroundColor: "rgba(239,68,68,0.2)",
        borderColor: "rgba(239,68,68,1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(239,68,68,1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgba(239,68,68,1)",
      },
      {
        label: "N/A %",
        data: visibleSectionStats.map((s) =>
          s.total > 0 ? ((s.na + s.rework) / s.total) * 100 : 0,
        ),
        backgroundColor: "rgba(156,163,175,0.2)",
        borderColor: "rgba(156,163,175,1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(156,163,175,1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgba(156,163,175,1)",
      },
    ],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        suggestedMin: 0,
        suggestedMax: 100,
        angleLines: {
          display: true,
          color: "rgba(59,130,246,0.3)",
          lineWidth: 1.5,
        },
        grid: { color: "rgba(59,130,246,0.2)", lineWidth: 1.5 },
        pointLabels: { font: { size: 10 }, color: "#374151" },
        ticks: {
          backdropColor: "transparent",
          color: "#6b7280",
          font: { size: 11 },
        },
      },
    },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { font: { size: 10 }, padding: 12, color: "#374151" },
      },
      tooltip: {
        callbacks: {
          label: (c: any) => `${c.dataset.label}: ${c.raw.toFixed(1)}%`,
        },
      },
    },
  };

  const donutData = {
    labels: [
      "Yes / Accepted",
      "No / Rejected",
      ...(summaryTotals.naCount > 0 ? ["N/A / Rework"] : []),
    ],
    datasets: [
      {
        data: [
          summaryTotals.yesCount,
          summaryTotals.noCount,
          ...(summaryTotals.naCount > 0 ? [summaryTotals.naCount] : []),
        ],
        backgroundColor: [
          "#22c55e",
          "#ef4444",
          ...(summaryTotals.naCount > 0 ? ["#9ca3af"] : []),
        ],
        borderWidth: 0,
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: {
        position: "right" as const,
        labels: { font: { size: 12 }, color: "#374151", padding: 20 },
      },
      tooltip: {
        callbacks: {
          label: (c: any) => {
            const val = c.raw;
            const total = summaryTotals.total;
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return ` ${c.label}: ${val} (${pct}%)`;
          },
        },
      },
    },
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-red-600 mb-2">Error loading data</div>
        <div className="text-gray-500">{error}</div>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100/50 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6 md:p-8">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="mb-6 sm:mb-8 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-900/10 dark:to-indigo-900/10 p-4 sm:p-5 rounded-2xl border border-blue-100 dark:border-blue-800/20 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl shadow-inner flex-shrink-0">
              <BarChart2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                Overall Statistics
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium mt-0.5">
                Customer request data summary
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:flex-1 lg:max-w-2xl lg:justify-end">
            {/* Search */}
            <div className="relative flex-1 sm:max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-4 w-4 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800/50 border border-blue-200 dark:border-blue-700/50 rounded-xl text-gray-900 dark:text-white placeholder-blue-300 dark:placeholder-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Download PDF */}
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloading || loading}
                className="px-4 py-2.5 text-white rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap shadow-md hover:shadow-lg text-sm active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: "#1e3a8a" }}
              >
                <Download className={`w-4 h-4 ${isDownloading ? "animate-bounce" : ""}`} />
                <span>{isDownloading ? "Generating..." : "PDF"}</span>
              </button>

              {/* Refresh */}
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2.5 text-gray-500 hover:text-blue-600 bg-white dark:bg-gray-800/50 border border-blue-100 dark:border-blue-700/50 rounded-xl transition-all hover:shadow-md disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw
                  className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
                />
              </button>

              {/* Form Filter */}
              <div className="relative">
                <button
                  onClick={() => setShowFormFilter(!showFormFilter)}
                  className={`px-4 py-2.5 text-white rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap shadow-md hover:shadow-lg text-sm active:scale-95 ${showFormFilter ? "ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900" : ""}`}
                  style={{ backgroundColor: "#1e3a8a" }}
                >
                  <List className="w-4 h-4" />
                  <span>
                    Forms (
                    {selectedFormIds.length === 0
                      ? uniqueForms.length
                      : selectedFormIds.includes("NONE_SELECTED")
                        ? 0
                        : selectedFormIds.length}
                    )
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${showFormFilter ? "rotate-180" : ""}`}
                  />
                </button>

                {showFormFilter && (
                  <div className="absolute top-full right-0 mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-[100] w-72 sm:w-80 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-4 py-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                          Filter by Form
                        </h4>
                        <button
                          onClick={() => setShowFormFilter(false)}
                          className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <XCircle className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedFormIds([])}
                          className="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white rounded-lg hover:opacity-90"
                          style={{ backgroundColor: "#1e3a8a" }}
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedFormIds(["NONE_SELECTED"])}
                          className="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto py-2">
                      {uniqueForms.map((form) => (
                        <label
                          key={form.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={
                              selectedFormIds.length === 0 ||
                              (selectedFormIds.includes(form.id) &&
                                !selectedFormIds.includes("NONE_SELECTED"))
                            }
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (selectedFormIds.length === 0) {
                                if (!checked)
                                  setSelectedFormIds(
                                    uniqueForms
                                      .map((f) => f.id)
                                      .filter((id) => id !== form.id),
                                  );
                              } else if (
                                selectedFormIds.includes("NONE_SELECTED")
                              ) {
                                if (checked) setSelectedFormIds([form.id]);
                              } else {
                                if (checked) {
                                  const n = [...selectedFormIds, form.id];
                                  setSelectedFormIds(
                                    n.length === uniqueForms.length ? [] : n,
                                  );
                                } else {
                                  const n = selectedFormIds.filter(
                                    (id) => id !== form.id,
                                  );
                                  setSelectedFormIds(
                                    n.length === 0 ? ["NONE_SELECTED"] : n,
                                  );
                                }
                              }
                            }}
                            className="w-4 h-4 rounded cursor-pointer"
                            style={{ accentColor: "#1e3a8a" }}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 block truncate">
                              {form.title}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {
                                responses.filter(
                                  (r) => (r.questionId || r.formId) === form.id,
                                ).length
                              }{" "}
                              responses
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">
                        {selectedFormIds.length === 0
                          ? uniqueForms.length
                          : selectedFormIds.includes("NONE_SELECTED")
                            ? 0
                            : selectedFormIds.length}{" "}
                        of {uniqueForms.length} selected
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 mb-6 rounded-xl overflow-hidden shadow-sm border border-blue-100 dark:border-blue-800/30">
        <div className="flex">
          {(
            [
              { key: "summary", label: "Summary & Analytics" },
              { key: "requests", label: "Customer Requests" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                activeTab === tab.key
                  ? "text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/10"
              }`}
              style={
                activeTab === tab.key ? { backgroundColor: "#1e3a8a" } : {}
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SUMMARY TAB
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "summary" && (
        <div className="space-y-6" id="pdf-content-container">
          {/* Overall Compliance Donut Chart */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-800/30 flex flex-col sm:flex-row items-center gap-8">
            <div className="flex-1 w-full">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3 mb-2">
                <PieChart className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Overall Compliance
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Yes and No percentages in overall responses
              </p>
              
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800/30">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="font-semibold text-green-900 dark:text-green-100">Yes / Accepted</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-lg text-green-700 dark:text-green-300">{summaryTotals.yesCount}</span>
                    <span className="text-xs font-bold text-green-600/70 ml-2">
                      ({summaryTotals.total > 0 ? Math.round((summaryTotals.yesCount / summaryTotals.total) * 100) : 0}%)
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/30">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="font-semibold text-red-900 dark:text-red-100">No / Rejected</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-lg text-red-700 dark:text-red-300">{summaryTotals.noCount}</span>
                    <span className="text-xs font-bold text-red-600/70 ml-2">
                      ({summaryTotals.total > 0 ? Math.round((summaryTotals.noCount / summaryTotals.total) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                {summaryTotals.naCount > 0 && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">N/A / Rework</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-lg text-gray-700 dark:text-gray-300">{summaryTotals.naCount}</span>
                      <span className="text-xs font-bold text-gray-500 ml-2">
                        ({summaryTotals.total > 0 ? Math.round((summaryTotals.naCount / summaryTotals.total) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex-1 w-full flex justify-center items-center h-[280px]">
              <Doughnut data={donutData} options={donutOptions} />
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-pdf">
            {/* Total Responses */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-blue-200/50 dark:border-blue-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1 uppercase tracking-wider">
                    Total Requests
                  </p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {totalResponses}
                  </p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                    Across {uniqueForms.length} forms
                  </p>
                </div>
                <div className="p-2.5 bg-blue-500/20 rounded-full">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            {/* Overall Score */}
            <div
              className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 p-4 rounded-xl border border-yellow-200/50 dark:border-yellow-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer"
              onClick={() => setExpandScore(!expandScore)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-1 uppercase tracking-wider">
                      Overall Score
                    </p>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-yellow-600 transition-transform duration-300 ${expandScore ? "rotate-180" : ""}`}
                    />
                  </div>
                  <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                    {overallScore}%
                  </p>
                  <p className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-1">
                    Yes rate
                  </p>
                </div>
                <div className="p-2.5 bg-yellow-500/20 rounded-full">
                  <Award className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
              {expandScore && (
                <div className="mt-3 pt-3 border-t border-yellow-300/50 grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-white/50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-[10px] font-bold text-green-600 uppercase mb-0.5">
                      Yes
                    </p>
                    <p className="text-base font-black text-green-700 dark:text-green-300">
                      {yesPercent}%
                    </p>
                  </div>
                  <div className="text-center p-2 bg-white/50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-[10px] font-bold text-red-600 uppercase mb-0.5">
                      No
                    </p>
                    <p className="text-base font-black text-red-700 dark:text-red-300">
                      {noPercent}%
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Active Forms */}
            <div className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 p-4 rounded-xl border border-sky-200/50 dark:border-sky-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-sky-700 dark:text-sky-300 mb-1 uppercase tracking-wider">
                    Active Forms
                  </p>
                  <p className="text-2xl font-bold text-sky-900 dark:text-sky-100">
                    {uniqueForms.length}
                  </p>
                  <p className="text-[10px] text-sky-600 dark:text-sky-400 mt-1">
                    Collecting responses
                  </p>
                </div>
                <div className="p-2.5 bg-sky-500/20 rounded-full">
                  <Target className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
              </div>
            </div>

            {/* Yes Total */}
            <div
              className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-xl border border-green-200/50 dark:border-green-700/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer"
              onClick={() => setExpandRate(!expandRate)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1 uppercase tracking-wider">
                      Yes Total
                    </p>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-green-600 transition-transform duration-300 ${expandRate ? "rotate-180" : ""}`}
                    />
                  </div>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {totalYes}
                  </p>
                  <p className="text-[10px] text-green-600 dark:text-green-400 mt-1">
                    of {totalQuestions} questions
                  </p>
                </div>
                <div className="p-2.5 bg-green-500/20 rounded-full">
                  <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
              {expandRate && (
                <div className="mt-3 pt-3 border-t border-green-300/50 grid grid-cols-2 gap-2">
                  <div className="bg-white/50 dark:bg-green-900/20 p-2 rounded-lg">
                    <p className="text-[10px] font-bold text-green-600 uppercase mb-0.5">
                      Yes
                    </p>
                    <p className="text-lg font-black text-green-700 dark:text-green-300">
                      {totalYes}
                    </p>
                  </div>
                  <div className="bg-white/50 dark:bg-red-900/20 p-2 rounded-lg">
                    <p className="text-[10px] font-bold text-red-600 uppercase mb-0.5">
                      No
                    </p>
                    <p className="text-lg font-black text-red-700 dark:text-red-300">
                      {totalNo}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 7-day trend */}
          <div className="bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 dark:from-gray-800 dark:via-blue-900/10 dark:to-indigo-900/10 p-6 rounded-3xl shadow-xl border border-blue-200/50 dark:border-blue-700/50 no-pdf">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-7 bg-blue-600 rounded-full" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5" /> Response Volume – Last 7 Days
              </h3>
            </div>
            <div className="h-64">
              <Line data={lineData} options={lineOptions} />
            </div>
          </div>

          {/* ── Response-wise First Question Analytics ─────────────────────── */}

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-800/30 overflow-hidden mb-6">
            <div className="p-6 border-b border-blue-100 dark:border-gray-700 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-900/10">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <List className="w-6 h-6 text-blue-600 dark:text-blue-400" />{" "}
                First Question Responses
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                Response-wise first question, answer, and compliance breakdown
              </p>
            </div>

            <div className="p-5">
              {(() => {
                // ── group by form title ──────────────────────────────────────────────
                const grouped = filteredResponses.reduce(
                  (acc, r) => {
                    const title = r.formTitle || "Unknown Form";
                    if (!acc[title]) acc[title] = [];
                    acc[title].push(r);
                    return acc;
                  },
                  {} as Record<string, typeof filteredResponses>,
                );

                const formTitles = Object.keys(grouped).sort();

                if (formTitles.length === 0) {
                  return (
                    <div className="text-center py-6 text-gray-500">
                      No responses found.
                    </div>
                  );
                }

                // ── helper: visual bar (green = yes/accepted, red = no/rejected) ─────
                const ComplianceBar = ({
                  yesCount,
                  noCount,
                  total,
                }: {
                  yesCount: number;
                  noCount: number;
                  total: number;
                }) => {
                  if (total === 0)
                    return (
                      <span className="text-gray-300 dark:text-gray-600 text-xs">
                        —
                      </span>
                    );
                  const yesPct = Math.round((yesCount / total) * 100);
                  const noPct = Math.round((noCount / total) * 100);
                  return (
                    <div className="flex flex-col items-center gap-1 min-w-[80px]">
                      {/* bar */}
                      <div className="flex h-3 w-full rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
                        {yesPct > 0 && (
                          <div
                            className="bg-green-500 transition-all"
                            style={{ width: `${yesPct}%` }}
                            title={`Yes ${yesPct}%`}
                          />
                        )}
                        {noPct > 0 && (
                          <div
                            className="bg-red-500 transition-all"
                            style={{ width: `${noPct}%` }}
                            title={`No ${noPct}%`}
                          />
                        )}
                      </div>
                      {/* labels */}
                      <div className="flex justify-between w-full text-[10px] font-bold leading-none">
                        <span className="text-green-600 dark:text-green-400">
                          {yesPct}%
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                          {noPct}%
                        </span>
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="space-y-8">
                    {formTitles.map((formTitle) => {
                      const rows = grouped[formTitle];
                      const displayRows = rows.slice(0, 100);

                      // ── decide columns: scan actual stats to see what's present ────
                      // Check if ANY response has accepted/rejected/rework values
                      const hasInspection = displayRows.some(
                        (r) =>
                          (r.stats?.accepted ?? 0) > 0 ||
                          (r.stats?.rejected ?? 0) > 0 ||
                          (r.stats?.rework ?? 0) > 0,
                      );
                      // Check if N/A values actually exist (only show if they do)
                      const hasNA =
                        !hasInspection &&
                        displayRows.some((r) => (r.stats?.na ?? 0) > 0);

                      // Build column list based on what actually exists in the data
                      const columns: Array<
                        "yes" | "no" | "na" | "accepted" | "rejected" | "rework"
                      > = hasInspection
                        ? ["accepted", "rejected", "rework"]
                        : hasNA
                          ? ["yes", "no", "na"]
                          : ["yes", "no"]; // ← pure yes/no form: no N/A column at all

                      const primaryCol = hasInspection ? "accepted" : "yes";
                      const secondaryCol = hasInspection ? "rejected" : "no";

                      // Column display config
                      const colConfig: Record<
                        string,
                        { label: string; color: string }
                      > = {
                        yes: {
                          label: "Yes",
                          color: "text-green-700 dark:text-green-400",
                        },
                        no: {
                          label: "No",
                          color: "text-red-700 dark:text-red-400",
                        },
                        na: {
                          label: "N/A",
                          color: "text-slate-600 dark:text-slate-400",
                        },
                        accepted: {
                          label: "Accepted",
                          color: "text-emerald-700 dark:text-emerald-400",
                        },
                        rejected: {
                          label: "Rejected",
                          color: "text-red-700 dark:text-red-400",
                        },
                        rework: {
                          label: "Rework",
                          color: "text-amber-700 dark:text-amber-400",
                        },
                      };

                      // Per-row data
                      const rowsData = displayRows.map((r) => {
                        const stats = r.stats ?? {
                          yes: 0,
                          no: 0,
                          na: 0,
                          accepted: 0,
                          rejected: 0,
                          rework: 0,
                        };
                        const colTotal = columns.reduce(
                          (s, c) => s + (stats[c] ?? 0),
                          0,
                        );
                        return { r, stats, colTotal };
                      });

                      // Column totals for footer
                      const colTotals = columns.reduce(
                        (acc, col) => {
                          acc[col] = rowsData.reduce(
                            (s, { stats }) => s + (stats[col] ?? 0),
                            0,
                          );
                          return acc;
                        },
                        {} as Record<string, number>,
                      );
                      const grandTotal = Object.values(colTotals).reduce(
                        (a, b) => a + b,
                        0,
                      );

                      return (
                        <div key={formTitle}>
                          <h4 className="text-md font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            {formTitle}
                            <span className="text-xs font-normal text-gray-500 ml-1">
                              ({rows.length} response
                              {rows.length !== 1 ? "s" : ""})
                            </span>
                          </h4>

                          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                            <table className="min-w-full text-xs border-collapse">
                              <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                  <th className="text-left px-4 py-3 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 whitespace-nowrap w-36">
                                    Response Date
                                  </th>
                                  <th colSpan={2} className="text-left px-4 py-3 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                                    Basic Informations
                                  </th>
                                  {/* Dynamic compliance columns */}
                                  {columns.map((col) => (
                                    <th
                                      key={col}
                                      className={`text-center px-3 py-3 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider whitespace-nowrap ${colConfig[col].color}`}
                                    >
                                      {colConfig[col].label}
                                    </th>
                                  ))}
                                  {/* Visual bar column */}
                                  <th className="text-center px-4 py-3 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 whitespace-nowrap w-28">
                                    {hasInspection ? "Acc / Rej" : "Yes / No"}
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {rowsData.map(({ r, stats, colTotal }, i) => (
                                  <tr
                                    key={r._id || i}
                                    className={`border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors ${
                                      i % 2 === 0
                                        ? "bg-white dark:bg-gray-900"
                                        : "bg-gray-50/50 dark:bg-gray-800/50"
                                    }`}
                                  >
                                    {/* Date */}
                                    <td className="px-4 py-3 border border-gray-200 dark:border-gray-700 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                      {formatTimestamp(r.createdAt)}
                                    </td>
                                    {/* First Question */}
                                    <td className="px-4 py-3 border border-gray-200 dark:border-gray-700 break-words whitespace-normal text-gray-800 dark:text-gray-200">
                                      {r.firstQuestionText}
                                    </td>
                                    {/* Answer */}
                                    <td 
                                      className="px-4 py-3 font-bold border border-gray-200 dark:border-gray-700 break-words whitespace-normal text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                                      onClick={() => navigate(`/responses/${r._id || r.id}`)}
                                    >
                                      {r.firstAnswerValue}
                                    </td>
                                    {/* Compliance counts */}
                                    {columns.map((col) => {
                                      const count = stats[col] ?? 0;
                                      const pct =
                                        colTotal > 0
                                          ? Math.round((count / colTotal) * 100)
                                          : null;
                                      return (
                                        <td
                                          key={col}
                                          className={`text-center px-3 py-3 border border-gray-200 dark:border-gray-700 font-bold ${colConfig[col].color}`}
                                        >
                                          {colTotal === 0 ? (
                                            <span className="text-gray-300 dark:text-gray-600">
                                              —
                                            </span>
                                          ) : (
                                            <>
                                              {count}
                                              {pct !== null && (
                                                <span className="text-gray-400 dark:text-gray-500 font-medium ml-1">
                                                  ({pct}%)
                                                </span>
                                              )}
                                            </>
                                          )}
                                        </td>
                                      );
                                    })}
                                    {/* Visual bar */}
                                    <td className="px-3 py-3 border border-gray-200 dark:border-gray-700">
                                      <div className="flex justify-center">
                                        <ComplianceBar
                                          yesCount={stats[primaryCol] ?? 0}
                                          noCount={stats[secondaryCol] ?? 0}
                                          total={colTotal}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                ))}

                                {/* ── Footer totals row ────────────────────────────── */}
                                <tr className="bg-blue-100/80 dark:bg-blue-900/40 font-extrabold border-t-2 border-blue-300 dark:border-blue-600">
                                  <td
                                    colSpan={3}
                                    className="px-4 py-3 text-blue-900 dark:text-blue-100 border border-gray-300 dark:border-gray-600 uppercase tracking-wider"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-2.5 h-2.5 bg-blue-700 rounded-full" />
                                      Total ({Math.min(rows.length, 100)} shown)
                                    </div>
                                  </td>
                                  {columns.map((col) => {
                                    const total = colTotals[col] ?? 0;
                                    const pct =
                                      grandTotal > 0
                                        ? Math.round((total / grandTotal) * 100)
                                        : null;
                                    return (
                                      <td
                                        key={col}
                                        className={`text-center px-3 py-3 border border-gray-300 dark:border-gray-600 ${colConfig[col].color}`}
                                      >
                                        {total}
                                        {pct !== null && (
                                          <span className="text-gray-500 dark:text-gray-400 font-medium ml-1">
                                            ({pct}%)
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  {/* Footer visual bar */}
                                  <td className="px-3 py-3 border border-gray-300 dark:border-gray-600">
                                    <div className="flex justify-center">
                                      <ComplianceBar
                                        yesCount={colTotals[primaryCol] ?? 0}
                                        noCount={colTotals[secondaryCol] ?? 0}
                                        total={grandTotal}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {rows.length > 100 && (
                            <div className="text-right mt-2 text-[10px] text-gray-500">
                              Showing first 100 of {rows.length} responses for
                              this form.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Section-wise Analytics ─────────────────────────────────────── */}
          {/* ── Section-wise Analytics ─────────────────────────────────────── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-800/30 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-blue-100 dark:border-gray-700 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-900/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <PieChart className="w-6 h-6 text-blue-600 dark:text-blue-400" />{" "}
                    Section Summary
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                    Section-wise performance breakdown
                  </p>
                </div>

                {/* Section filter */}
                <div className="relative">
                  <button
                    onClick={() => setShowSectionSelector(!showSectionSelector)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
                  >
                    Sections (
                    {selectedSectionIds.length === 0
                      ? sectionStats.length
                      : selectedSectionIds.length}
                    )
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${showSectionSelector ? "rotate-180" : ""}`}
                    />
                  </button>
                  {showSectionSelector && (
                    <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-[60] min-w-[240px] max-h-80 overflow-y-auto">
                      <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 p-2 border-b border-gray-100 dark:border-gray-800">
                        <label className="flex items-center gap-3 px-3 py-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedSectionIds.length === 0}
                            onChange={() => setSelectedSectionIds([])}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            Select All
                          </span>
                        </label>
                      </div>
                      <div className="p-1">
                        {sectionStats.map((stat) => (
                          <label
                            key={stat.id}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={
                                selectedSectionIds.length === 0 ||
                                selectedSectionIds.includes(stat.id)
                              }
                              onChange={() => {
                                setSelectedSectionIds((prev) => {
                                  if (prev.length === 0)
                                    return sectionStats
                                      .map((s) => s.id)
                                      .filter((id) => id !== stat.id);
                                  const has = prev.includes(stat.id);
                                  const next = has
                                    ? prev.filter((id) => id !== stat.id)
                                    : [...prev, stat.id];
                                  return next.length === sectionStats.length
                                    ? []
                                    : next;
                                });
                              }}
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {stat.title}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {(() => {
                // ── Decide columns by scanning actual data ──────────────────────────
                const hasInspection = sectionSummaryRows.some(
                  (r) => r.accepted > 0 || r.rejected > 0 || r.rework > 0,
                );
                const hasNA =
                  !hasInspection &&
                  sectionSummaryRows.some((r) => r.naCount > 0);

                // columns to render
                type ColKey =
                  | "yes"
                  | "no"
                  | "na"
                  | "accepted"
                  | "rejected"
                  | "rework";
                const columns: ColKey[] = hasInspection
                  ? ["accepted", "rejected", "rework"]
                  : hasNA
                    ? ["yes", "no", "na"]
                    : ["yes", "no"];

                const colConfig: Record<
                  ColKey,
                  {
                    label: string;
                    header: string;
                    color: string;
                    countKey: keyof (typeof sectionSummaryRows)[0];
                  }
                > = {
                  yes: {
                    label: "Yes",
                    header: "Yes",
                    color: "text-green-700 dark:text-green-400",
                    countKey: "yesCount",
                  },
                  no: {
                    label: "No",
                    header: "No",
                    color: "text-red-700 dark:text-red-400",
                    countKey: "noCount",
                  },
                  na: {
                    label: "N/A",
                    header: "N/A",
                    color: "text-slate-600 dark:text-slate-400",
                    countKey: "naCount",
                  },
                  accepted: {
                    label: "Accepted",
                    header: "Accepted",
                    color: "text-emerald-700 dark:text-emerald-400",
                    countKey: "yesCount",
                  },
                  rejected: {
                    label: "Rejected",
                    header: "Rejected",
                    color: "text-red-700 dark:text-red-400",
                    countKey: "noCount",
                  },
                  rework: {
                    label: "Rework",
                    header: "Rework",
                    color: "text-amber-700 dark:text-amber-400",
                    countKey: "naCount",
                  },
                };

                // Color legend — only show what's in use
                const legendItems: [string, string][] = hasInspection
                  ? [
                      ["bg-emerald-500", "Accepted"],
                      ["bg-red-500", "Rejected"],
                      ["bg-amber-400", "Rework"],
                    ]
                  : hasNA
                    ? [
                        ["bg-green-500", "Yes"],
                        ["bg-red-500", "No"],
                        ["bg-gray-400", "N/A"],
                      ]
                    : [
                        ["bg-green-500", "Yes"],
                        ["bg-red-500", "No"],
                      ];

                // recomputed totals for visible columns only
                const footerTotals = columns.reduce(
                  (acc, col) => {
                    acc[col] = sectionSummaryRows.reduce(
                      (s, r) => s + (Number(r[colConfig[col].countKey]) || 0),
                      0,
                    );
                    return acc;
                  },
                  {} as Record<string, number>,
                );
                const footerGrand = Object.values(footerTotals).reduce(
                  (a, b) => a + b,
                  0,
                );

                const primaryCol = hasInspection ? "accepted" : "yes";
                const secondaryCol = hasInspection ? "rejected" : "no";

                return (
                  <>
                    {/* Color legend */}
                    <div className="flex flex-wrap items-center gap-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                      {legendItems.map(([c, l]) => (
                        <div key={l} className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${c}`} />
                          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {l}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Table + Radar side by side */}
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Table */}
                      <div className="flex-1 min-w-0 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full text-xs border-collapse">
                          <thead className="bg-gray-100 dark:bg-gray-800">
                            <tr>
                              <th
                                rowSpan={2}
                                className="text-left px-4 py-3 border border-gray-300 dark:border-gray-600 min-w-[200px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200"
                              >
                                Section
                              </th>
                              <th
                                rowSpan={2}
                                className="text-center px-3 py-3 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200"
                              >
                                Total
                              </th>
                              <th
                                colSpan={columns.length}
                                className="text-center px-3 py-2 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200"
                              >
                                Performance Breakdown
                              </th>
                              <th
                                rowSpan={2}
                                className="text-center px-4 py-3 border border-gray-300 dark:border-gray-600 font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 w-28"
                              >
                                Visual
                              </th>
                            </tr>
                            <tr className="bg-gray-50 dark:bg-gray-700/50">
                              {columns.map((col) => (
                                <th
                                  key={col}
                                  className={`text-center px-3 py-2 border border-gray-300 dark:border-gray-600 font-bold ${colConfig[col].color}`}
                                >
                                  {colConfig[col].header}
                                </th>
                              ))}
                            </tr>
                          </thead>

                          <tbody>
                            {sectionSummaryRows.map((row, i) => {
                              const primaryCount =
                                Number(row[colConfig[primaryCol].countKey]) ||
                                0;
                              const secondaryCount =
                                Number(row[colConfig[secondaryCol].countKey]) ||
                                0;
                              const barTotal =
                                primaryCount +
                                secondaryCount +
                                (hasInspection || hasNA
                                  ? Number(
                                      row[
                                        colConfig[
                                          hasInspection ? "rework" : "na"
                                        ].countKey
                                      ],
                                    ) || 0
                                  : 0);

                              return (
                                <tr
                                  key={row.id}
                                  className={`border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors ${
                                    i % 2 === 0
                                      ? "bg-white dark:bg-gray-900"
                                      : "bg-gray-50/50 dark:bg-gray-800/50"
                                  }`}
                                >
                                  <td
                                    className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400 border border-gray-200 dark:border-gray-700 text-sm truncate max-w-[200px]"
                                    title={row.title}
                                  >
                                    {row.title}
                                  </td>
                                  <td className="text-center px-3 py-3 border border-gray-200 dark:border-gray-700 font-bold text-gray-900 dark:text-white">
                                    {row.total}
                                  </td>
                                  {columns.map((col) => {
                                    const count =
                                      Number(row[colConfig[col].countKey]) || 0;
                                    const pct =
                                      row.total > 0
                                        ? Math.round((count / row.total) * 100)
                                        : 0;
                                    return (
                                      <td
                                        key={col}
                                        className={`text-center px-3 py-3 border border-gray-200 dark:border-gray-700 font-bold ${colConfig[col].color}`}
                                      >
                                        {count}{" "}
                                        <span className="text-gray-400 dark:text-gray-500 font-medium">
                                          ({pct}%)
                                        </span>
                                      </td>
                                    );
                                  })}
                                  {/* Visual bar */}
                                  <td className="px-3 py-3 border border-gray-200 dark:border-gray-700">
                                    <div className="flex flex-col items-center gap-1">
                                      <div className="flex h-4 w-full rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
                                        {barTotal > 0 && primaryCount > 0 && (
                                          <div
                                            className="bg-green-500"
                                            style={{
                                              width: `${Math.round((primaryCount / barTotal) * 100)}%`,
                                            }}
                                            title={`${colConfig[primaryCol].label} ${Math.round((primaryCount / barTotal) * 100)}%`}
                                          />
                                        )}
                                        {barTotal > 0 && secondaryCount > 0 && (
                                          <div
                                            className="bg-red-500"
                                            style={{
                                              width: `${Math.round((secondaryCount / barTotal) * 100)}%`,
                                            }}
                                            title={`${colConfig[secondaryCol].label} ${Math.round((secondaryCount / barTotal) * 100)}%`}
                                          />
                                        )}
                                        {(hasInspection || hasNA) &&
                                          barTotal > 0 &&
                                          (() => {
                                            const naCol = hasInspection
                                              ? "rework"
                                              : "na";
                                            const naCount =
                                              Number(
                                                row[colConfig[naCol].countKey],
                                              ) || 0;
                                            return naCount > 0 ? (
                                              <div
                                                className={
                                                  hasInspection
                                                    ? "bg-amber-400"
                                                    : "bg-gray-400"
                                                }
                                                style={{
                                                  width: `${Math.round((naCount / barTotal) * 100)}%`,
                                                }}
                                                title={`${colConfig[naCol].label} ${Math.round((naCount / barTotal) * 100)}%`}
                                              />
                                            ) : null;
                                          })()}
                                      </div>
                                      {barTotal > 0 && (
                                        <div className="flex justify-between w-full text-[10px] font-bold">
                                          <span className="text-green-600 dark:text-green-400">
                                            {Math.round(
                                              (primaryCount / barTotal) * 100,
                                            )}
                                            %
                                          </span>
                                          <span className="text-red-600 dark:text-red-400">
                                            {Math.round(
                                              (secondaryCount / barTotal) * 100,
                                            )}
                                            %
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Total footer row */}
                            <tr className="bg-blue-100/80 dark:bg-blue-900/40 font-extrabold border-t-2 border-blue-300 dark:border-blue-600">
                              <td className="px-4 py-3 text-blue-900 dark:text-blue-100 border border-gray-300 dark:border-gray-600 uppercase tracking-wider">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 bg-blue-700 rounded-full" />{" "}
                                  Total
                                </div>
                              </td>
                              <td className="text-center px-3 py-3 border border-gray-300 dark:border-gray-600 text-blue-900 dark:text-blue-100 text-base">
                                {summaryTotals.total}
                              </td>
                              {columns.map((col) => {
                                const total = footerTotals[col] ?? 0;
                                const pct =
                                  footerGrand > 0
                                    ? Math.round((total / footerGrand) * 100)
                                    : 0;
                                return (
                                  <td
                                    key={col}
                                    className={`text-center px-3 py-3 border border-gray-300 dark:border-gray-600 ${colConfig[col].color}`}
                                  >
                                    {total}{" "}
                                    <span className="text-gray-500 dark:text-gray-400 font-medium">
                                      ({pct}%)
                                    </span>
                                  </td>
                                );
                              })}
                              {/* Footer visual bar */}
                              <td className="px-3 py-3 border border-gray-300 dark:border-gray-600">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex h-4 w-full rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
                                    {footerGrand > 0 &&
                                      (footerTotals[primaryCol] ?? 0) > 0 && (
                                        <div
                                          className="bg-green-500"
                                          style={{
                                            width: `${Math.round(((footerTotals[primaryCol] ?? 0) / footerGrand) * 100)}%`,
                                          }}
                                        />
                                      )}
                                    {footerGrand > 0 &&
                                      (footerTotals[secondaryCol] ?? 0) > 0 && (
                                        <div
                                          className="bg-red-500"
                                          style={{
                                            width: `${Math.round(((footerTotals[secondaryCol] ?? 0) / footerGrand) * 100)}%`,
                                          }}
                                        />
                                      )}
                                  </div>
                                  {footerGrand > 0 && (
                                    <div className="flex justify-between w-full text-[10px] font-bold">
                                      <span className="text-green-600 dark:text-green-400">
                                        {Math.round(
                                          ((footerTotals[primaryCol] ?? 0) /
                                            footerGrand) *
                                            100,
                                        )}
                                        %
                                      </span>
                                      <span className="text-red-600 dark:text-red-400">
                                        {Math.round(
                                          ((footerTotals[secondaryCol] ?? 0) /
                                            footerGrand) *
                                            100,
                                        )}
                                        %
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Radar Chart — unchanged */}
                      <div className="w-full lg:w-[420px] flex-shrink-0">
                        <div className="bg-white dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md h-full">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                            <div>
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                                Performance Radar
                              </h4>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                Comparative section analysis
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              {legendItems.map(([c, l]) => (
                                <div
                                  key={l}
                                  className="flex items-center gap-1"
                                >
                                  <div
                                    className={`w-1.5 h-1.5 rounded-full ${c}`}
                                  />
                                  <span className="text-[9px] font-bold text-gray-500 uppercase">
                                    {l}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="h-80">
                            <Radar data={radarData} options={radarOptions} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Empty state */}
                    {sectionSummaryRows.length === 0 && (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        No section performance data available yet.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50/50 dark:from-blue-900/20 dark:via-gray-800 dark:to-indigo-900/15 p-6 rounded-2xl shadow-2xl border border-blue-200 dark:border-blue-800/50 no-pdf">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
              <Zap className="w-6 h-6 text-yellow-500" /> Quick Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setActiveTab("requests")}
                className="flex items-center justify-center p-4 text-white rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:opacity-90"
                style={{ backgroundColor: "#1e3a8a" }}
              >
                <FileText className="w-5 h-5 mr-3" /> View All Requests
              </button>
              <button
                onClick={fetchData}
                className="flex items-center justify-center p-4 text-white rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              >
                <RefreshCw className="w-5 h-5 mr-3" /> Refresh Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          CUSTOMER REQUESTS TAB
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "requests" && (
        <div className="space-y-6">
          {Object.keys(groupedResponses)
            .sort((a, b) => a.localeCompare(b))
            .map((formTitle) => {
              const formGroups = groupedResponses[formTitle];
              const isExpanded = expandedForms.includes(formTitle);
              const totalFormResponses = Object.values(formGroups).reduce(
                (sum, responses) => sum + responses.length,
                0,
              );

              return (
                <div
                  key={formTitle}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-800/30 overflow-hidden"
                >
                  <div
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    onClick={() => toggleForm(formTitle)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {formTitle}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {totalFormResponses} request
                          {totalFormResponses !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </div>

                  {isExpanded && (
                    <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 space-y-6">
                      {Object.keys(formGroups)
                        .sort(
                          (a, b) =>
                            new Date(b).getTime() - new Date(a).getTime(),
                        )
                        .map((date) => (
                          <div key={date} className="space-y-3">
                            <h4 className="text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                              <Calendar className="w-4 h-4" /> {date}
                              <span className="text-xs font-normal text-gray-500">
                                ({formGroups[date].length})
                              </span>
                            </h4>
                            <div className="space-y-3">
                              {formGroups[date].map((response) => {
                                const isFollowUp = !!response.parentResponseId;
                                return (
                                  <div
                                    key={response._id}
                                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border transition-all duration-200 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md ${isFollowUp ? "sm:ml-8" : ""}`}
                                  >
                                    <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                                      <div className="p-2.5 rounded-lg flex-shrink-0 bg-blue-50 dark:bg-blue-900/20">
                                        {isFollowUp ? (
                                          <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">
                                            ↳
                                          </span>
                                        ) : (
                                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                          {isFollowUp && (
                                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                              Follow-up
                                            </span>
                                          )}
                                          {response.submissionMetadata
                                            ?.source === "internal" && (
                                            <span className="text-xs font-semibold px-2 py-1 rounded-md bg-purple-200 dark:bg-purple-900/40 text-purple-900 dark:text-purple-300">
                                              Internal
                                            </span>
                                          )}
                                          {response.submissionMetadata
                                            ?.source === "whatsapp" && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                                              <MessageCircle className="w-3 h-3" />{" "}
                                              WhatsApp
                                            </span>
                                          )}
                                          {response.submissionMetadata
                                            ?.source === "email" && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                              <Mail className="w-3 h-3" /> Email
                                            </span>
                                          )}
                                          {response.submissionMetadata
                                            ?.source === "sms" && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                              <MessageSquare className="w-3 h-3" />{" "}
                                              SMS
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center text-xs gap-2 sm:gap-3">
                                          {(() => {
                                            const stats = response.stats;
                                            if (!stats) return null;
                                            const total =
                                              stats.yes +
                                              stats.no +
                                              stats.na +
                                              stats.accepted +
                                              stats.rejected +
                                              stats.rework;
                                            if (total === 0) return null;
                                            return (
                                              <div className="flex flex-wrap items-center gap-1.5 mr-2">
                                                {stats.yes > 0 && (
                                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                                                    Yes{" "}
                                                    {Math.round(
                                                      (stats.yes / total) * 100,
                                                    )}
                                                    %
                                                  </span>
                                                )}
                                                {stats.no > 0 && (
                                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                                                    No{" "}
                                                    {Math.round(
                                                      (stats.no / total) * 100,
                                                    )}
                                                    %
                                                  </span>
                                                )}
                                                {stats.na > 0 && (
                                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                                    N/A{" "}
                                                    {Math.round(
                                                      (stats.na / total) * 100,
                                                    )}
                                                    %
                                                  </span>
                                                )}
                                                {stats.accepted > 0 && (
                                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                                    Acc{" "}
                                                    {Math.round(
                                                      (stats.accepted / total) *
                                                        100,
                                                    )}
                                                    %
                                                  </span>
                                                )}
                                                {stats.rejected > 0 && (
                                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                                                    Rej{" "}
                                                    {Math.round(
                                                      (stats.rejected / total) *
                                                        100,
                                                    )}
                                                    %
                                                  </span>
                                                )}
                                                {stats.rework > 0 && (
                                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                                                    Rew{" "}
                                                    {Math.round(
                                                      (stats.rework / total) *
                                                        100,
                                                    )}
                                                    %
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })()}
                                          {response.dealerName &&
                                            response.dealerName !==
                                              "Unknown" && (
                                              <div className="inline-flex items-center text-gray-600 dark:text-gray-400">
                                                <User className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                                <span
                                                  className="font-medium truncate"
                                                  title={response.dealerName}
                                                >
                                                  {response.dealerName}
                                                  {response.dealerRank && (
                                                    <span
                                                      className={`ml-2 text-[10px] font-bold min-w-[24px] h-5 px-1.5 rounded-full inline-flex items-center justify-center border shadow-sm ${getRankStyle(response.dealerName)}`}
                                                    >
                                                      #{response.dealerRank}
                                                    </span>
                                                  )}
                                                </span>
                                              </div>
                                            )}
                                          {response.submissionMetadata
                                            ?.location && (
                                            <div className="inline-flex items-center text-gray-600 dark:text-gray-400">
                                              <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                              <span className="truncate">
                                                {[
                                                  response.submissionMetadata
                                                    .location.city,
                                                  response.submissionMetadata
                                                    .location.region,
                                                  response.submissionMetadata
                                                    .location.country,
                                                ]
                                                  .filter(Boolean)
                                                  .join(", ")}
                                              </span>
                                            </div>
                                          )}
                                          <div className="inline-flex items-center text-gray-600 dark:text-gray-400">
                                            <Calendar className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                            <span>
                                              {formatTimestamp(
                                                response.createdAt,
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0 mt-4 sm:mt-0 sm:ml-4">
                                      <button
                                        onClick={() =>
                                          navigate(
                                            `/responses/${response._id || response.id}`,
                                          )
                                        }
                                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                                        title="View details"
                                      >
                                        <Eye className="w-5 h-5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}

          {Object.keys(groupedResponses).length === 0 && (
            <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Customer Requests
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                {selectedFormIds.length === 0
                  ? "There are currently no customer service requests."
                  : "No requests match your current filters."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
