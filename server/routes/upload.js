const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Statement = require('../models/Statement');

// Configure multer to use memory storage instead of disk storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  // Accept PDF, CSV, TXT, XLS, and XLSX files
  const allowedFileTypes = ['.pdf', '.csv', '.txt', '.xls', '.xlsx'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  // Additional MIME type validation
  const allowedMimeTypes = [
    'application/pdf',
    'text/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (allowedFileTypes.includes(fileExtension) && allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, CSV, TXT, XLS, and XLSX files are allowed.'), false);
  }
};

// Initialize multer upload
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Route for file upload
router.post('/', upload.array('statements', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const fileIds = [];
    
    // Save file content and information to database
    for (const file of req.files) {
      const newStatement = new Statement({
        originalFilename: file.originalname,
        fileType: path.extname(file.originalname).substring(1),
        fileSize: file.size,
        fileContent: file.buffer, // Store the actual file content
        mimeType: file.mimetype
      });

      const savedStatement = await newStatement.save();
      fileIds.push(savedStatement._id);
    }

    res.status(201).json({ 
      message: 'Files uploaded successfully', 
      fileIds,
      count: req.files.length
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server error during upload', error: error.message });
  }
});

// Route to get list of uploaded files
router.get('/', async (req, res) => {
  try {
    const statements = await Statement.find({}, {
      fileContent: 0 // Exclude file content from list to reduce response size
    }).sort({ uploadDate: -1 });
    
    res.status(200).json(statements);
  } catch (error) {
    console.error('Error fetching statements:', error);
    res.status(500).json({ message: 'Server error fetching statements', error: error.message });
  }
});

// Route to download a specific file
router.get('/:id/download', async (req, res) => {
  try {
    const statement = await Statement.findById(req.params.id);
    
    if (!statement) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    res.set({
      'Content-Type': statement.mimeType,
      'Content-Disposition': `attachment; filename="${statement.originalFilename}"`,
      'Content-Length': statement.fileSize
    });
    
    res.send(statement.fileContent);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ message: 'Server error downloading file', error: error.message });
  }
});

module.exports = router;