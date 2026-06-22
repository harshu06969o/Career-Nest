import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import type { Request, Response, NextFunction } from 'express';

// =============================================================================
// Cloudinary Configuration
// =============================================================================
// Credentials are read exclusively from environment variables — never hardcoded.
// Required .env keys:
//   CLOUDINARY_CLOUD_NAME  — your cloud name (e.g. "dxxxxxx")
//   CLOUDINARY_API_KEY     — numeric API key (e.g. "123456789012345")
//   CLOUDINARY_API_SECRET  — API secret (treat like a password)
//
// Obtain all three from https://console.cloudinary.com → Settings → API Keys.
// =============================================================================
cloudinary.config({
  cloud_name: process.env['CLOUDINARY_CLOUD_NAME'] ?? '',
  api_key:    process.env['CLOUDINARY_API_KEY']    ?? '',
  api_secret: process.env['CLOUDINARY_API_SECRET'] ?? '',
});

// =============================================================================
// Cloudinary Storage Engine
// =============================================================================
// Files are streamed directly from memory to Cloudinary — they are NEVER
// written to the local disk. This is the core fix for the ephemeral-storage
// production bottleneck identified in the pre-deployment audit.
//
// Configuration:
//   folder         — organises uploads under a dedicated "careernest_resumes"
//                    folder in your Cloudinary media library
//   allowedFormats — Cloudinary's own format gate; rejects non-PDFs at the
//                    upload layer (defence-in-depth alongside our MIME filter)
//   resource_type  — "raw" is required for PDFs; "image"/"video" won't work
//   use_filename   — false: Cloudinary generates a unique public_id (UUIDv4-like)
//   unique_filename — true: appends a random suffix to prevent collisions
// =============================================================================
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:           'careernest_resumes',
    allowed_formats:  ['pdf'],
    resource_type:    'raw',
    use_filename:     false,
    unique_filename:  true,
  } as object, // CloudinaryStorage params type accepts additional keys via intersection
});

// =============================================================================
// File Type Filter — STRICT PDF-only Gate (MIME inspection)
// =============================================================================
// MIME type check runs before bytes hit Cloudinary, rejecting non-PDF attempts
// at the Express layer.  File extensions are easily spoofed (shell.php → resume.pdf),
// so MIME-type inspection is the authoritative gate.
// =============================================================================
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb:   multer.FileFilterCallback,
): void => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF files (.pdf) are accepted.'));
  }
};

// =============================================================================
// Multer Instance (Cloudinary-backed)
// =============================================================================
const upload = multer({
  storage: cloudinaryStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB hard cap — prevents storage cost abuse
    files: 1,                  // Single-file endpoint — reject multi-file abuse
  },
});

// =============================================================================
// uploadResumeSingle — Wrapped Middleware Export
// =============================================================================
// Multer errors are not caught by Express's default error handler when using
// upload.single() directly in a route array.  We wrap it so MulterErrors
// (LIMIT_FILE_SIZE, LIMIT_UNEXPECTED_FILE, etc.) and our custom fileFilter
// error both return clean JSON instead of crashing the request pipeline.
//
// After this middleware resolves successfully:
//   req.file.path     — the HTTPS Cloudinary secure URL  ← used by controller
//   req.file.filename — the Cloudinary public_id
// =============================================================================
export const uploadResumeSingle = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('resume')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          success: false,
          message: 'File too large. Maximum allowed size is 5 MB.',
        });
        return;
      }
      res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
      return;
    }

    if (err instanceof Error) {
      // Custom fileFilter error (invalid MIME type)
      res.status(400).json({ success: false, message: err.message });
      return;
    }

    // No error — file is on Cloudinary, req.file.path = secure_url
    next();
  });
};
