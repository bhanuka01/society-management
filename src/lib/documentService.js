import { supabase } from "../supabaseClient";

export const ALLOWED_CATEGORIES = [
  { id: "Events", label: "Events", description: "Event flyers, agendas, schedules, and promotional materials" },
  { id: "Budgets", label: "Budgets", description: "Financial proposals, expense reports, invoices, and balance sheets" },
  { id: "Permissions", label: "Permissions", description: "Faculty approvals, venue permits, and administrative requests" },
  { id: "Guidance", label: "Guidance", description: "Handbooks, constitutions, brand guidelines, and templates" }
];

export const ALL_CATEGORY_IDS = ALLOWED_CATEGORIES.map(c => c.id);

/**
 * Normalizes document access settings (whether stored as legacy array or granular object)
 * into a standard map: { [identifier]: string[] }
 */
export function normalizeDocAccessMap(raw) {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const map = {};
    raw.forEach(id => {
      if (id && typeof id === "string" && id.trim()) {
        map[id.trim()] = [...ALL_CATEGORY_IDS];
      }
    });
    return map;
  }
  if (typeof raw === "object") {
    const map = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k && k.trim() && Array.isArray(v)) {
        const validCats = v.filter(c => ALL_CATEGORY_IDS.includes(c));
        if (validCats.length > 0) {
          map[k.trim()] = validCats;
        }
      }
    }
    return map;
  }
  return {};
}

/**
 * Resolves the categories assigned to a member. Checks by student ID, email, or idKey.
 */
export function getMemberCategoriesFromMap(accessMap, member) {
  if (!accessMap || typeof accessMap !== "object") return [];
  const stId = (member?.st_id || "").trim().toUpperCase();
  const email = (member?.email || "").trim().toLowerCase();
  const idKey = (member?.idKey || "").trim();

  for (const [key, cats] of Object.entries(accessMap)) {
    const k = key.trim();
    if (
      (stId && k.toUpperCase() === stId) ||
      (email && k.toLowerCase() === email) ||
      (idKey && (k.toUpperCase() === idKey.toUpperCase() || k.toLowerCase() === idKey.toLowerCase()))
    ) {
      return Array.isArray(cats) ? cats : [];
    }
  }
  return [];
}

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_TOTAL_STORAGE_BYTES = 9 * 1024 * 1024 * 1024; // 9 GB = 9,663,676,416 bytes

export const ALLOWED_EXTENSIONS = ["pdf", "docx", "doc", "png", "jpg", "jpeg", "webp", "zip", "7z"];

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "multipart/x-zip",
  "application/x-7z-compressed",
  "application/7z",
  "application/octet-stream"
];

/**
 * Validates whether adding a file of newFileSize would exceed the 9 GB total storage quota.
 * @param {number} currentTotalBytes - Current total size in bytes of existing documents
 * @param {number} newFileSizeBytes - Size in bytes of candidate file to upload
 * @returns {{ valid: boolean, error?: string, remainingBytes: number, projectedBytes: number, projectedPercentage: number }}
 */
export function validateStorageQuota(currentTotalBytes = 0, newFileSizeBytes = 0) {
  const current = Number(currentTotalBytes) || 0;
  const addition = Number(newFileSizeBytes) || 0;
  const projectedBytes = current + addition;
  const remainingBytes = Math.max(0, MAX_TOTAL_STORAGE_BYTES - current);
  const projectedPercentage = Math.min(100, (projectedBytes / MAX_TOTAL_STORAGE_BYTES) * 100);

  if (projectedBytes > MAX_TOTAL_STORAGE_BYTES) {
    const remainingStr = formatBytes(remainingBytes);
    const additionStr = formatBytes(addition);
    return {
      valid: false,
      error: `Storage limit reached (9 GB max). This upload (${additionStr}) exceeds the remaining available space (${remainingStr}). Please remove unused files first.`,
      remainingBytes,
      projectedBytes,
      projectedPercentage
    };
  }

  return {
    valid: true,
    remainingBytes,
    projectedBytes,
    projectedPercentage
  };
}

/**
 * Validates a file for type, extension, and size limits.
 */
export function validateDocumentFile(file, currentTotalBytes = null) {
  if (!file) {
    return { valid: false, error: "No file selected." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file format (.${ext}). Allowed: PDF, Word (.docx, .doc), Images (.png, .jpg, .webp), and Archives (.zip, .7z).`
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 25 MB.`
    };
  }

  if (currentTotalBytes !== null && currentTotalBytes !== undefined) {
    const quota = validateStorageQuota(currentTotalBytes, file.size);
    if (!quota.valid) {
      return { valid: false, error: quota.error };
    }
  }

  return { valid: true, ext };
}

/**
 * Determines friendly file type label ('PDF', 'Word', 'Image', 'Archive', or 'Other').
 */
