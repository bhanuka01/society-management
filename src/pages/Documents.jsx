import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import Pagination, { PAGE_SIZE } from "../components/Pagination";
import {
  ALLOWED_CATEGORIES,
  ALL_CATEGORY_IDS,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_STORAGE_BYTES,
  validateDocumentFile,
  validateStorageQuota,
  formatBytes,
  formatGb,
  getFileTypeCategory,
  uploadDocument,
  getDocumentSignedUrl,
  downloadDocumentFile,
  deleteDocument,
  updateDocumentMetadata,
  checkR2Config,
  normalizeDocAccessMap,
  getMemberCategoriesFromMap
} from "../lib/documentService";
import { getMemberDocCategories } from "../App";
import {
  Folder,
  FolderOpen,
  FolderArchive,
  FileArchive,
  FileText,
  FileSpreadsheet,
  FileCheck,
  FileCode,
  Image as ImageIcon,
  File,
  UploadCloud,
  Search,
  Plus,
  Filter,
  Download,
  ExternalLink,
  Eye,
  Trash2,
  Edit3,
  Copy,
  Check,
  Calendar,
  User,
  Users,
  Shield,
  ShieldAlert,
  Lock,
  Globe,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List as ListIcon,
  RefreshCw,
  Sparkles,
  Info,
  ChevronRight,
  ArrowUpDown,
  HardDrive,
  PieChart,
  BarChart2
} from "lucide-react";

const CATEGORY_ICONS = {
  Events: Calendar,
  Budgets: FileSpreadsheet,
  Permissions: FileCheck,
  Guidance: FileText
};

const CATEGORY_COLORS = {
  Events: {
    badge: "text-indigo-400 bg-indigo-400/10 border-indigo-400/30",
    dot: "bg-indigo-400",
    border: "border-indigo-500/30"
  },
  Budgets: {
    badge: "text-[#27a644] bg-[#27a644]/10 border-[#27a644]/30",
    dot: "bg-[#27a644]",
    border: "border-[#27a644]/30"
  },
  Permissions: {
    badge: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    dot: "bg-amber-400",
    border: "border-amber-400/30"
  },
  Guidance: {
    badge: "text-[#e4f222] bg-[#e4f222]/10 border-[#e4f222]/30",
    dot: "bg-[#e4f222]",
    border: "border-[#e4f222]/30"
  }
};

function getCategoryBadgeClass(category, isDark = true) {
  if (isDark) {
    const map = {
      Events: "text-indigo-400 bg-indigo-400/10 border-indigo-400/30",
      Budgets: "text-[#27a644] bg-[#27a644]/10 border-[#27a644]/30",
      Permissions: "text-amber-400 bg-amber-400/10 border-amber-400/30",
      Guidance: "text-[#e4f222] bg-[#e4f222]/10 border-[#e4f222]/30",
    };
    return map[category] || map.Guidance;
  }
  const map = {
    Events: "text-indigo-700 bg-indigo-50 border-indigo-200",
    Budgets: "text-emerald-700 bg-emerald-50 border-emerald-200",
    Permissions: "text-amber-700 bg-amber-50 border-amber-200",
    Guidance: "text-yellow-800 bg-yellow-50 border-yellow-200",
  };
  return map[category] || map.Guidance;
}

