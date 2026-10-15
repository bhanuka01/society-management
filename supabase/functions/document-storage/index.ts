import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@3.540.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.540.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Allowed categories matching the society requirements
const ALLOWED_CATEGORIES = ['Events', 'Budgets', 'Permissions', 'Guidance'];

// Allowed file types & MIME mappings
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'multipart/x-zip',
  'application/x-7z-compressed',
  'application/7z',
  'application/octet-stream',
]);

const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'doc', 'png', 'jpg', 'jpeg', 'webp', 'zip', '7z']);

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_TOTAL_STORAGE_BYTES = 9 * 1024 * 1024 * 1024; // 9 GB maximum total storage limit

const sanitizeFilename = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
};

const mapMimeToCategoryType = (mimeType: string, extension: string): 'PDF' | 'Word' | 'Image' | 'Archive' | 'Other' => {
  const mime = (mimeType || '').toLowerCase();
  const ext = (extension || '').toLowerCase();
  if (mime === 'application/pdf' || ext === 'pdf') return 'PDF';
  if (
    mime.includes('word') ||
    mime.includes('officedocument') ||
    ext === 'docx' ||
    ext === 'doc'
  ) return 'Word';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'Image';
  if (
    mime.includes('zip') ||
    mime.includes('7z') ||
    mime.includes('compressed') ||
    ext === 'zip' ||
    ext === '7z'
  ) return 'Archive';
  return 'Other';
};

let cachedS3Client: S3Client | null = null;
let lastS3ConfigKey = '';

