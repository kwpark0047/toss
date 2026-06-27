const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');

// 업로드 디렉토리 확인 및 생성
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
    cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 제한
    fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
    return cb(null, true);
    }
    cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
});

/**
 * 단일 이미지 업로드
 */
router.post('/image', authMiddleware, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: '파일이 없습니다.' });
    }
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({
        success: true,
        url: imageUrl,
        filename: req.file.filename
    });
});

/**
 * 다중 이미지 업로드
 */
router.post('/images', authMiddleware, upload.array('images', 10), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, error: '파일이 없습니다.' });
    }
    const urls = req.files.map(file => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`);
    res.json({
        success: true,
        urls: urls
    });
});

/**
 * 이미지 파일 삭제
 */
router.delete('/image/:filename', authMiddleware, (req, res) => {
    const { filename } = req.params;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ success: false, error: '잘못된 파일 이름입니다.' });
    }

    const filePath = path.join(uploadDir, filename);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true, message: '파일이 성공적으로 삭제되었습니다.' });
    } else {
        res.status(404).json({ success: false, error: '파일을 찾을 수 없습니다.' });
    }
});

module.exports = router;
