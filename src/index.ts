import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const app = express();
const port = 3001;

// Mock database for documents
let documents: any[] = [];

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Multer setup for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// --- API Endpoints ---

// Upload a new document
app.post('/api/documents', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const { title, description, category, department, confidentiality, tags } = req.body;
  
  const newDocument = {
    id: `DOC-${Date.now()}`,
    title,
    description,
    category,
    department,
    confidentiality,
    tags: tags ? tags.split(',') : [],
    fileName: req.file.filename,
    originalName: req.file.originalname,
    filePath: `/uploads/${req.file.filename}`,
    fileSize: req.file.size,
    fileType: req.file.mimetype,
    uploadDate: new Date().toISOString(),
    status: 'pending', // Default status
    version: 1,
     // Using mock user as requested
    uploadedBy: 'Ahmed Hassan',
  };

  documents.push(newDocument);
  console.log('New document uploaded:', newDocument);
  res.status(201).json(newDocument);
});

// Get all documents
app.get('/api/documents', (req, res) => {
  res.json(documents);
});

// Get a single document by ID
app.get('/api/documents/:id', (req, res) => {
  const document = documents.find(doc => doc.id === req.params.id);
  if (!document) {
    return res.status(404).send('Document not found.');
  }
  res.json(document);
});

// Download a document file
app.get('/api/documents/:id/download', (req, res) => {
  const document = documents.find(doc => doc.id === req.params.id);
  if (!document) {
    return res.status(404).send('Document not found.');
  }
  const filePath = path.join(uploadsDir, document.fileName);
  res.download(filePath, document.originalName, (err) => {
    if (err) {
      console.error('File download error:', err);
      res.status(500).send('Could not download the file.');
    }
  });
});

app.listen(port, () => {
  console.log(`Backend server is running at http://localhost:${port}`);
});