export function getFileTypeCategory(mimeType, fileName) {
  const mime = (mimeType || "").toLowerCase();
  const ext = (fileName || "").split(".").pop()?.toLowerCase() || "";

  if (mime === "application/pdf" || ext === "pdf") return "PDF";
  if (
    mime.includes("word") ||
    mime.includes("officedocument") ||
    ext === "docx" ||
    ext === "doc"
  ) return "Word";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)) return "Image";
  if (
    mime.includes("zip") ||
    mime.includes("7z") ||
    mime.includes("compressed") ||
    ext === "zip" ||
    ext === "7z"
  ) return "Archive";
  return "Other";
}

/**
 * Formats byte size to human-readable string.
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, safeI)).toFixed(dm))} ${sizes[safeI]}`;
}

/**
 * Formats byte size specifically as Gigabytes (GB).
 */
export function formatGb(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return `0.${"0".repeat(decimals)} GB`;
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(decimals)} GB`;
}

/**
 * Fetches aggregate storage stats across the document collection.
 */
export async function getDocumentStorageStats() {
  const { data, error } = await supabase
    .from("documents")
    .select("category, file_type, file_size, visibility");

  if (error) throw new Error(error.message);

  const docs = data || [];
  let totalBytes = 0;
  const categorySizes = { All: 0, Events: 0, Budgets: 0, Permissions: 0, Guidance: 0 };
  const categoryCounts = { All: 0, Events: 0, Budgets: 0, Permissions: 0, Guidance: 0 };
  const typeSizes = { PDF: 0, Word: 0, Image: 0, Archive: 0, Other: 0 };
  const typeCounts = { PDF: 0, Word: 0, Image: 0, Archive: 0, Other: 0 };

  docs.forEach((doc) => {
    const size = Number(doc.file_size) || 0;
    totalBytes += size;
    categoryCounts.All = (categoryCounts.All || 0) + 1;
    categorySizes.All = (categorySizes.All || 0) + size;

    if (doc.category && categorySizes[doc.category] !== undefined) {
      categorySizes[doc.category] = (categorySizes[doc.category] || 0) + size;
      categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;
    }

    const t = doc.file_type || "Other";
    if (typeSizes[t] !== undefined) {
      typeSizes[t] = (typeSizes[t] || 0) + size;
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    } else {
      typeSizes.Other = (typeSizes.Other || 0) + size;
      typeCounts.Other = (typeCounts.Other || 0) + 1;
    }
  });

  const remainingBytes = Math.max(0, MAX_TOTAL_STORAGE_BYTES - totalBytes);
  const percentage = Math.min(100, (totalBytes / MAX_TOTAL_STORAGE_BYTES) * 100);

  return {
    totalBytes,
    maxBytes: MAX_TOTAL_STORAGE_BYTES,
    remainingBytes,
    percentage,
    categorySizes,
    categoryCounts,
    typeSizes,
    typeCounts,
    totalFiles: docs.length
  };
}

/**
 * Extracts a readable error message from Supabase Edge Function error responses.
 */
async function extractErrorMessage(error, defaultMsg = "An error occurred.") {
  if (!error) return defaultMsg;
  if (error.context) {
    try {
      const cloned = error.context.clone ? error.context.clone() : error.context;
      const body = await cloned.json();
      if (body?.error) return body.error + (body.details ? ` - ${body.details}` : "");
      if (body?.message) return body.message;
    } catch (_) {
      try {
        const text = await error.context.text();
        if (text) return text;
      } catch (_) {}
    }
  }
  if (error.message === "Failed to fetch") {
    return "Network connection failed or document-storage service is unreachable. Please verify Edge Function deployment and CORS configuration.";
  }
  return error.message || defaultMsg;
}

/**
 * Checks Cloudflare R2 backend configuration status.
 */
export async function checkR2Config() {
  try {
    const { data, error } = await supabase.functions.invoke("document-storage", {
      body: { action: "check_config" }
    });
    if (error) {
      const msg = await extractErrorMessage(error, error.message);
      return { configured: false, error: msg };
    }
    return data || { configured: false };
  } catch (err) {
    return { configured: false, error: err.message };
  }
}

/**
 * Uploads a document via Cloudflare R2 pre-signed PUT URL and stores metadata in Supabase.
 */
export async function uploadDocument({
  file,
  name,
  category,
  description = "",
  visibility = "public_to_members",
  eventId = null,
  stId = null,
  session,
  currentTotalBytes = null
}) {
  // 1. Client-side validation (file format, single file 25MB max, and 9GB total storage ceiling)
  const validation = validateDocumentFile(file, currentTotalBytes);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const fileType = getFileTypeCategory(file.type, file.name);

  // 2. Request pre-signed upload URL from Supabase Edge Function
  let presignedData, presignedError;
  try {
    const res = await supabase.functions.invoke(
      "document-storage",
      {
        body: {
          action: "get_upload_url",
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          category
        }
      }
    );
    presignedData = res.data;
    presignedError = res.error;
  } catch (err) {
    throw new Error(await extractErrorMessage(err, "Failed to connect to storage service."));
  }

  if (presignedError) {
    const msg = await extractErrorMessage(presignedError, "Failed to initialize upload.");
    throw new Error(msg);
  }

  if (presignedData?.error) {
    throw new Error(presignedData.error + (presignedData.details ? ` - ${presignedData.details}` : ""));
  }

  const { uploadUrl, key } = presignedData;
  if (!uploadUrl || !key) {
    throw new Error("Did not receive a valid upload URL from storage server.");
  }

  // 3. Upload binary directly to Cloudflare R2 via HTTP PUT
  let uploadResponse;
  try {
    uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type || "application/octet-stream"
      }
    });
  } catch (uploadErr) {
    throw new Error(
      "Cloudflare R2 upload failed (Failed to fetch). Please ensure CORS is enabled on your Cloudflare R2 bucket with Allowed Origins: * (or your domain) and Allowed Methods: PUT, GET."
    );
  }

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload file to Cloudflare R2 (${uploadResponse.status} ${uploadResponse.statusText})`);
  }

  // 4. Save metadata record into Supabase Postgres
  const uploaderName = session?.preferredName || session?.name || session?.email || "Officer";
  const docRecord = {
    name: (name || file.name).trim(),
    file_name: file.name,
    file_type: fileType,
    mime_type: file.type || "application/octet-stream",
    file_size: file.size,
    category,
    r2_key: key,
    uploaded_by: session?.userId || null,
    uploader_name: uploaderName,
    uploaded_by_st_id: session?.stId || null,
    visibility,
    event_id: eventId || null,
    st_id: stId || null,
    description: (description || "").trim()
  };

  let { data: insertedDoc, error: dbError } = await supabase
    .from("documents")
    .insert([docRecord])
    .select()
    .single();

  // If the database has a legacy check constraint not yet permitting 'Archive', fallback to 'Other'
  if (dbError && fileType === "Archive" && (dbError.message?.toLowerCase().includes("check constraint") || dbError.details?.toLowerCase().includes("check constraint"))) {
    const fallbackRecord = { ...docRecord, file_type: "Other" };
    const retryRes = await supabase
      .from("documents")
      .insert([fallbackRecord])
      .select()
      .single();
    if (!retryRes.error) {
      insertedDoc = retryRes.data;
      dbError = null;
    }
  }

  if (dbError) {
    // Clean up uploaded file in R2 if DB insertion fails
    try {
      await supabase.functions.invoke("document-storage", {
        body: { action: "delete_file", key }
      });
    } catch (_) {}
    throw new Error(`Failed to save document metadata: ${dbError.message}`);
  }

  return insertedDoc;
}