function getTypeBadgeStyle(type, isDark = true) {
  if (isDark) {
    const map = {
      PDF: { color: "text-[#eb5757]", bg: "bg-[#eb5757]/10", border: "border-[#eb5757]/25" },
      Word: { color: "text-indigo-400", bg: "bg-indigo-400/10", border: "border-indigo-400/25" },
      Image: { color: "text-[#02b8cc]", bg: "bg-[#02b8cc]/10", border: "border-[#02b8cc]/25" },
      Archive: { color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/25" },
      Other: { color: "text-[#8a8f98]", bg: "bg-[#161718]", border: "border-[#23252a]" },
    };
    return map[type] || map.Other;
  }
  const map = {
    PDF: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
    Word: { color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200" },
    Image: { color: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-200" },
    Archive: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
    Other: { color: "text-gray-600", bg: "bg-gray-100", border: "border-gray-200" },
  };
  return map[type] || map.Other;
}

const FILE_TYPE_CONFIG = {
  PDF: {
    icon: FileText,
    color: "text-[#eb5757]",
    bg: "bg-[#eb5757]/10",
    border: "border-[#eb5757]/25",
    label: "PDF Document"
  },
  Word: {
    icon: FileCode,
    color: "text-indigo-400",
    bg: "bg-indigo-400/10",
    border: "border-indigo-400/25",
    label: "Word Document"
  },
  Image: {
    icon: ImageIcon,
    color: "text-[#02b8cc]",
    bg: "bg-[#02b8cc]/10",
    border: "border-[#02b8cc]/25",
    label: "Image / Flyer"
  },
  Archive: {
    icon: FileArchive,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/25",
    label: "Archive (.zip, .7z)"
  },
  Other: {
    icon: File,
    color: "text-[#8a8f98]",
    bg: "bg-[#161718]",
    border: "border-[#23252a]",
    label: "File"
  }
};

function getDocTypeInfo(doc, isDark = true) {
  if (!doc) {
    const style = getTypeBadgeStyle("Other", isDark);
    return { type: "Other", config: { ...FILE_TYPE_CONFIG.Other, ...style } };
  }
  let type = "Other";
  if (doc.file_type === "Archive" || (doc.file_type && FILE_TYPE_CONFIG[doc.file_type] && doc.file_type !== "Other")) {
    type = doc.file_type;
  } else {
    const ext = (doc.file_name || "").split(".").pop()?.toLowerCase();
    if (ext === "zip" || ext === "7z") {
      type = "Archive";
    } else {
      type = doc.file_type || "Other";
    }
  }
  const baseConfig = FILE_TYPE_CONFIG[type] || FILE_TYPE_CONFIG.Other;
  const style = getTypeBadgeStyle(type, isDark);
  return { type, config: { ...baseConfig, ...style } };
}

const INITIAL_FORM = {
  name: "",
  category: "Events",
  visibility: "public_to_members",
  eventId: "",
  stId: "",
  description: ""
};

export default function Documents({
  isAdmin = false,
  role = "member",
  session,
  onNavigate,
  docAccessMembers: propDocAccessMembers,
  setDocAccessMembers: propSetDocAccessMembers,
  theme
}) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (theme) return theme;
    if (typeof document !== "undefined") {
      return document.documentElement.getAttribute("data-theme") || 
             (document.documentElement.classList.contains("dark") ? "dark" : "light");
    }
    return "dark";
  });

  useEffect(() => {
    if (theme) setCurrentTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const observer = new MutationObserver(() => {
      const isDocDark = document.documentElement.classList.contains("dark") || 
                        document.documentElement.getAttribute("data-theme") === "dark";
      setCurrentTheme(isDocDark ? "dark" : "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  const isDark = currentTheme === "dark";
  const isOfficer = isAdmin; // Only admin or editor can upload, edit, and delete

  // Data states
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventsList, setEventsList] = useState([]);
  const [membersList, setMembersList] = useState([]);
  const [allMembersList, setAllMembersList] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Document Member Access Control (Admin-selected members with granular categories)
  const [docAccessMap, setDocAccessMap] = useState(() => normalizeDocAccessMap(propDocAccessMembers));
  const [accessSettingsLoaded, setAccessSettingsLoaded] = useState(
    Boolean(propDocAccessMembers && Object.keys(normalizeDocAccessMap(propDocAccessMembers)).length > 0)
  );
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessSearch, setAccessSearch] = useState("");
  const [tempAccessMap, setTempAccessMap] = useState({});
  const [savingAccess, setSavingAccess] = useState(false);

  // Category counts and storage sizes
  const [categoryCounts, setCategoryCounts] = useState({
    All: 0,
    Events: 0,
    Budgets: 0,
    Permissions: 0,
    Guidance: 0
  });
  const [totalStorageBytes, setTotalStorageBytes] = useState(0);
  const [categorySizes, setCategorySizes] = useState({
    All: 0,
    Events: 0,
    Budgets: 0,
    Permissions: 0,
    Guidance: 0
  });
  const [typeSizes, setTypeSizes] = useState({
    PDF: 0,
    Word: 0,
    Image: 0,
    Archive: 0,
    Other: 0
  });
  const [showStorageBreakdown, setShowStorageBreakdown] = useState(false);

  // Filters & views
  const [selectedFolder, setSelectedFolder] = useState("All");
  const [search, setSearch] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
  const [sortBy, setSortBy] = useState("newest"); // "newest", "oldest", "name", "size"

  // Modals & form state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const [activeDoc, setActiveDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [r2ConfigStatus, setR2ConfigStatus] = useState(null);

  // Check R2 status on mount
  useEffect(() => {
    checkR2Config().then(status => {
      setR2ConfigStatus(status);
    }).catch(() => {});
  }, []);

  // Fetch linked events and members for dropdowns and access modal
  useEffect(() => {
    async function loadRelations() {
      try {
        const [eventRes, memberRes, allMemRes, profRes] = await Promise.all([
          supabase.from("events").select("event_id, name, date").order("date", { ascending: false }).limit(100),
          supabase.from("members").select("st_id, name").order("name").limit(100),
          supabase.from("members").select("st_id, name, level, email").order("name"),
          supabase.from("profiles").select("id, email, full_name, preferred_name, st_id, role")
        ]);
        if (eventRes.data) setEventsList(eventRes.data);
        if (memberRes.data) setMembersList(memberRes.data);

        // Merge members roster and profiles so all members and registered users can be granted access
        const memberMap = new Map();
        (allMemRes.data || []).forEach(m => {
          const key = (m.st_id || m.email || "").trim().toUpperCase();
          if (key) {
            memberMap.set(key, {
              st_id: m.st_id || "",
              name: m.name || "",
              level: m.level || "",
              email: m.email || "",
              idKey: m.st_id || m.email || ""
            });
          }
        });
        (profRes.data || []).forEach(p => {
          const key = (p.st_id || p.email || "").trim().toUpperCase();
          if (key) {
            const existing = memberMap.get(key) || {};
            memberMap.set(key, {
              st_id: p.st_id || existing.st_id || "",
              name: existing.name || p.preferred_name || p.full_name || p.email,
              level: existing.level || "",
              email: p.email || existing.email || "",
              role: p.role || "member",
              idKey: p.st_id || existing.st_id || p.email || ""
            });
          }
        });
        setAllMembersList(Array.from(memberMap.values()).sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      } catch (err) {
        console.warn("Could not load relation dropdowns:", err);
      }
    }
    loadRelations();
  }, []);

  // Load document access member permissions from system_settings
  useEffect(() => {
    async function loadAccessSettings() {
      try {
        const { data } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "document_access_members")
          .maybeSingle();

        if (data?.value) {
          try {
            const parsed = JSON.parse(data.value);
            const normalized = normalizeDocAccessMap(parsed);
            setDocAccessMap(normalized);
            if (propSetDocAccessMembers) propSetDocAccessMembers(normalized);
          } catch (_) {}
        }
      } catch (err) {
        console.warn("Could not load document access settings:", err);
      } finally {
        setAccessSettingsLoaded(true);
      }
    }

    if (!propDocAccessMembers || Object.keys(normalizeDocAccessMap(propDocAccessMembers)).length === 0) {
      loadAccessSettings();
    } else {
      const normalized = normalizeDocAccessMap(propDocAccessMembers);
      setDocAccessMap(normalized);
      setAccessSettingsLoaded(true);
    }
  }, [propDocAccessMembers]);

  // Determine permitted categories for current user
  const userPermittedCategories = useMemo(() => {
    if (isOfficer) return ALL_CATEGORY_IDS;
    return getMemberDocCategories(session?.stId, session?.email, docAccessMap);
  }, [isOfficer, session?.stId, session?.email, docAccessMap]);

  const isAuthorized = isOfficer || userPermittedCategories.length > 0;

  // Auto-reset folder if selected folder is not permitted for this member
  useEffect(() => {
    if (!isOfficer && selectedFolder !== "All" && !userPermittedCategories.includes(selectedFolder)) {
      setSelectedFolder("All");
    }
  }, [isOfficer, userPermittedCategories, selectedFolder]);

  // Load documents and category counts
  const loadDocuments = async (pageToLoad = page) => {
    setLoading(true);
    try {
      if (!isOfficer && userPermittedCategories.length === 0) {
        setDocuments([]);
        setTotalCount(0);
        setCategoryCounts({ All: 0, Events: 0, Budgets: 0, Permissions: 0, Guidance: 0 });
        setCategorySizes({ All: 0, Events: 0, Budgets: 0, Permissions: 0, Guidance: 0 });
        setTypeSizes({ PDF: 0, Word: 0, Image: 0, Archive: 0, Other: 0 });
        setTotalStorageBytes(0);
        setLoading(false);
        return;
      }

      // 1. Fetch category counts and storage sizes
      let countsQuery = supabase.from("documents").select("category, visibility, file_size, file_type");
      if (!isOfficer) {
        countsQuery = countsQuery.in("category", userPermittedCategories);
      }
      const countsRes = await countsQuery;
      if (countsRes.data) {
        const counts = { All: 0, Events: 0, Budgets: 0, Permissions: 0, Guidance: 0 };
        const sizes = { All: 0, Events: 0, Budgets: 0, Permissions: 0, Guidance: 0 };
        const tSizes = { PDF: 0, Word: 0, Image: 0, Archive: 0, Other: 0 };
        let totalBytes = 0;

        countsRes.data.forEach(d => {
          // If not officer and doc is officers_only, skip in count
          if (!isOfficer && d.visibility === "officers_only") return;
          if (!isOfficer && !userPermittedCategories.includes(d.category)) return;

          const sz = Number(d.file_size) || 0;
          totalBytes += sz;
          counts.All += 1;
          sizes.All += sz;

          if (counts[d.category] !== undefined) {
            counts[d.category] += 1;
            sizes[d.category] = (sizes[d.category] || 0) + sz;
          }

          const ft = d.file_type || "Other";
          if (tSizes[ft] !== undefined) {
            tSizes[ft] += sz;
          } else {
            tSizes.Other = (tSizes.Other || 0) + sz;
          }
        });

        setCategoryCounts(counts);
        setCategorySizes(sizes);
        setTypeSizes(tSizes);
        setTotalStorageBytes(totalBytes);
      }

      // 2. Query documents with filters
      // Note: We intentionally query documents table directly without PostgREST foreign key embedding
      // to prevent "Could not embed because more than one relationship was found" errors.
      const from = pageToLoad * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("documents")
        .select("*", { count: "exact" });

      // Non-officers only query categories they are permitted to view
      if (!isOfficer) {
        query = query.in("category", userPermittedCategories);
      }

      // Category / Folder filter
      if (selectedFolder !== "All") {
        query = query.eq("category", selectedFolder);
      }

      // Search filter
      const q = search.trim();
      if (q) {
        query = query.or(`name.ilike.%${q}%,file_name.ilike.%${q}%,description.ilike.%${q}%,uploader_name.ilike.%${q}%`);
      }

      // File type filter
      if (fileTypeFilter !== "ALL") {
        if (fileTypeFilter === "Archive") {
          query = query.or("file_type.eq.Archive,file_name.ilike.%.zip,file_name.ilike.%.7z");
        } else {
          query = query.eq("file_type", fileTypeFilter);
        }
      }

      // Date filter
      if (dateFilter === "7d") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        query = query.gte("created_at", d.toISOString());
      } else if (dateFilter === "30d") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        query = query.gte("created_at", d.toISOString());
      } else if (dateFilter === "year") {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
        query = query.gte("created_at", startOfYear);
      }

      // Sorting
      if (sortBy === "newest") {
        query = query.order("created_at", { ascending: false });
      } else if (sortBy === "oldest") {
        query = query.order("created_at", { ascending: true });
      } else if (sortBy === "name") {
        query = query.order("name", { ascending: true });
      } else if (sortBy === "size") {
        query = query.order("file_size", { ascending: false });
      }

      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) {
        console.error("Error loading documents:", error);
        setFeedbackMsg({ type: "error", text: `Failed to load documents: ${error.message}` });
      } else {
        const rawDocs = data || [];
        if (rawDocs.length > 0) {
          // Resolve linked events and members safely using batch query
          const eventIds = [...new Set(rawDocs.map(d => d.event_id).filter(Boolean))];
          const stIds = [...new Set(rawDocs.map(d => d.st_id).filter(Boolean))];

          const [eventsRes, membersRes] = await Promise.all([
            eventIds.length > 0
              ? supabase.from("events").select("event_id, name, date").in("event_id", eventIds)
              : { data: [] },
            stIds.length > 0
              ? supabase.from("members").select("st_id, name").in("st_id", stIds)
              : { data: [] }
          ]);

          const evMap = {};
          (eventsRes.data || []).forEach(e => { evMap[e.event_id] = e; });
          const memMap = {};
          (membersRes.data || []).forEach(m => { memMap[m.st_id] = m; });

          const enriched = rawDocs.map(d => ({
            ...d,
            event: d.event_id ? evMap[d.event_id] || null : null,
            member: d.st_id ? memMap[d.st_id] || null : null
          }));

          setDocuments(enriched);
        } else {
          setDocuments([]);
        }
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error("Load documents error:", err);
      setFeedbackMsg({ type: "error", text: "Network or database connection error." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments(page);
  }, [page, selectedFolder, fileTypeFilter, dateFilter, sortBy, isOfficer, userPermittedCategories]);

  // Handle Search submit / reset
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    loadDocuments(0);
  };

  // Handle file selection in Upload Modal
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type, single file size limit (25 MB), and total repository quota (9 GB ceiling)
    const validation = validateDocumentFile(file, totalStorageBytes);
    if (!validation.valid) {
      setFileError(validation.error);
      setSelectedFile(null);
      return;
    }

    setFileError(null);
    setSelectedFile(file);

    // Auto-fill title from filename if title is empty
    if (!form.name) {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setForm(prev => ({ ...prev, name: cleanTitle }));
    }
  };

  // Upload handler
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setFileError("Please select a file to upload.");
      return;
    }

    // Double check 9 GB repository quota
    const quota = validateStorageQuota(totalStorageBytes, selectedFile.size);
    if (!quota.valid) {
      setFileError(quota.error);
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(20);
    setFeedbackMsg(null);

    try {
      setUploadProgress(50);
      await uploadDocument({
        file: selectedFile,
        name: form.name || selectedFile.name,
        category: form.category,
        description: form.description,
        visibility: form.visibility,
        eventId: form.eventId || null,
        stId: form.stId || null,
        session,
        currentTotalBytes: totalStorageBytes
      });

      setUploadProgress(100);
      setFeedbackMsg({ type: "success", text: `Document "${form.name || selectedFile.name}" uploaded successfully!` });
      setUploadModalOpen(false);
      setForm(INITIAL_FORM);
      setSelectedFile(null);
      setPage(0);
      loadDocuments(0);
    } catch (err) {
      console.error("Upload error:", err);
      setFeedbackMsg({ type: "error", text: err.message || "Failed to upload document." });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  // Open / Preview document handler
  const handlePreviewDocument = async (doc) => {
    setActiveDoc(doc);
    setPreviewLoading(true);
    setPreviewModalOpen(true);
    setPreviewUrl(null);

    try {
      const { downloadUrl } = await getDocumentSignedUrl(doc.id, doc.r2_key);
      setPreviewUrl(downloadUrl);
    } catch (err) {
      console.error("Preview URL error:", err);
      setFeedbackMsg({ type: "error", text: err.message || "Unable to retrieve document preview." });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Download document handler
  const handleDownloadDocument = async (doc) => {
    try {
      setFeedbackMsg({ type: "info", text: `Downloading "${doc.name}"...` });
      await downloadDocumentFile(doc);
      setFeedbackMsg({ type: "success", text: `Download started for "${doc.name}".` });
    } catch (err) {
      console.error("Download error:", err);
      setFeedbackMsg({ type: "error", text: err.message || "Failed to download document." });
    }
  };

  // Copy signed link handler
  const handleCopyLink = async (doc) => {
    try {
      const { downloadUrl } = await getDocumentSignedUrl(doc.id, doc.r2_key);
      await navigator.clipboard.writeText(downloadUrl);
      setCopiedId(doc.id);
      setTimeout(() => setCopiedId(null), 2500);
      setFeedbackMsg({
        type: "success",
        text: `Secure 1-hour access link copied to clipboard!`
      });
    } catch (err) {
      console.error("Copy link error:", err);
      setFeedbackMsg({ type: "error", text: "Failed to generate copy link." });
    }
  };

  // Edit metadata handler
  const handleEditClick = (doc) => {
    setActiveDoc(doc);
    setForm({
      name: doc.name,
      category: doc.category,
      visibility: doc.visibility,
      eventId: doc.event_id || "",
      stId: doc.st_id || "",
      description: doc.description || ""
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!activeDoc) return;

    setIsSubmitting(true);
    try {
      await updateDocumentMetadata(activeDoc.id, {
        name: form.name,
        category: form.category,
        visibility: form.visibility,
        event_id: form.eventId,
        st_id: form.stId,
        description: form.description
      });

      setFeedbackMsg({ type: "success", text: "Document details updated successfully." });
      setEditModalOpen(false);
      setActiveDoc(null);
      loadDocuments(page);
    } catch (err) {
      setFeedbackMsg({ type: "error", text: err.message || "Failed to update document." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete document handler
  const handleDeleteClick = (doc) => {
    setActiveDoc(doc);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!activeDoc) return;
    setIsSubmitting(true);

    try {
      await deleteDocument(activeDoc.id, activeDoc.r2_key);
      setFeedbackMsg({ type: "success", text: `Document "${activeDoc.name}" deleted from R2 and database.` });
      setDeleteModalOpen(false);
      setActiveDoc(null);
      loadDocuments(page);
    } catch (err) {
      setFeedbackMsg({ type: "error", text: err.message || "Failed to delete document." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Member Access Management Handlers (Granular per-category permissions)
  const toggleMemberCategory = (member, catId) => {
    const memberKey = (member?.st_id || member?.email || member?.idKey || "").trim();
    if (!memberKey) return;

    setTempAccessMap(prev => {
      const copy = { ...prev };
      const stId = (member.st_id || "").trim().toUpperCase();
      const email = (member.email || "").trim().toLowerCase();
      let matchedKey = memberKey;
      let existingCats = [];

      for (const [k, cats] of Object.entries(copy)) {
        const kTrim = k.trim();
        if (
          (stId && kTrim.toUpperCase() === stId) ||
          (email && kTrim.toLowerCase() === email) ||
          (kTrim.toUpperCase() === memberKey.toUpperCase())
        ) {
          matchedKey = k;
          existingCats = Array.isArray(cats) ? [...cats] : [];
          break;
        }
      }

      let updatedCats;
      if (existingCats.includes(catId)) {
        updatedCats = existingCats.filter(c => c !== catId);
      } else {
        updatedCats = [...existingCats, catId];
      }

      if (updatedCats.length === 0) {
        delete copy[matchedKey];
      } else {
        copy[matchedKey] = updatedCats;
      }
      return copy;
    });
  };

  const toggleMemberAllCategories = (member) => {
    const memberKey = (member?.st_id || member?.email || member?.idKey || "").trim();
    if (!memberKey) return;

    setTempAccessMap(prev => {
      const copy = { ...prev };
      const stId = (member.st_id || "").trim().toUpperCase();
      const email = (member.email || "").trim().toLowerCase();
      let matchedKey = memberKey;
      let existingCats = [];

      for (const [k, cats] of Object.entries(copy)) {
        const kTrim = k.trim();
        if (
          (stId && kTrim.toUpperCase() === stId) ||
          (email && kTrim.toLowerCase() === email) ||
          (kTrim.toUpperCase() === memberKey.toUpperCase())
        ) {
          matchedKey = k;
          existingCats = Array.isArray(cats) ? [...cats] : [];
          break;
        }
      }

      if (existingCats.length > 0) {
        delete copy[matchedKey];
      } else {
        copy[matchedKey] = [...ALL_CATEGORY_IDS];
      }
      return copy;
    });
  };

  const setFilteredMembersCategories = (categories) => {
    setTempAccessMap(prev => {
      const copy = { ...prev };
      filteredAccessMembers.forEach(m => {
        const memberKey = (m.st_id || m.email || m.idKey || "").trim();
        if (!memberKey) return;
        const stId = (m.st_id || "").trim().toUpperCase();
        const email = (m.email || "").trim().toLowerCase();
        let matchedKey = memberKey;
        for (const k of Object.keys(copy)) {
          const kTrim = k.trim();
          if ((stId && kTrim.toUpperCase() === stId) || (email && kTrim.toLowerCase() === email)) {
            matchedKey = k;
            break;
          }
        }
        if (!categories || categories.length === 0) {
          delete copy[matchedKey];
        } else {
          copy[matchedKey] = [...categories];
        }
      });
      return copy;
    });
  };

  const filteredAccessMembers = useMemo(() => {
    const q = accessSearch.trim().toLowerCase();
    if (!q) return allMembersList;
    return allMembersList.filter(
      m => (m.name || "").toLowerCase().includes(q) || (m.st_id || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q)
    );
  }, [allMembersList, accessSearch]);

  const handleClearAll = () => {
    setTempAccessMap({});
  };

  const saveMemberAccess = async () => {
    setSavingAccess(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .upsert({
          key: "document_access_members",
          value: JSON.stringify(tempAccessMap)
        }, { onConflict: "key" });

      if (error) throw error;

      setDocAccessMap(tempAccessMap);
      if (propSetDocAccessMembers) propSetDocAccessMembers(tempAccessMap);
      const authorizedCount = Object.keys(tempAccessMap).length;
      setFeedbackMsg({
        type: "success",
        text: `Updated document access: ${authorizedCount} member(s) configured.`
      });
      setAccessModalOpen(false);
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "Failed to save member access: " + err.message });
    } finally {
      setSavingAccess(false);
    }
  };

  // If user is a member but NOT in the admin-selected list:
  if (accessSettingsLoaded && !isAuthorized) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-[#08090a] text-white" : "bg-gray-50/50 text-gray-900"} p-4 md:p-8 font-inter flex items-center justify-center`}>
        <div className={`${isDark ? "bg-[#0f1011] border-[#23252a] shadow-2xl" : "bg-white border-gray-200 shadow-xl"} border rounded-[12px] p-8 max-w-md w-full text-center`}>
          <div className={`w-12 h-12 rounded-full ${isDark ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-600"} border flex items-center justify-center mx-auto mb-4`}>
            <Lock className="w-6 h-6" />
          </div>
          <h2 className={`text-lg font-[510] ${isDark ? "text-white" : "text-gray-900"} mb-2`}>Document Section Restricted</h2>
          <p className={`text-xs ${isDark ? "text-[#8a8f98]" : "text-gray-600"} leading-relaxed mb-6`}>
            The society Document Repository is currently accessible only to administrator-selected members and officers. Your account {session?.stId ? `(${session.stId})` : ""} has not been granted document access yet.
          </p>
          <div className={`p-3 ${isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-50 border-gray-200 text-gray-600"} border rounded-[8px] text-[11px] font-berkeley-mono mb-6 text-left space-y-1`}>
            <div>User: {session?.name || session?.email}</div>
            <div>Role: {role}</div>
            <div>Access Status: Not in Authorized Member List</div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate(role === "member" ? "attendance" : "dashboard")}
              className={`w-full h-9 rounded-[6px] ${isDark ? "bg-[#e4f222] hover:bg-[#d5e31d] text-black" : "bg-indigo-600 hover:bg-indigo-700 text-white"} font-[510] text-xs transition-colors shadow-xs`}
            >
              Back to Portal
            </button>
          )}
        </div>
      </div>
    );
  }

  const storagePercent = Math.min(100, (totalStorageBytes / MAX_TOTAL_STORAGE_BYTES) * 100);
  const remainingStorageBytes = Math.max(0, MAX_TOTAL_STORAGE_BYTES - totalStorageBytes);
  const isStorageCritical = storagePercent >= 90 && storagePercent < 100;
  const isStorageFull = totalStorageBytes >= MAX_TOTAL_STORAGE_BYTES;

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#08090a] text-white" : "bg-gray-50/50 text-gray-900"} p-4 md:p-6 font-inter`}>
      {/* ── Page Header (Compact) ──────────────────────────────────────────────── */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b ${isDark ? "border-[#23252a]" : "border-gray-200"}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`w-7 h-7 rounded-[6px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#e4f222]" : "bg-amber-50 border-amber-200 text-amber-600"} border flex items-center justify-center flex-shrink-0`}>
              <FolderArchive className="w-4 h-4" />
            </div>
            <h1 className={`text-base sm:text-lg font-[590] tracking-tight ${isDark ? "text-white" : "text-gray-900"} flex items-center gap-2 truncate`}>
              Document Repository
              <span className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98] bg-[#161718] border-[#23252a]" : "text-gray-600 bg-gray-100 border-gray-200"} border px-1.5 py-0.5 rounded-[4px]`}>
                {totalCount} {totalCount === 1 ? "file" : "files"}
              </span>
              <span
                className={`text-[10px] font-berkeley-mono px-1.5 py-0.5 rounded-[4px] border ${
                  isStorageFull
                    ? isDark ? "text-[#eb5757] bg-[#eb5757]/10 border-[#eb5757]/30" : "text-red-700 bg-red-50 border-red-200"
                    : isStorageCritical
                    ? isDark ? "text-amber-400 bg-amber-400/10 border-amber-400/30" : "text-amber-700 bg-amber-50 border-amber-200"
                    : isDark ? "text-[#e4f222] bg-[#161718] border-[#23252a]" : "text-emerald-700 bg-emerald-50 border-emerald-200"
                }`}
                title="Current repository storage usage out of 9 GB capacity"
              >
                {formatBytes(totalStorageBytes, 2)} / 9.0 GB ({storagePercent.toFixed(1)}%)
              </span>
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] ${isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-100 border-gray-200 text-gray-600"} border font-berkeley-mono text-[9px]`}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#27a644]" />
              Cloudflare R2
            </span>
          </div>
          <p className={`text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} mt-1 truncate`}>
            Official repository for society flyers, budget reports, permission letters, and guidance manuals.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => loadDocuments(page)}
            className={`h-8 px-2.5 rounded-[6px] border text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
              isDark
                ? "bg-[#161718] border-[#23252a] hover:border-[#383b3f] text-[#8a8f98] hover:text-white"
                : "bg-white border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 shadow-xs"
            }`}
            title="Refresh repository"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          {isOfficer && (
            <>
              <button
                onClick={() => {
                  setTempAccessMap({ ...docAccessMap });
                  setAccessSearch("");
                  setAccessModalOpen(true);
                }}
                className={`h-8 px-2.5 rounded-[6px] border text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                  isDark
                    ? "bg-[#161718] border-[#23252a] hover:border-[#383b3f] text-[#d0d6e0] hover:text-white"
                    : "bg-white border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 shadow-xs"
                }`}
                title="Select which members can view and access the Document section"
              >
                <Users className={`w-3.5 h-3.5 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                <span>Selected Members</span>
                <span className={`text-[9px] font-berkeley-mono px-1.5 py-0.2 rounded border ${
                  isDark ? "text-[#e4f222] bg-[#0f1011] border-[#23252a]" : "text-indigo-600 bg-indigo-50 border-indigo-200"
                }`}>
                  {Object.keys(docAccessMap).length}
                </span>
              </button>

              <button
                disabled={isStorageFull}
                onClick={() => {
                  if (isStorageFull) return;
                  setForm(INITIAL_FORM);
                  setSelectedFile(null);
                  setFileError(null);
                  setUploadModalOpen(true);
                }}
                className={`h-8 px-3 rounded-[6px] font-[510] transition-colors flex items-center gap-1.5 text-[11px] shadow-sm hover:shadow ${
                  isStorageFull
                    ? isDark ? "bg-[#23252a] text-[#8a8f98] cursor-not-allowed opacity-60" : "bg-gray-200 text-gray-400 cursor-not-allowed opacity-60"
                    : isDark ? "bg-[#e4f222] hover:bg-[#d5e31d] text-black" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                }`}
                title={isStorageFull ? "Storage limit reached (9 GB). Please delete files to upload." : "Upload Document"}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isStorageFull ? "Storage Full (9 GB)" : "Upload Document"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Feedback Message Banner ────────────────────────────────────────────── */}
      {feedbackMsg && (
        <div
          className={`mb-3.5 p-2.5 rounded-[6px] flex items-center justify-between gap-3 text-xs border ${
            feedbackMsg.type === "error"
              ? isDark ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" : "bg-red-50 border-red-200 text-red-700"
              : feedbackMsg.type === "success"
              ? isDark ? "bg-[#27a644]/10 border-[#27a644]/30 text-[#27a644]" : "bg-emerald-50 border-emerald-200 text-emerald-700"
              : isDark ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" : "bg-indigo-50 border-indigo-200 text-indigo-700"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === "error" ? (
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            ) : feedbackMsg.type === "success" ? (
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            ) : (
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-current hover:opacity-75 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Storage Limit Full Warning ────────────────────────────────────────── */}
      {isStorageFull && (
        <div className={`mb-3.5 p-3 rounded-[6px] border text-xs flex items-center justify-between gap-3 shadow-sm ${
          isDark ? "bg-[#eb5757]/15 border-[#eb5757]/40 text-[#eb5757]" : "bg-red-50 border-red-200 text-red-700"
        }`}>
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <div>
              <span className="font-semibold">Storage Limit Reached (9.0 GB / 9.0 GB): </span>
              <span>The repository has reached its maximum 9 GB capacity. Document uploads are paused until existing files are deleted.</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Storage Near Capacity Warning ─────────────────────────────────────── */}
      {!isStorageFull && isStorageCritical && (
        <div className={`mb-3.5 p-3 rounded-[6px] border text-xs flex items-center justify-between gap-3 ${
          isDark ? "bg-amber-400/10 border-amber-400/30 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-700"
        }`}>
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <div>
              <span className="font-semibold">Storage Space Low: </span>
              <span>Repository is at {storagePercent.toFixed(1)}% of the 9 GB limit ({formatBytes(remainingStorageBytes, 2)} remaining).</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Cloudflare R2 Configuration Status Alert (if not yet configured) ───── */}
      {r2ConfigStatus && !r2ConfigStatus.configured && (
        <div className={`mb-3.5 p-3 rounded-[6px] border text-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5 ${
          isDark ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800"
        }`}>
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold">Cloudflare R2 Storage Setup: </span>
              <span className={isDark ? "text-amber-300/80" : "text-amber-700"}>
                Configure R2 credentials in Supabase Secrets to enable file uploads.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Storage Meter & Size Breakdown Panel (How full + 9 GB Limit) ───────── */}
      <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xs"} border rounded-[8px] p-3 mb-3.5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-[5px] flex items-center justify-center border ${
              isStorageFull
                ? isDark ? "bg-[#eb5757]/15 border-[#eb5757]/40 text-[#eb5757]" : "bg-red-50 border-red-200 text-red-600"
                : isStorageCritical
                ? isDark ? "bg-amber-400/15 border-amber-400/30 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-600"
                : isDark ? "bg-[#161718] border-[#23252a] text-[#e4f222]" : "bg-indigo-50 border-indigo-200 text-indigo-600"
            }`}>
              <HardDrive className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>Repository Storage</span>
                <span className={`text-[9px] font-berkeley-mono px-1.5 py-0.2 rounded-[3px] border uppercase tracking-wider ${
                  isStorageFull
                    ? isDark ? "bg-[#eb5757]/15 text-[#eb5757] border-[#eb5757]/30 font-semibold" : "bg-red-50 text-red-700 border-red-200 font-semibold"
                    : isStorageCritical
                    ? isDark ? "bg-amber-400/15 text-amber-300 border-amber-400/30" : "bg-amber-50 text-amber-700 border-amber-200"
                    : isDark ? "bg-[#27a644]/15 text-[#27a644] border-[#27a644]/30" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}>
                  {isStorageFull ? "Full (9 GB Reached)" : isStorageCritical ? "Running Low (>90%)" : `${storagePercent.toFixed(1)}% Full`}
                </span>
              </div>
              <p className={`text-[10px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"} font-berkeley-mono mt-0.5`}>
                {formatBytes(totalStorageBytes, 2)} of 9.0 GB used • {formatBytes(remainingStorageBytes, 2)} available
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setShowStorageBreakdown(!showStorageBreakdown)}
              className={`h-7 px-2.5 rounded-[5px] border text-[10px] font-medium transition-colors flex items-center gap-1.5 ${
                isDark
                  ? "bg-[#161718] border-[#23252a] hover:border-[#383b3f] text-[#8a8f98] hover:text-white"
                  : "bg-white border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 shadow-xs"
              }`}
              title="Show size distribution across categories and file types"
            >
              <PieChart className={`w-3 h-3 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
              <span>{showStorageBreakdown ? "Hide Details" : "Size Breakdown"}</span>
            </button>
          </div>
        </div>

        {/* Visual Multi-Segment Storage Progress Bar */}
        <div className="space-y-1">
          <div className={`w-full h-2 ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"} rounded-full overflow-hidden border flex`}>
            {totalStorageBytes === 0 ? (
              <div className={`h-full w-full ${isDark ? "bg-[#161718]" : "bg-gray-100"}`} />
            ) : (
              ALLOWED_CATEGORIES.map(cat => {
                const catBytes = categorySizes[cat.id] || 0;
                if (!catBytes) return null;
                const widthPct = (catBytes / MAX_TOTAL_STORAGE_BYTES) * 100;
                const colorMap = {
                  Events: "bg-indigo-500",
                  Budgets: "bg-[#27a644]",
                  Permissions: "bg-amber-400",
                  Guidance: isDark ? "bg-[#e4f222]" : "bg-amber-500"
                };
                return (
                  <div
                    key={cat.id}
                    style={{ width: `${Math.max(widthPct, 0.5)}%` }}
                    className={`h-full ${colorMap[cat.id] || (isDark ? "bg-[#8a8f98]" : "bg-gray-400")} transition-all duration-500`}
                    title={`${cat.label}: ${formatBytes(catBytes, 2)}`}
                  />
                );
              })
            )}
          </div>

          {/* Category mini-chips legend */}
          <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1 text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
            <div className="flex flex-wrap items-center gap-3">
              {ALLOWED_CATEGORIES.map(cat => {
                const catBytes = categorySizes[cat.id] || 0;
                const dotMap = {
                  Events: "bg-indigo-400",
                  Budgets: "bg-[#27a644]",
                  Permissions: "bg-amber-400",
                  Guidance: isDark ? "bg-[#e4f222]" : "bg-amber-500"
                };
                return (
                  <div key={cat.id} className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${dotMap[cat.id]}`} />
                    <span className={isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"}>{cat.label}:</span>
                    <span>{formatBytes(catBytes, 1)}</span>
                  </div>
                );
              })}
            </div>
            <div className={`text-[9px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
              Capacity Ceiling: <span className={isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"}>9.0 GB (Hard Limit)</span>
            </div>
          </div>
        </div>

        {/* Expandable Breakdown Drawer */}
        {showStorageBreakdown && (
          <div className={`mt-2.5 pt-2.5 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"} space-y-2 animate-in fade-in duration-200`}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALLOWED_CATEGORIES.map(cat => {
                const catBytes = categorySizes[cat.id] || 0;
                const catCount = categoryCounts[cat.id] || 0;
                const pctOfUsed = totalStorageBytes > 0 ? ((catBytes / totalStorageBytes) * 100).toFixed(1) : 0;
                return (
                  <div key={cat.id} className={`${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border rounded-[6px] p-2`}>
                    <div className={`flex items-center justify-between text-[11px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>
                      <span>{cat.label}</span>
                      <span className={`font-berkeley-mono text-[10px] ${isDark ? "text-[#e4f222]" : "text-indigo-600 font-semibold"}`}>{formatBytes(catBytes, 1)}</span>
                    </div>
                    <div className={`flex items-center justify-between text-[9px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mt-1`}>
                      <span>{catCount} {catCount === 1 ? "file" : "files"}</span>
                      <span>{pctOfUsed}% of used</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={`${isDark ? "bg-[#161718]/60 border-[#23252a]" : "bg-gray-50/80 border-gray-200"} border rounded-[6px] p-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-berkeley-mono`}>
              <span className={isDark ? "text-[#8a8f98]" : "text-gray-500"}>Formats:</span>
              {["PDF", "Word", "Image", "Archive"].map(ft => (
                <div key={ft} className="flex items-center gap-1">
                  <span className={isDark ? "text-white" : "text-gray-900 font-medium"}>{ft}:</span>
                  <span className={isDark ? "text-[#8a8f98]" : "text-gray-500"}>{formatBytes(typeSizes[ft] || 0, 1)}</span>
                </div>
              ))}
              <div className={`${isDark ? "text-[#8a8f98]" : "text-gray-500"} ml-auto text-[9px]`}>
                Single file max: <span className={isDark ? "text-white" : "text-gray-900 font-medium"}>25 MB</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Category / Folder Cards (Compact with Sizes) ────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-3.5">
        <button
          onClick={() => {
            setSelectedFolder("All");
            setPage(0);
          }}
          className={`text-left p-2.5 rounded-[8px] border transition-all ${
            selectedFolder === "All"
              ? isDark
                ? "bg-[#161718] border-[#e4f222] shadow-[0_0_15px_rgba(228,242,34,0.1)]"
                : "bg-indigo-50/70 border-indigo-400 shadow-xs ring-1 ring-indigo-500/20"
              : isDark
              ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f] hover:bg-[#161718]"
              : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <FolderOpen className={`w-3.5 h-3.5 ${selectedFolder === "All" ? (isDark ? "text-[#e4f222]" : "text-indigo-600") : (isDark ? "text-[#8a8f98]" : "text-gray-400")}`} />
            <div className="flex items-center gap-1">
              <span className={`text-[9px] font-berkeley-mono px-1 py-0.2 rounded-[3px] border ${
                isDark ? "text-[#e4f222] bg-[#161718] border-[#23252a]" : "text-indigo-600 bg-white border-gray-200"
              }`}>
                {formatBytes(categorySizes.All || 0)}
              </span>
              <span className={`text-[10px] font-berkeley-mono px-1.5 py-0.2 rounded-[3px] border ${
                isDark ? "text-[#8a8f98] bg-[#161718] border-[#23252a]" : "text-gray-600 bg-white border-gray-200"
              }`}>
                {categoryCounts.All}
              </span>
            </div>
          </div>
          <div className={`text-[11px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>All Documents</div>
          <div className={`text-[9px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"} truncate mt-0.5`}>
            {formatBytes(categorySizes.All || 0)} • {categoryCounts.All} {categoryCounts.All === 1 ? "file" : "files"}
          </div>
        </button>

        {ALLOWED_CATEGORIES
          .filter(cat => isOfficer || userPermittedCategories.includes(cat.id))
          .map(cat => {
            const IconComponent = CATEGORY_ICONS[cat.id] || Folder;
            const isSelected = selectedFolder === cat.id;
            const count = categoryCounts[cat.id] || 0;
            const catSize = categorySizes[cat.id] || 0;

            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedFolder(cat.id);
                  setPage(0);
                }}
                className={`text-left p-2.5 rounded-[8px] border transition-all ${
                  isSelected
                    ? isDark
                      ? "bg-[#161718] border-[#e4f222] shadow-[0_0_15px_rgba(228,242,34,0.1)]"
                      : "bg-indigo-50/70 border-indigo-400 shadow-xs ring-1 ring-indigo-500/20"
                    : isDark
                    ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f] hover:bg-[#161718]"
                    : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <IconComponent className={`w-3.5 h-3.5 ${isSelected ? (isDark ? "text-[#e4f222]" : "text-indigo-600") : (isDark ? "text-[#8a8f98]" : "text-gray-400")}`} />
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-berkeley-mono px-1 py-0.2 rounded-[3px] border ${
                      isDark ? "text-[#8a8f98] bg-[#161718] border-[#23252a]" : "text-gray-600 bg-white border-gray-200"
                    }`}>
                      {formatBytes(catSize)}
                    </span>
                    <span className={`text-[10px] font-berkeley-mono px-1.5 py-0.2 rounded-[3px] border ${
                      isDark ? "text-[#8a8f98] bg-[#161718] border-[#23252a]" : "text-gray-600 bg-white border-gray-200"
                    }`}>
                      {count}
                    </span>
                  </div>
                </div>
                <div className={`text-[11px] font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>{cat.label}</div>
                <div className={`text-[9px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"} truncate mt-0.5`} title={cat.description}>
                  {formatBytes(catSize)} • {count} {count === 1 ? "file" : "files"}
                </div>
              </button>
            );
          })}
      </div>

      {/* ── Search, Filters, and Display Controls (Compact Single Row) ─────────── */}
      <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xs"} border rounded-[8px] p-2 mb-3.5 flex flex-wrap items-center justify-between gap-2`}>
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-60 md:w-72 flex-shrink-0">
          <Search className={`w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 ${isDark ? "text-[#8a8f98]" : "text-gray-400"}`} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, filename, desc..."
            className={`w-full h-7 pl-7 pr-7 text-[11px] rounded-[5px] border transition-colors focus:outline-none ${
              isDark
                ? "bg-[#161718] border-[#23252a] text-white placeholder-[#62666d] focus:border-[#e4f222]"
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 shadow-xs"
            }`}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(0);
                loadDocuments(0);
              }}
              className={`absolute right-2 top-1/2 -translate-y-1/2 ${isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-400 hover:text-gray-600"}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </form>

        {/* Filter controls row */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] ml-auto sm:ml-0">
          {/* File Type Filter */}
          <div className={`flex items-center rounded-[5px] p-0.5 border ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"}`}>
            {["ALL", "PDF", "Word", "Image", "Archive"].map((type) => (
              <button
                key={type}
                onClick={() => {
                  setFileTypeFilter(type);
                  setPage(0);
                }}
                className={`px-2 py-0.5 rounded-[4px] text-[10px] font-medium transition-colors ${
                  fileTypeFilter === type
                    ? isDark ? "bg-[#23252a] text-white" : "bg-white text-gray-900 shadow-xs font-semibold"
                    : isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {type === "ALL" ? "All Types" : type}
              </button>
            ))}
          </div>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(0);
            }}
            className={`h-7 px-2 text-[10px] rounded-[5px] border focus:outline-none ${
              isDark
                ? "bg-[#161718] border-[#23252a] text-[#8a8f98] hover:text-white focus:border-[#e4f222]"
                : "bg-white border-gray-300 text-gray-700 hover:text-gray-900 focus:border-indigo-500 shadow-xs"
            }`}
          >
            <option value="ALL">All Time</option>
            <option value="7d">Past 7 Days</option>
            <option value="30d">Past 30 Days</option>
            <option value="year">This Year</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(0);
            }}
            className={`h-7 px-2 text-[10px] rounded-[5px] border focus:outline-none ${
              isDark
                ? "bg-[#161718] border-[#23252a] text-[#8a8f98] hover:text-white focus:border-[#e4f222]"
                : "bg-white border-gray-300 text-gray-700 hover:text-gray-900 focus:border-indigo-500 shadow-xs"
            }`}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Title (A-Z)</option>
            <option value="size">Size (Largest)</option>
          </select>

          {/* View Mode Toggle */}
          <div className={`flex items-center rounded-[5px] p-0.5 border ${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-100 border-gray-200"}`}>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1 rounded-[4px] transition-colors ${
                viewMode === "grid"
                  ? isDark ? "bg-[#23252a] text-white" : "bg-white text-gray-900 shadow-xs"
                  : isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900"
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1 rounded-[4px] transition-colors ${
                viewMode === "list"
                  ? isDark ? "bg-[#23252a] text-white" : "bg-white text-gray-900 shadow-xs"
                  : isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900"
              }`}
              title="List view"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Document List / Grid ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-24 text-center">
          <div className={`w-8 h-8 border-2 ${isDark ? "border-[#23252a] border-t-[#e4f222]" : "border-gray-200 border-t-indigo-600"} rounded-full animate-spin mx-auto mb-3`} />
          <p className={`text-xs ${isDark ? "text-[#8a8f98]" : "text-gray-500"} font-berkeley-mono`}>Connecting to Cloudflare R2 &amp; Postgres...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className={`py-16 px-4 text-center border border-dashed rounded-[12px] ${isDark ? "border-[#23252a] bg-[#0f1011]" : "border-gray-200 bg-white shadow-xs"}`}>
          <FolderOpen className={`w-10 h-10 ${isDark ? "text-[#62666d]" : "text-gray-400"} mx-auto mb-3`} />
          <h3 className={`text-sm font-[510] ${isDark ? "text-white" : "text-gray-900"} mb-1`}>No documents found</h3>
          <p className={`text-xs ${isDark ? "text-[#8a8f98]" : "text-gray-600"} max-w-md mx-auto mb-4`}>
            {search || selectedFolder !== "All" || fileTypeFilter !== "ALL"
              ? "No files matched your active search or filter criteria. Try resetting your filters."
              : "No documents have been uploaded to this category yet."}
          </p>
          {isOfficer && (
            <button
              onClick={() => {
                setForm(prev => ({ ...prev, category: selectedFolder === "All" ? "Events" : selectedFolder }));
                setUploadModalOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] ${isDark ? "bg-[#e4f222] text-black" : "bg-indigo-600 text-white shadow-xs"} text-xs font-[510]`}
            >
              <Plus className="w-3.5 h-3.5" />
              Upload First File
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* ── GRID VIEW ──────────────────────────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          {documents.map((doc) => {
            const { type: displayType, config: typeConfig } = getDocTypeInfo(doc, isDark);
            const TypeIcon = typeConfig.icon;
            const categoryBadgeCls = getCategoryBadgeClass(doc.category, isDark);

            return (
              <div
                key={doc.id}
                className={`${isDark ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]" : "bg-white border-gray-200 hover:border-gray-300 shadow-xs hover:shadow-md"} border rounded-[10px] p-4 flex flex-col justify-between transition-all group`}
              >
                <div>
                  {/* Card Top: Type badge & Visibility */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-6 h-6 rounded-[5px] flex items-center justify-center ${typeConfig.bg} ${typeConfig.color}`}>
                        <TypeIcon className="w-3.5 h-3.5" />
                      </span>
                      <span className={`text-[10px] font-berkeley-mono uppercase tracking-wider px-1.5 py-0.5 rounded-[3px] border ${categoryBadgeCls}`}>
                        {doc.category}
                      </span>
                    </div>

                    {doc.visibility === "officers_only" ? (
                      <span
                        className={`flex items-center gap-1 text-[10px] font-berkeley-mono px-1.5 py-0.5 rounded-[3px] border ${
                          isDark ? "text-amber-400 bg-amber-400/10 border-amber-400/20" : "text-amber-700 bg-amber-50 border-amber-200"
                        }`}
                        title="Restricted: Visible to society officers only"
                      >
                        <Lock className="w-2.5 h-2.5" />
                        Officers
                      </span>
                    ) : (
                      <span
                        className={`flex items-center gap-1 text-[10px] font-berkeley-mono px-1.5 py-0.5 rounded-[3px] border ${
                          isDark ? "text-[#8a8f98] bg-[#161718] border-[#23252a]" : "text-gray-600 bg-gray-50 border-gray-200"
                        }`}
                        title="Visible to all society members"
                      >
                        <Globe className="w-2.5 h-2.5 text-[#27a644]" />
                        Members
                      </span>
                    )}
                  </div>

                  {/* Document Title */}
                  <h4
                    className={`text-xs font-[510] ${isDark ? "text-white group-hover:text-[#e4f222]" : "text-gray-900 group-hover:text-indigo-600 font-[590]"} line-clamp-1 transition-colors mb-1`}
                    title={doc.name}
                  >
                    {doc.name}
                  </h4>

                  {/* Original filename */}
                  <p className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"} truncate mb-2`} title={doc.file_name}>
                    {doc.file_name}
                  </p>

                  {/* Description if present */}
                  {doc.description && (
                    <p className={`text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"} line-clamp-2 mb-3 leading-relaxed`}>
                      {doc.description}
                    </p>
                  )}

                  {/* Relation Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {doc.event && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono px-1.5 py-0.5 rounded-[3px] border ${
                        isDark ? "text-indigo-300 bg-indigo-500/10 border-indigo-500/20" : "text-indigo-700 bg-indigo-50 border-indigo-200"
                      }`}>
                        <Calendar className="w-2.5 h-2.5" />
                        {doc.event.name}
                      </span>
                    )}
                    {doc.member && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono px-1.5 py-0.5 rounded-[3px] border ${
                        isDark ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" : "text-emerald-700 bg-emerald-50 border-emerald-200"
                      }`}>
                        <User className="w-2.5 h-2.5" />
                        {doc.member.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Bottom: Metadata & Actions */}
                <div className={`pt-3 border-t ${isDark ? "border-[#23252a]/70" : "border-gray-100"}`}>
                  <div className={`flex items-center justify-between text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"} mb-2.5`}>
                    <span>{formatBytes(doc.file_size)}</span>
                    <span title={new Date(doc.created_at).toLocaleString()}>
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePreviewDocument(doc)}
                        className={`h-7 px-2 rounded-[4px] border text-[11px] flex items-center gap-1 transition-colors ${
                          isDark
                            ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                            : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-xs"
                        }`}
                        title="Preview document"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>

                      <button
                        onClick={() => handleDownloadDocument(doc)}
                        className={`h-7 px-2 rounded-[4px] border text-[11px] flex items-center gap-1 transition-colors ${
                          isDark
                            ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                            : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-xs"
                        }`}
                        title="Download file"
                      >
                        <Download className="w-3 h-3" />
                      </button>

                      <button
                        onClick={() => handleCopyLink(doc)}
                        className={`h-7 px-2 rounded-[4px] border text-[11px] flex items-center gap-1 transition-colors ${
                          isDark
                            ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                            : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-xs"
                        }`}
                        title="Copy temporary 1-hour secure link"
                      >
                        {copiedId === doc.id ? <Check className="w-3 h-3 text-[#27a644]" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>

                    {isOfficer && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditClick(doc)}
                          className={`h-7 w-7 rounded-[4px] border flex items-center justify-center transition-colors ${
                            isDark
                              ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                              : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-xs"
                          }`}
                          title="Edit metadata"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(doc)}
                          className={`h-7 w-7 rounded-[4px] border flex items-center justify-center transition-colors ${
                            isDark
                              ? "bg-[#161718] hover:bg-[#eb5757]/20 text-[#8a8f98] hover:text-[#eb5757] border-[#23252a]"
                              : "bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 border-gray-200 shadow-xs"
                          }`}
                          title="Delete file"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── LIST VIEW ──────────────────────────────────────────────────────── */
        <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-xs"} border rounded-[8px] overflow-x-auto mb-6`}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b ${isDark ? "border-[#23252a] bg-[#161718]/60 text-[#8a8f98]" : "border-gray-200 bg-gray-50 text-gray-600"} text-[11px] font-berkeley-mono`}>
                <th className="p-3">Document Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Type / Size</th>
                <th className="p-3">Linked Records</th>
                <th className="p-3">Visibility</th>
                <th className="p-3">Uploaded</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-[#23252a]" : "divide-gray-100"}`}>
              {documents.map((doc) => {
                const { type: displayType, config: typeConfig } = getDocTypeInfo(doc, isDark);
                const TypeIcon = typeConfig.icon;
                const categoryBadgeCls = getCategoryBadgeClass(doc.category, isDark);

                return (
                  <tr key={doc.id} className={`${isDark ? "hover:bg-[#161718]/40" : "hover:bg-gray-50/80"} transition-colors`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-7 h-7 rounded-[5px] flex items-center justify-center flex-shrink-0 ${typeConfig.bg} ${typeConfig.color}`}>
                          <TypeIcon className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className={`font-[510] ${isDark ? "text-white" : "text-gray-900"} truncate max-w-xs`} title={doc.name}>
                            {doc.name}
                          </div>
                          <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"} truncate max-w-xs`} title={doc.file_name}>
                            {doc.file_name}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <span className={`text-[10px] font-berkeley-mono uppercase tracking-wider px-1.5 py-0.5 rounded-[3px] border ${categoryBadgeCls}`}>
                        {doc.category}
                      </span>
                    </td>

                    <td className={`p-3 font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                      <div>{displayType}</div>
                      <div className={`text-[10px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>{formatBytes(doc.file_size)}</div>
                    </td>

                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        {doc.event && (
                          <span className={`text-[10px] font-berkeley-mono flex items-center gap-1 ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>
                            <Calendar className="w-2.5 h-2.5" />
                            {doc.event.name}
                          </span>
                        )}
                        {doc.member && (
                          <span className={`text-[10px] font-berkeley-mono flex items-center gap-1 ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                            <User className="w-2.5 h-2.5" />
                            {doc.member.name}
                          </span>
                        )}
                        {!doc.event && !doc.member && (
                          <span className={`text-[10px] ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>—</span>
                        )}
                      </div>
                    </td>

                    <td className="p-3">
                      {doc.visibility === "officers_only" ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono px-1.5 py-0.5 rounded-[3px] border ${
                          isDark ? "text-amber-400 bg-amber-400/10 border-amber-400/20" : "text-amber-700 bg-amber-50 border-amber-200"
                        }`}>
                          <Lock className="w-2.5 h-2.5" />
                          Officers
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono px-1.5 py-0.5 rounded-[3px] border ${
                          isDark ? "text-[#8a8f98] bg-[#161718] border-[#23252a]" : "text-gray-600 bg-gray-50 border-gray-200"
                        }`}>
                          <Globe className="w-2.5 h-2.5 text-[#27a644]" />
                          Members
                        </span>
                      )}
                    </td>

                    <td className={`p-3 font-berkeley-mono text-[11px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                      <div>{new Date(doc.created_at).toLocaleDateString()}</div>
                      <div className={`text-[10px] ${isDark ? "text-[#62666d]" : "text-gray-400"} truncate max-w-[100px]`}>{doc.uploader_name || "Officer"}</div>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handlePreviewDocument(doc)}
                          className={`h-7 px-2 rounded-[4px] border text-[11px] flex items-center gap-1 transition-colors ${
                            isDark
                              ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                              : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-xs"
                          }`}
                          title="Preview"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDownloadDocument(doc)}
                          className={`h-7 px-2 rounded-[4px] border text-[11px] flex items-center gap-1 transition-colors ${
                            isDark
                              ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                              : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-xs"
                          }`}
                          title="Download"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleCopyLink(doc)}
                          className={`h-7 px-2 rounded-[4px] border text-[11px] flex items-center gap-1 transition-colors ${
                            isDark
                              ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                              : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-xs"
                          }`}
                          title="Copy Link"
                        >
                          {copiedId === doc.id ? <Check className="w-3 h-3 text-[#27a644]" /> : <Copy className="w-3 h-3" />}
                        </button>
                        {isOfficer && (
                          <>
                            <button
                              onClick={() => handleEditClick(doc)}
                              className={`h-7 w-7 rounded-[4px] border flex items-center justify-center transition-colors ${
                                isDark
                                  ? "bg-[#161718] hover:bg-[#23252a] text-[#8a8f98] hover:text-white border-[#23252a]"
                                  : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border-gray-200 shadow-xs"
                              }`}
                              title="Edit"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(doc)}
                              className={`h-7 w-7 rounded-[4px] border flex items-center justify-center transition-colors ${
                                isDark
                                  ? "bg-[#161718] hover:bg-[#eb5757]/20 text-[#8a8f98] hover:text-[#eb5757] border-[#23252a]"
                                  : "bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 border-gray-200 shadow-xs"
                              }`}
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      <Pagination
        page={page}
        total={totalCount}
        loading={loading}
        onPageChange={setPage}
      />

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 1: Upload Document (Officers Only)
         ══════════════════════════════════════════════════════════════════════════ */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200"} border rounded-[12px] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150`}>
            {/* Modal Header */}
            <div className={`p-4 border-b ${isDark ? "border-[#23252a]" : "border-gray-200 bg-gray-50"} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <UploadCloud className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                <h3 className={`text-sm font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>Upload New Document to R2</h3>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className={isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-400 hover:text-gray-600"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4">
              {/* Storage Quota Usage Indicator in Modal (9 GB Ceiling) */}
              <div className={`${isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"} border rounded-[8px] p-3`}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className={`flex items-center gap-1.5 ${isDark ? "text-white" : "text-gray-900"} font-[510]`}>
                    <HardDrive className={`w-3.5 h-3.5 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                    <span>Repository Quota (9 GB Limit)</span>
                  </div>
                  <span className={`font-berkeley-mono text-[11px] ${
                    isStorageFull
                      ? isDark ? "text-[#eb5757]" : "text-red-600"
                      : isStorageCritical
                      ? isDark ? "text-amber-400" : "text-amber-600"
                      : isDark ? "text-[#e4f222]" : "text-indigo-600"
                  }`}>
                    {formatBytes(totalStorageBytes, 2)} / 9.0 GB
                  </span>
                </div>

                <div className={`w-full h-2 ${isDark ? "bg-[#08090a] border-[#23252a]" : "bg-gray-200 border-gray-300"} rounded-full overflow-hidden border flex`}>
                  <div
                    className={`h-full transition-all duration-300 ${
                      totalStorageBytes >= MAX_TOTAL_STORAGE_BYTES
                        ? "bg-[#eb5757]"
                        : (totalStorageBytes / MAX_TOTAL_STORAGE_BYTES) > 0.85
                        ? "bg-amber-400"
                        : isDark ? "bg-[#e4f222]" : "bg-indigo-600"
                    }`}
                    style={{ width: `${Math.min(100, (totalStorageBytes / MAX_TOTAL_STORAGE_BYTES) * 100)}%` }}
                  />
                  {selectedFile && !fileError && totalStorageBytes + selectedFile.size <= MAX_TOTAL_STORAGE_BYTES && (
                    <div
                      className="h-full bg-emerald-400 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100 - (totalStorageBytes / MAX_TOTAL_STORAGE_BYTES) * 100,
                          (selectedFile.size / MAX_TOTAL_STORAGE_BYTES) * 100
                        )}%`
                      }}
                    />
                  )}
                </div>

                <div className={`flex items-center justify-between text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mt-1.5`}>
                  <span>
                    {formatBytes(remainingStorageBytes, 2)} available
                  </span>
                  {selectedFile ? (
                    totalStorageBytes + selectedFile.size > MAX_TOTAL_STORAGE_BYTES ? (
                      <span className="text-red-500 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Exceeds 9 GB Limit
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium">
                        +{formatBytes(selectedFile.size)} (New total: {formatBytes(totalStorageBytes + selectedFile.size, 2)})
                      </span>
                    )
                  ) : (
                    <span>{storagePercent.toFixed(1)}% full</span>
                  )}
                </div>
              </div>

              {/* Warning if repository is full */}
              {isStorageFull && (
                <div className={`p-3 rounded-[6px] border text-xs flex items-start gap-2 ${
                  isDark ? "bg-[#eb5757]/15 border-[#eb5757]/40 text-[#eb5757]" : "bg-red-50 border-red-200 text-red-700"
                }`}>
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Storage Quota Full (9 GB Reached)</div>
                    <div className="text-[11px] mt-0.5 opacity-90">
                      The document repository is at full 9 GB capacity. You must delete existing documents before uploading new files.
                    </div>
                  </div>
                </div>
              )}

              {/* Drag & drop file selector */}
              <div>
                <label className={`block text-xs font-medium ${isDark ? "text-[#8a8f98]" : "text-gray-700"} mb-1.5`}>
                  Select File <span className="text-[#eb5757]">*</span>
                </label>
                <div className={`relative border-2 border-dashed ${
                  isStorageFull
                    ? isDark ? "border-[#eb5757]/30 bg-[#eb5757]/5 cursor-not-allowed" : "border-red-200 bg-red-50/50 cursor-not-allowed"
                    : isDark ? "border-[#23252a] hover:border-[#383b3f] bg-[#161718]/50" : "border-gray-300 hover:border-gray-400 bg-gray-50/70"
                } rounded-[8px] p-4 text-center transition-colors`}>
                  <input
                    type="file"
                    disabled={isStorageFull}
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.zip,.7z,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/*,application/zip,application/x-zip-compressed,application/x-7z-compressed"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <UploadCloud className={`w-8 h-8 ${isDark ? "text-[#8a8f98]" : "text-gray-400"} mx-auto mb-2`} />
                  {selectedFile ? (
                    <div>
                      <p className={`text-xs font-[510] ${isDark ? "text-white" : "text-gray-900"} truncate max-w-xs mx-auto`}>
                        {selectedFile.name}
                      </p>
                      <p className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mt-0.5`}>
                        {formatBytes(selectedFile.size)} • {getFileTypeCategory(selectedFile.type, selectedFile.name)}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className={`text-xs ${isDark ? "text-white" : "text-gray-900"} font-medium`}>
                        Click or drag file here to upload
                      </p>
                      <p className={`text-[10px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mt-1`}>
                        PDF, Word (.docx, .doc), Images (.png, .jpg, .webp), and Archives (.zip, .7z) up to 25 MB
                      </p>
                    </div>
                  )}
                </div>
                {fileError && (
                  <p className="text-[11px] text-[#eb5757] mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {fileError}
                  </p>
                )}
              </div>

              {/* Title / Display Name */}
              <div>
                <label className={`block text-xs font-medium ${isDark ? "text-[#8a8f98]" : "text-gray-700"} mb-1.5`}>
                  Document Title <span className="text-[#eb5757]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Annual Hackathon 2026 Budget Report"
                  className={`w-full h-8 px-3 text-xs rounded-[6px] border transition-colors focus:outline-none ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] text-white placeholder-[#62666d] focus:border-[#e4f222]"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 shadow-xs"
                  }`}
                />
              </div>

              {/* Category & Visibility Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium ${isDark ? "text-[#8a8f98]" : "text-gray-700"} mb-1.5`}>
                    Category <span className="text-[#eb5757]">*</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className={`w-full h-8 px-2.5 text-xs rounded-[6px] border focus:outline-none ${
                      isDark
                        ? "bg-[#161718] border-[#23252a] text-white focus:border-[#e4f222]"
                        : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"
                    }`}
                  >
                    {ALLOWED_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium ${isDark ? "text-[#8a8f98]" : "text-gray-700"} mb-1.5`}>
                    Visibility Level <span className="text-[#eb5757]">*</span>
                  </label>
                  <select
                    value={form.visibility}
                    onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                    className={`w-full h-8 px-2.5 text-xs rounded-[6px] border focus:outline-none ${
                      isDark
                        ? "bg-[#161718] border-[#23252a] text-white focus:border-[#e4f222]"
                        : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"
                    }`}
                  >
                    <option value="public_to_members">All Society Members</option>
                    <option value="officers_only">Officers Only (Restricted)</option>
                  </select>
                </div>
              </div>

              {/* Optional Links: Event & Member */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium ${isDark ? "text-[#8a8f98]" : "text-gray-700"} mb-1.5`}>
                    Link to Event (Optional)
                  </label>
                  <select
                    value={form.eventId}
                    onChange={(e) => setForm({ ...form, eventId: e.target.value })}
                    className={`w-full h-8 px-2.5 text-xs rounded-[6px] border focus:outline-none ${
                      isDark
                        ? "bg-[#161718] border-[#23252a] text-[#d0d6e0] focus:border-[#e4f222]"
                        : "bg-white border-gray-300 text-gray-700 focus:border-indigo-500 shadow-xs"
                    }`}
                  >
                    <option value="">None (Unlinked)</option>
                    {eventsList.map(ev => (
                      <option key={ev.event_id} value={ev.event_id}>
                        {ev.name} ({ev.date})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium ${isDark ? "text-[#8a8f98]" : "text-gray-700"} mb-1.5`}>
                    Link to Member (Optional)
                  </label>
                  <select
                    value={form.stId}
                    onChange={(e) => setForm({ ...form, stId: e.target.value })}
                    className={`w-full h-8 px-2.5 text-xs rounded-[6px] border focus:outline-none ${
                      isDark
                        ? "bg-[#161718] border-[#23252a] text-[#d0d6e0] focus:border-[#e4f222]"
                        : "bg-white border-gray-300 text-gray-700 focus:border-indigo-500 shadow-xs"
                    }`}
                  >
                    <option value="">None (Unlinked)</option>
                    {membersList.map(m => (
                      <option key={m.st_id} value={m.st_id}>
                        {m.name} ({m.st_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={`block text-xs font-medium ${isDark ? "text-[#8a8f98]" : "text-gray-700"} mb-1.5`}>
                  Description / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Provide brief notes, context, or meeting references..."
                  className={`w-full p-2.5 text-xs rounded-[6px] border resize-none focus:outline-none ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] text-white placeholder-[#62666d] focus:border-[#e4f222]"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 shadow-xs"
                  }`}
                />
              </div>

              {/* Progress bar during upload */}
              {isSubmitting && (
                <div>
                  <div className={`flex justify-between text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mb-1`}>
                    <span>Streaming to Cloudflare R2...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className={`w-full h-1.5 ${isDark ? "bg-[#23252a]" : "bg-gray-200"} rounded-full overflow-hidden`}>
                    <div
                      className={`h-full ${isDark ? "bg-[#e4f222]" : "bg-indigo-600"} transition-all duration-300`}
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className={`pt-3 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"} flex items-center justify-end gap-2`}>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setUploadModalOpen(false)}
                  className={`h-8 px-3 text-xs transition-colors ${isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !selectedFile ||
                    Boolean(fileError) ||
                    (selectedFile && totalStorageBytes + selectedFile.size > MAX_TOTAL_STORAGE_BYTES) ||
                    isStorageFull
                  }
                  className={`h-8 px-4 text-xs font-[510] rounded-[6px] transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark ? "bg-[#e4f222] hover:bg-[#d5e31d] text-black" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Uploading...
                    </>
                  ) : selectedFile && totalStorageBytes + selectedFile.size > MAX_TOTAL_STORAGE_BYTES ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-[#eb5757]" />
                      Exceeds 9 GB Limit
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      Confirm &amp; Upload
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 2: Edit Metadata (Officers Only)
         ══════════════════════════════════════════════════════════════════════════ */}
      {editModalOpen && activeDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200"} border rounded-[12px] w-full max-w-lg overflow-hidden shadow-2xl`}>
            <div className={`p-4 border-b ${isDark ? "border-[#23252a]" : "border-gray-200 bg-gray-50"} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Edit3 className={`w-4 h-4 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                <h3 className={`text-sm font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>Edit Document Metadata</h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className={isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-400 hover:text-gray-600"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div>
                <label className={`block text-xs font-medium ${isDark ? "text-[#8a8f98]" : "text-gray-700"} mb-1.5`}>
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`w-full h-8 px-3 text-xs rounded-[6px] border focus:outline-none ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] text-white focus:border-[#e4f222]"
                      : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium ${isDark ? "text-[#8a8f98]" : "text-gray-700"} mb-1.5`}>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className={`w-full h-8 px-2.5 text-xs rounded-[6px] border focus:outline-none ${
                      isDark
                        ? "bg-[#161718] border-[#23252a] text-white focus:border-[#e4f222]"
                        : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"
                    }`}
                  >
                    {ALLOWED_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium ${isDark ? "text-[#8a8f98]" : "text-gray-700"} mb-1.5`}>Visibility</label>
                  <select
                    value={form.visibility}
                    onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                    className={`w-full h-8 px-2.5 text-xs rounded-[6px] border focus:outline-none ${
                      isDark
                        ? "bg-[#161718] border-[#23252a] text-white focus:border-[#e4f222]"
                        : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"
                    }`}
                  >
                    <option value="public_to_members">All Society Members</option>
                    <option value="officers_only">Officers Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium ${isDark ? "text-[#8a8f98]" : "text-gray-700"} mb-1.5`}>Linked Event</label>
                  <select
                    value={form.eventId}
                    onChange={(e) => setForm({ ...form, eventId: e.target.value })}
                    className={`w-full h-8 px-2.5 text-xs rounded-[6px] border focus:outline-none ${
                      isDark
                        ? "bg-[#161718] border-[#23252a] text-[#d0d6e0] focus:border-[#e4f222]"
                        : "bg-white border-gray-300 text-gray-700 focus:border-indigo-500 shadow-xs"
                    }`}
                  >
                    <option value="">None (Unlinked)</option>
                    {eventsList.map(ev => (
                      <option key={ev.event_id} value={ev.event_id}>
                        {ev.name} ({ev.date})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium ${isDark ? "text-[#8a8f98]" : "text-gray-700"} mb-1.5`}>Linked Member</label>
                  <select
                    value={form.stId}
                    onChange={(e) => setForm({ ...form, stId: e.target.value })}
                    className={`w-full h-8 px-2.5 text-xs rounded-[6px] border focus:outline-none ${
                      isDark
                        ? "bg-[#161718] border-[#23252a] text-[#d0d6e0] focus:border-[#e4f222]"
                        : "bg-white border-gray-300 text-gray-700 focus:border-indigo-500 shadow-xs"
                    }`}
                  >
                    <option value="">None (Unlinked)</option>
                    {membersList.map(m => (
                      <option key={m.st_id} value={m.st_id}>
                        {m.name} ({m.st_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium ${isDark ? "text-[#8a8f98]" : "text-gray-700"} mb-1.5`}>Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`w-full p-2.5 text-xs rounded-[6px] border resize-none focus:outline-none ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] text-white focus:border-[#e4f222]"
                      : "bg-white border-gray-300 text-gray-900 focus:border-indigo-500 shadow-xs"
                  }`}
                />
              </div>

              <div className={`pt-3 border-t ${isDark ? "border-[#23252a]" : "border-gray-200"} flex items-center justify-end gap-2`}>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className={`h-8 px-3 text-xs ${isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`h-8 px-4 text-xs font-[510] rounded-[6px] ${
                    isDark ? "bg-[#e4f222] text-black hover:bg-[#d5e31d]" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                  }`}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 3: Delete Confirmation (Officers Only)
         ══════════════════════════════════════════════════════════════════════════ */}
      {deleteModalOpen && activeDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`${isDark ? "bg-[#0f1011] border-[#eb5757]/30" : "bg-white border-red-200"} border rounded-[12px] w-full max-w-md overflow-hidden shadow-2xl`}>
            <div className={`p-4 border-b ${isDark ? "border-[#23252a]" : "border-gray-200 bg-red-50/50"} flex items-center gap-2 text-[#eb5757]`}>
              <Trash2 className="w-4 h-4" />
              <h3 className={`text-sm font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>Delete Document</h3>
            </div>
            <div className="p-5 text-xs space-y-3">
              <p className={isDark ? "text-[#8a8f98]" : "text-gray-600"}>
                Are you sure you want to permanently delete <strong className={isDark ? "text-white" : "text-gray-900"}>"{activeDoc.name}"</strong>?
              </p>
              <div className={`p-3 rounded-[6px] border text-[11px] font-berkeley-mono space-y-1 ${
                isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-50 border-gray-200 text-gray-600"
              }`}>
                <div>File: {activeDoc.file_name}</div>
                <div>Size: {formatBytes(activeDoc.file_size)}</div>
                <div>Storage Key: {activeDoc.r2_key}</div>
              </div>
              <p className="text-[#eb5757] text-[11px]">
                This action will delete the underlying file from Cloudflare R2 and remove its database record permanently.
              </p>
            </div>
            <div className={`p-4 border-t flex items-center justify-end gap-2 ${
              isDark ? "bg-[#161718] border-[#23252a]" : "bg-gray-50 border-gray-200"
            }`}>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setDeleteModalOpen(false)}
                className={`h-8 px-3 text-xs ${isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteConfirm}
                className="h-8 px-4 text-xs font-[510] bg-[#eb5757] hover:bg-[#d44343] text-white rounded-[6px] transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {isSubmitting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 4: Secure File Preview
         ══════════════════════════════════════════════════════════════════════════ */}
      {previewModalOpen && activeDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-sm">
          <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200"} border rounded-[12px] w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl`}>
            {/* Preview Header */}
            <div className={`p-4 border-b ${isDark ? "border-[#23252a] bg-[#161718]" : "border-gray-200 bg-gray-50"} flex items-center justify-between`}>
              <div className="min-w-0 pr-4">
                <h3 className={`text-sm font-[510] ${isDark ? "text-white" : "text-gray-900"} truncate`} title={activeDoc.name}>
                  {activeDoc.name}
                </h3>
                <p className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} truncate`}>
                  {activeDoc.file_name} • {formatBytes(activeDoc.file_size)} • Signed URL (1-hour validity)
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {previewUrl && (
                  <>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`h-8 px-3 rounded-[6px] text-xs font-medium flex items-center gap-1.5 transition-colors ${
                        isDark ? "bg-[#23252a] hover:bg-[#383b3f] text-white" : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-xs"
                      }`}
                      title="Open in new window"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Ext
                    </a>
                    <button
                      onClick={() => handleDownloadDocument(activeDoc)}
                      className={`h-8 px-3 rounded-[6px] text-xs font-[510] flex items-center gap-1.5 transition-colors ${
                        isDark ? "bg-[#e4f222] hover:bg-[#d5e31d] text-black" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                  </>
                )}
                <button
                  onClick={() => setPreviewModalOpen(false)}
                  className={`h-8 w-8 rounded-[6px] flex items-center justify-center transition-colors ml-1 ${
                    isDark ? "hover:bg-[#23252a] text-[#8a8f98] hover:text-white" : "hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Preview Body */}
            <div className={`flex-1 ${isDark ? "bg-[#08090a]" : "bg-gray-100"} p-4 flex items-center justify-center overflow-auto`}>
              {previewLoading ? (
                <div className="text-center">
                  <div className={`w-8 h-8 border-2 ${isDark ? "border-[#23252a] border-t-[#e4f222]" : "border-gray-200 border-t-indigo-600"} rounded-full animate-spin mx-auto mb-2`} />
                  <p className={`text-xs font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>Generating secure signed URL from R2...</p>
                </div>
              ) : !previewUrl ? (
                <div className={`text-center ${isDark ? "text-[#8a8f98]" : "text-gray-500"} text-xs`}>
                  <AlertCircle className="w-8 h-8 text-[#eb5757] mx-auto mb-2" />
                  <p>Failed to load secure preview.</p>
                </div>
              ) : activeDoc.file_type === "Image" ? (
                <img
                  src={previewUrl}
                  alt={activeDoc.name}
                  className="max-h-full max-w-full object-contain rounded-[6px] shadow"
                />
              ) : activeDoc.file_type === "PDF" ? (
                <iframe
                  src={previewUrl}
                  title={activeDoc.name}
                  className={`w-full h-full rounded-[6px] border ${isDark ? "border-[#23252a]" : "border-gray-300"}`}
                />
              ) : (activeDoc.file_type === "Archive" || activeDoc.file_name?.toLowerCase().endsWith(".zip") || activeDoc.file_name?.toLowerCase().endsWith(".7z")) ? (
                <div className={`text-center max-w-md p-6 ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-md"} border rounded-[10px]`}>
                  <FileArchive className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                  <h4 className={`text-sm font-[510] ${isDark ? "text-white" : "text-gray-900"} mb-1`}>
                    Direct browser preview not supported for Archive files
                  </h4>
                  <p className={`text-xs ${isDark ? "text-[#8a8f98]" : "text-gray-600"} mb-4`}>
                    Compressed archives (.zip, .7z) must be downloaded and extracted on your computer. Click Download to save the file.
                  </p>
                  <button
                    onClick={() => handleDownloadDocument(activeDoc)}
                    className={`h-8 px-4 rounded-[6px] text-xs font-[510] inline-flex items-center gap-2 ${
                      isDark ? "bg-[#e4f222] hover:bg-[#d5e31d] text-black" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Archive ({formatBytes(activeDoc.file_size)})
                  </button>
                </div>
              ) : (
                <div className={`text-center max-w-md p-6 ${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200 shadow-md"} border rounded-[10px]`}>
                  <FileText className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
                  <h4 className={`text-sm font-[510] ${isDark ? "text-white" : "text-gray-900"} mb-1`}>
                    Direct browser preview not supported for {activeDoc.file_type} files
                  </h4>
                  <p className={`text-xs ${isDark ? "text-[#8a8f98]" : "text-gray-600"} mb-4`}>
                    Word documents (.docx, .doc) must be opened in Microsoft Word or Google Docs. Click Download to save the file securely.
                  </p>
                  <button
                    onClick={() => handleDownloadDocument(activeDoc)}
                    className={`h-8 px-4 rounded-[6px] text-xs font-[510] inline-flex items-center gap-2 ${
                      isDark ? "bg-[#e4f222] hover:bg-[#d5e31d] text-black" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download File ({formatBytes(activeDoc.file_size)})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 5: Manage Member Document Access (Admins / Officers)
         ══════════════════════════════════════════════════════════════════════════ */}
      {accessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`${isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200"} border rounded-[12px] w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl`}>
            {/* Modal Header */}
            <div className={`p-4 border-b ${isDark ? "border-[#23252a] bg-[#161718]" : "border-gray-200 bg-gray-50"} flex items-center justify-between`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-[6px] border flex items-center justify-center ${
                  isDark ? "bg-[#e4f222]/10 border-[#e4f222]/20 text-[#e4f222]" : "bg-indigo-50 border-indigo-200 text-indigo-600"
                }`}>
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-sm font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>Document Repository Member Access</h3>
                  <p className={`text-[10px] ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                    Select which society members can view documents and choose their permitted categories
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAccessModalOpen(false)}
                className={`p-1 rounded transition-colors ${isDark ? "text-[#8a8f98] hover:text-white hover:bg-[#23252a]" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Controls: Search & Batch Category Presets */}
            <div className={`p-4 border-b space-y-3 ${isDark ? "border-[#23252a] bg-[#0f1011]" : "border-gray-200 bg-white"}`}>
              <div className="relative">
                <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-[#8a8f98]" : "text-gray-400"}`} />
                <input
                  type="text"
                  value={accessSearch}
                  onChange={(e) => setAccessSearch(e.target.value)}
                  placeholder="Search members by name, student ID (e.g. SC/2022/12345), or email..."
                  className={`w-full h-8 pl-9 pr-3 text-xs rounded-[6px] border focus:outline-none ${
                    isDark
                      ? "bg-[#161718] border-[#23252a] text-white placeholder-[#62666d] focus:border-[#e4f222]"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 shadow-xs"
                  }`}
                />
              </div>

              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <div className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                  <span className={`${isDark ? "text-[#e4f222]" : "text-indigo-600"} font-semibold`}>{Object.keys(tempAccessMap).length}</span> of {allMembersList.length} members with access
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>Apply to matching:</span>
                  <button
                    type="button"
                    onClick={() => setFilteredMembersCategories(ALL_CATEGORY_IDS)}
                    className={`text-[10px] px-2 py-0.5 rounded-[4px] border transition-colors ${
                      isDark
                        ? "bg-[#161718] border-[#23252a] text-white hover:border-[#e4f222]/40 hover:text-[#e4f222]"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-xs"
                    }`}
                  >
                    All Categories
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilteredMembersCategories(["Guidance"])}
                    className={`text-[10px] px-2 py-0.5 rounded-[4px] border transition-colors ${
                      isDark
                        ? "bg-[#161718] border-[#23252a] text-[#e4f222] hover:bg-[#e4f222]/10 hover:border-[#e4f222]/40"
                        : "bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100"
                    }`}
                  >
                    Guidance Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilteredMembersCategories(["Permissions"])}
                    className={`text-[10px] px-2 py-0.5 rounded-[4px] border transition-colors ${
                      isDark
                        ? "bg-[#161718] border-[#23252a] text-amber-300 hover:bg-amber-400/10 hover:border-amber-400/40"
                        : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                    }`}
                  >
                    Permissions Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilteredMembersCategories(["Guidance", "Permissions"])}
                    className={`text-[10px] px-2 py-0.5 rounded-[4px] border transition-colors ${
                      isDark
                        ? "bg-[#161718] border-[#23252a] text-[#818cf8] hover:bg-[#818cf8]/10 hover:border-[#818cf8]/40"
                        : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                    }`}
                  >
                    Both
                  </button>
                  <span className={isDark ? "text-[#383b3f]" : "text-gray-300"}>•</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[10px] text-[#eb5757] hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Member Checklist with Category Chips */}
            <div className={`flex-1 overflow-y-auto p-4 divide-y ${isDark ? "divide-[#23252a]/60" : "divide-gray-100"} space-y-2.5`}>
              {filteredAccessMembers.length === 0 ? (
                <div className={`py-12 text-center ${isDark ? "text-[#8a8f98]" : "text-gray-500"} text-xs`}>
                  No members found matching "{accessSearch}".
                </div>
              ) : (
                filteredAccessMembers.map((member) => {
                  const memberIdKey = (member.idKey || member.st_id || member.email || "").trim();
                  const memberCategories = getMemberCategoriesFromMap(tempAccessMap, member);
                  const hasAll = ALL_CATEGORY_IDS.every(c => memberCategories.includes(c));
                  const hasAny = memberCategories.length > 0;

                  return (
                    <div
                      key={memberIdKey || member.name}
                      className={`p-3 rounded-[8px] transition-colors border ${
                        hasAny
                          ? isDark
                            ? "bg-[#161718] border-[#e4f222]/25 shadow-sm"
                            : "bg-indigo-50/50 border-indigo-200 shadow-xs"
                          : isDark
                          ? "bg-[#0f1011] border-[#23252a] hover:border-[#383b3f]"
                          : "bg-white border-gray-200 hover:border-gray-300 shadow-xs"
                      }`}
                    >
                      {/* Top Row: Member Details & Quick All/None Toggle */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className={`font-[510] text-xs ${isDark ? "text-white" : "text-gray-900"} truncate flex items-center gap-2`}>
                            <span>{member.name}</span>
                            {member.level && (
                              <span className={`text-[9px] font-berkeley-mono px-1.5 py-0.2 rounded border ${
                                isDark ? "text-[#8a8f98] bg-[#0f1011] border-[#23252a]" : "text-gray-600 bg-gray-100 border-gray-200"
                              }`}>
                                L{member.level}
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"} mt-0.5 truncate`}>
                            {member.st_id || ""} {member.email ? `${member.st_id ? "• " : ""}${member.email}` : ""}
                          </div>
                        </div>

                        {/* Status Badge & Quick Action */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {hasAll ? (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono px-2 py-0.5 rounded-[4px] border ${
                              isDark ? "text-[#27a644] bg-[#27a644]/15 border-[#27a644]/30" : "text-emerald-700 bg-emerald-50 border-emerald-200"
                            }`}>
                              <Check className="w-3 h-3" />
                              All 4 Categories
                            </span>
                          ) : hasAny ? (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-berkeley-mono px-2 py-0.5 rounded-[4px] border ${
                              isDark ? "text-[#e4f222] bg-[#e4f222]/15 border-[#e4f222]/30" : "text-indigo-700 bg-indigo-50 border-indigo-200"
                            }`}>
                              {memberCategories.length} Categories
                            </span>
                          ) : (
                            <span className={`text-[10px] font-berkeley-mono px-2 py-0.5 rounded-[4px] border ${
                              isDark ? "text-[#62666d] bg-[#0f1011] border-[#23252a]" : "text-gray-500 bg-gray-100 border-gray-200"
                            }`}>
                              No Access
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleMemberAllCategories(member)}
                            className={`px-2 py-0.5 rounded-[4px] text-[10px] font-medium border transition-colors ${
                              hasAny
                                ? isDark
                                  ? "bg-[#23252a] text-[#8a8f98] hover:text-[#eb5757] hover:border-[#eb5757]/40 border-transparent"
                                  : "bg-gray-100 text-gray-600 hover:text-red-600 border-gray-200"
                                : isDark
                                ? "bg-[#e4f222]/10 text-[#e4f222] hover:bg-[#e4f222]/20 border-[#e4f222]/30"
                                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                            }`}
                            title={hasAny ? "Remove all categories for this member" : "Grant all 4 categories"}
                          >
                            {hasAny ? "Clear" : "+ Grant All"}
                          </button>
                        </div>
                      </div>

                      {/* Bottom Row: Category Pills */}
                      <div className={`flex items-center gap-1.5 flex-wrap pt-1.5 border-t ${isDark ? "border-[#23252a]/60" : "border-gray-100"}`}>
                        <span className={`text-[9px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"} mr-1 uppercase tracking-wider`}>
                          Can View:
                        </span>
                        {ALLOWED_CATEGORIES.map(cat => {
                          const isActive = memberCategories.includes(cat.id);
                          const IconComp = CATEGORY_ICONS[cat.id] || Folder;

                          let activeClass = "";
                          if (cat.id === "Guidance") {
                            activeClass = isDark
                              ? "bg-[#e4f222]/15 text-[#e4f222] border-[#e4f222]/40 shadow-[0_0_8px_rgba(228,242,34,0.15)]"
                              : "bg-yellow-50 text-yellow-800 border-yellow-300 shadow-xs";
                          } else if (cat.id === "Permissions") {
                            activeClass = isDark
                              ? "bg-amber-400/15 text-amber-300 border-amber-400/40 shadow-[0_0_8px_rgba(251,191,36,0.15)]"
                              : "bg-amber-50 text-amber-700 border-amber-300 shadow-xs";
                          } else if (cat.id === "Budgets") {
                            activeClass = isDark
                              ? "bg-[#27a644]/15 text-[#27a644] border-[#27a644]/40 shadow-[0_0_8px_rgba(39,166,68,0.15)]"
                              : "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs";
                          } else {
                            activeClass = isDark
                              ? "bg-indigo-400/15 text-indigo-300 border-indigo-400/40 shadow-[0_0_8px_rgba(129,140,248,0.15)]"
                              : "bg-indigo-50 text-indigo-700 border-indigo-300 shadow-xs";
                          }

                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => toggleMemberCategory(member, cat.id)}
                              className={`h-6 px-2 rounded-[4px] text-[10px] font-medium border flex items-center gap-1 transition-all ${
                                isActive
                                  ? activeClass
                                  : isDark
                                  ? "bg-[#0f1011] text-[#62666d] border-[#23252a] hover:text-[#d0d6e0] hover:border-[#383b3f]"
                                  : "bg-white text-gray-500 border-gray-200 hover:text-gray-800 hover:bg-gray-50 shadow-xs"
                              }`}
                              title={`${isActive ? "Remove" : "Grant"} access to ${cat.label} documents`}
                            >
                              <IconComp className="w-2.5 h-2.5" />
                              <span>{cat.label}</span>
                              {isActive && <Check className="w-2.5 h-2.5 ml-0.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className={`p-4 border-t flex items-center justify-between ${isDark ? "border-[#23252a] bg-[#161718]" : "border-gray-200 bg-gray-50"}`}>
              <span className={`text-[10px] font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`}>
                Changes apply immediately to navigation, document views, and Cloudflare R2 file downloads.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAccessModalOpen(false)}
                  className={`h-8 px-3 text-xs ${isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingAccess}
                  onClick={saveMemberAccess}
                  className={`h-8 px-4 text-xs font-[510] rounded-[6px] transition-colors flex items-center gap-1.5 ${
                    isDark ? "bg-[#e4f222] hover:bg-[#d5e31d] text-black" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                  }`}
                >
                  {savingAccess ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Save Access Permissions
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
