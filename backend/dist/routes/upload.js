import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
const router = Router();
// 上传目录：backend/uploads（已加入 .gitignore）
const uploadDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).slice(0, 16).toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
});
// 上传类型白名单：禁止 html/svg/js 等可执行/可内嵌脚本的文件（防存储型 XSS）
const ALLOWED_EXT = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', '7z', 'txt', 'md', 'csv',
]);
const ALLOWED_MIME = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'text/plain', 'text/markdown', 'text/csv',
]);
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).slice(1).toLowerCase();
        const mimeOk = file.mimetype.startsWith('image/') || ALLOWED_MIME.has(file.mimetype);
        if (ALLOWED_EXT.has(ext) && mimeOk) {
            cb(null, true);
            return;
        }
        cb(new Error('不支持的文件类型：仅允许图片、常见文档、压缩包与文本文件'));
    },
});
// 上传图片或文件，返回访问 URL
router.post('/', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) {
        res.status(400).json({ ok: false, error: '未收到文件' });
        return;
    }
    const relativeUrl = `/uploads/${req.file.filename}`;
    const fullUrl = config.publicUrl ? `${config.publicUrl}${relativeUrl}` : relativeUrl;
    res.json({
        ok: true,
        data: {
            url: fullUrl,
            name: req.file.originalname,
            size: req.file.size,
        },
    });
});
export default router;
//# sourceMappingURL=upload.js.map