function getOrCreateS3Client(accountId: string, accessKeyId: string, secretAccessKey: string): S3Client {
  const configKey = `${accountId}:${accessKeyId}`;
  if (!cachedS3Client || lastS3ConfigKey !== configKey) {
    cachedS3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    lastS3ConfigKey = configKey;
  }
  return cachedS3Client;
}

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing in environment.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user via bearer token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired session.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for privileged checks and DB queries
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
    );

    // Fetch user profile to verify role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, full_name, preferred_name, st_id, email')
      .eq('id', user.id)
      .maybeSingle();

    const userRole = profile?.role || 'member';
    const isStaff = userRole === 'admin' || userRole === 'editor';

    // Cloudflare R2 Credentials
    const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID');
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME') || 'society-documents';

    const isR2Configured = Boolean(
      R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME
    );

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── ACTION: Check Configuration ──────────────────────────────────────────
    if (action === 'check_config') {
      let totalBytes = 0;
      let totalCount = 0;
      try {
        const { data: storageDocs } = await supabaseAdmin.from('documents').select('file_size');
        totalBytes = (storageDocs || []).reduce((sum: number, d: { file_size: number | string }) => sum + (Number(d.file_size) || 0), 0);
        totalCount = storageDocs?.length || 0;
      } catch (_) {}

      return new Response(
        JSON.stringify({
          configured: isR2Configured,
          bucket: R2_BUCKET_NAME,
          totalBytes,
          maxBytes: MAX_TOTAL_STORAGE_BYTES,
          totalCount,
          missing: [
            !R2_ACCOUNT_ID && 'R2_ACCOUNT_ID',
            !R2_ACCESS_KEY_ID && 'R2_ACCESS_KEY_ID',
            !R2_SECRET_ACCESS_KEY && 'R2_SECRET_ACCESS_KEY',
          ].filter(Boolean),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── ACTION: Storage Usage Stats ─────────────────────────────────────────
    if (action === 'get_storage_stats') {
      const { data: storageDocs, error: storageErr } = await supabaseAdmin
        .from('documents')
        .select('category, file_type, file_size');

      if (storageErr) {
        return new Response(
          JSON.stringify({ error: storageErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const docs = storageDocs || [];
      let totalBytes = 0;
      const categorySizes: Record<string, number> = { Events: 0, Budgets: 0, Permissions: 0, Guidance: 0 };
      const categoryCounts: Record<string, number> = { Events: 0, Budgets: 0, Permissions: 0, Guidance: 0 };
      const typeSizes: Record<string, number> = { PDF: 0, Word: 0, Image: 0, Archive: 0, Other: 0 };

      for (const d of docs) {
        const sz = Number(d.file_size) || 0;
        totalBytes += sz;
        if (d.category && categorySizes[d.category] !== undefined) {
          categorySizes[d.category] += sz;
          categoryCounts[d.category] += 1;
        }
        const t = d.file_type || 'Other';
        if (typeSizes[t] !== undefined) {
          typeSizes[t] += sz;
        } else {
          typeSizes['Other'] = (typeSizes['Other'] || 0) + sz;
        }
      }

      return new Response(
        JSON.stringify({
          totalBytes,
          maxBytes: MAX_TOTAL_STORAGE_BYTES,
          remainingBytes: Math.max(0, MAX_TOTAL_STORAGE_BYTES - totalBytes),
          percentage: Math.min(100, (totalBytes / MAX_TOTAL_STORAGE_BYTES) * 100),
          fileCount: docs.length,
          categorySizes,
          categoryCounts,
          typeSizes,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isR2Configured) {
      return new Response(
        JSON.stringify({
          error: 'Cloudflare R2 storage credentials are not configured.',
          details: 'Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in Supabase Edge Secrets.',
          isConfigError: true,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize or reuse S3 Client configured for Cloudflare R2
    const s3Client = getOrCreateS3Client(R2_ACCOUNT_ID!, R2_ACCESS_KEY_ID!, R2_SECRET_ACCESS_KEY!);

    // ── ACTION: Get Signed Upload URL (Officers Only) ─────────────────────────
    if (action === 'get_upload_url') {
      if (!isStaff) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Only society officers (admin/editor) can upload documents.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { fileName, mimeType, fileSize, category } = body;

      if (!fileName || !category) {
        return new Response(
          JSON.stringify({ error: 'fileName and category are required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!ALLOWED_CATEGORIES.includes(category)) {
        return new Response(
          JSON.stringify({ error: `Invalid category. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return new Response(
          JSON.stringify({ error: `Unsupported file extension '.${ext}'. Allowed: PDF, DOCX, DOC, PNG, JPG, JPEG, WEBP, ZIP, 7Z.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (fileSize && fileSize > MAX_FILE_SIZE_BYTES) {
        return new Response(
          JSON.stringify({ error: 'File size exceeds 25 MB limit.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── Storage quota check: Ensure total repository size does not exceed 9 GB
      const { data: storageDocs } = await supabaseAdmin
        .from('documents')
        .select('file_size');
      const currentTotalBytes = (storageDocs || []).reduce(
        (sum: number, d: { file_size: number | string }) => sum + (Number(d.file_size) || 0),
        0
      );
      const incomingSize = Number(fileSize) || 0;

      if (currentTotalBytes + incomingSize > MAX_TOTAL_STORAGE_BYTES) {
        const currentGb = (currentTotalBytes / (1024 * 1024 * 1024)).toFixed(2);
        const freeMb = Math.max(0, (MAX_TOTAL_STORAGE_BYTES - currentTotalBytes) / (1024 * 1024)).toFixed(1);
        return new Response(
          JSON.stringify({
            error: 'Storage quota exceeded: Total repository size cannot exceed 9 GB.',
            details: `Storage currently at ${currentGb} GB / 9.00 GB (${freeMb} MB remaining). Uploading this file would exceed the 9 GB maximum capacity.`,
            currentBytes: currentTotalBytes,
            maxBytes: MAX_TOTAL_STORAGE_BYTES
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const fileType = mapMimeToCategoryType(mimeType, ext);
      const cleanName = sanitizeFilename(fileName);
      const uniqueId = crypto.randomUUID().slice(0, 8);
      const objectKey = `documents/${category.toLowerCase()}/${Date.now()}_${uniqueId}_${cleanName}`;

      const putCommand = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
        ContentType: mimeType || 'application/octet-stream',
      });

      // Pre-signed URL valid for 15 minutes (900 seconds)
      const uploadUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 900 });

      return new Response(
        JSON.stringify({
          uploadUrl,
          key: objectKey,
          fileName,
          fileType,
          mimeType,
          category,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── ACTION: Get Signed Download / Preview URL (Role Based) ───────────────
    if (action === 'get_download_url') {
      const { documentId, key } = body;

      if (!documentId && !key) {
        return new Response(
          JSON.stringify({ error: 'documentId or key is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Query document from Supabase Postgres
      let query = supabaseAdmin.from('documents').select('*');
      if (documentId) {
        query = query.eq('id', documentId);
      } else {
        query = query.eq('r2_key', key);
      }

      const { data: doc, error: docError } = await query.maybeSingle();

      if (docError || !doc) {
        return new Response(
          JSON.stringify({ error: 'Document record not found in database.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check category visibility rules:
      // 'officers_only' documents can ONLY be retrieved by officers (admin or editor)
      if (doc.visibility === 'officers_only' && !isStaff) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: This document is restricted to society officers only.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For non-officer users, verify they are admin-selected members permitted to access this document's category
      if (!isStaff) {
        const { data: settingData } = await supabaseAdmin
          .from('system_settings')
          .select('value')
          .eq('key', 'document_access_members')
          .maybeSingle();

        let parsedSetting: any = null;
        try {
          if (settingData?.value) {
            parsedSetting = JSON.parse(settingData.value);
          }
        } catch (_) {
          parsedSetting = null;
        }

        const userStId = (profile?.st_id || '').trim().toUpperCase();
        const userEmail = (profile?.email || user.email || '').trim().toLowerCase();
        let userAllowedCategories: string[] = [];
        let hasAnyAccess = false;

        if (Array.isArray(parsedSetting)) {
          // Legacy array format: member has access to all categories
          const isMemberListed = parsedSetting.some(id => {
            const val = (id || '').trim();
            return (userStId && val.toUpperCase() === userStId) ||
                   (userEmail && val.toLowerCase() === userEmail);
          });
          if (isMemberListed) {
            hasAnyAccess = true;
            userAllowedCategories = ALLOWED_CATEGORIES;
          }
        } else if (parsedSetting && typeof parsedSetting === 'object') {
          // Granular dictionary format: { "ST_ID": ["Guidance", "Permissions"] }
          for (const [key, categories] of Object.entries(parsedSetting)) {
            const normKey = (key || '').trim();
            if (
              (userStId && normKey.toUpperCase() === userStId) ||
              (userEmail && normKey.toLowerCase() === userEmail)
            ) {
              if (Array.isArray(categories)) {
                hasAnyAccess = true;
                userAllowedCategories = categories as string[];
              }
              break;
            }
          }
        }

        if (!hasAnyAccess) {
          return new Response(
            JSON.stringify({ error: 'Forbidden: You do not have permission to view or download society documents.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if user is authorized for this specific document's category
        const docCategory = doc.category;
        const isCategoryAllowed = userAllowedCategories.some(
          cat => (cat || '').toLowerCase() === (docCategory || '').toLowerCase()
        );

        if (!isCategoryAllowed) {
          return new Response(
            JSON.stringify({
              error: `Forbidden: You do not have permission to access documents in the "${docCategory}" category.`
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const disposition = body.disposition === 'attachment' ? 'attachment' : 'inline';
      const cleanFileName = (doc.file_name || 'document').replace(/["\r\n]/g, '_');

      const getCommand = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: doc.r2_key,
        ResponseContentDisposition: `${disposition}; filename="${encodeURIComponent(cleanFileName)}"`,
      });

      // Pre-signed URL valid for 1 hour (3600 seconds)
      const downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

      return new Response(
        JSON.stringify({
          downloadUrl,
          expiresIn: 3600,
          fileName: doc.file_name,
          mimeType: doc.mime_type,
          fileType: doc.file_type,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── ACTION: Delete File (Officers Only) ───────────────────────────────────
    if (action === 'delete_file') {
      if (!isStaff) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Only society officers (admin/editor) can delete documents.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { documentId, key } = body;

      if (!documentId && !key) {
        return new Response(
          JSON.stringify({ error: 'documentId or key is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Retrieve key if not provided
      let targetKey = key;
      if (!targetKey && documentId) {
        const { data: doc } = await supabaseAdmin
          .from('documents')
          .select('r2_key')
          .eq('id', documentId)
          .maybeSingle();
        targetKey = doc?.r2_key;
      }

      // Delete object from Cloudflare R2
      if (targetKey) {
        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: targetKey,
          });
          await s3Client.send(deleteCommand);
        } catch (s3Err: any) {
          console.error('Failed to delete object from R2:', s3Err);
        }
      }

      // Delete database record
      if (documentId) {
        await supabaseAdmin.from('documents').delete().eq('id', documentId);
      } else if (targetKey) {
        await supabaseAdmin.from('documents').delete().eq('r2_key', targetKey);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Document deleted successfully.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Document storage edge function error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