/**
 * Requests a time-limited signed URL to download or preview a document.
 * @param {string} documentId
 * @param {string} key
 * @param {'inline' | 'attachment'} [disposition='inline']
 */
export async function getDocumentSignedUrl(documentId, key, disposition = "inline") {
  let data, error;
  try {
    const res = await supabase.functions.invoke("document-storage", {
      body: {
        action: "get_download_url",
        documentId,
        key,
        disposition
      }
    });
    data = res.data;
    error = res.error;
  } catch (err) {
    throw new Error(await extractErrorMessage(err, "Failed to connect to storage service."));
  }

  if (error) {
    const msg = await extractErrorMessage(error, "Failed to retrieve signed download URL.");
    throw new Error(msg);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

/**
 * Triggers a direct automatic file download in the browser.
 * For PDFs and Images, fetching as a blob and downloading from a local blob URL
 * prevents the browser from simply opening the file in a new tab.
 */
export async function downloadDocumentFile(doc) {
  if (!doc) throw new Error("No document specified for download.");

  // Request signed URL with Content-Disposition: attachment
  const { downloadUrl } = await getDocumentSignedUrl(doc.id, doc.r2_key, "attachment");
  const fileName = doc.file_name || doc.name || "download";

  try {
    // 1. Fetch file data as blob to guarantee immediate browser download
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 1000);
  } catch (err) {
    console.warn("Direct blob download failed, falling back to direct anchor:", err);
    // 2. Fallback: Trigger direct anchor with signed URL (which has Content-Disposition: attachment)
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * Deletes a document from both Cloudflare R2 and Supabase Postgres.
 */
export async function deleteDocument(documentId, key) {
  let data, error;
  try {
    const res = await supabase.functions.invoke("document-storage", {
      body: {
        action: "delete_file",
        documentId,
        key
      }
    });
    data = res.data;
    error = res.error;
  } catch (err) {
    throw new Error(await extractErrorMessage(err, "Failed to connect to storage service."));
  }

  if (error) {
    const msg = await extractErrorMessage(error, "Failed to delete file from storage.");
    throw new Error(msg);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

/**
 * Updates document metadata (title, category, visibility, description, eventId, stId).
 */
export async function updateDocumentMetadata(documentId, updates) {
  const { data, error } = await supabase
    .from("documents")
    .update({
      name: updates.name,
      category: updates.category,
      visibility: updates.visibility,
      event_id: updates.event_id || null,
      st_id: updates.st_id || null,
      description: updates.description || ""
    })
    .eq("id", documentId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
