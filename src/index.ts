import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

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

// Serve uploaded files with CORS headers
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}, express.static(uploadsDir));

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
    tags: tags ? tags.split(',').map((tag: string) => tag.trim()) : [],
    fileName: req.file.filename,
    originalName: req.file.originalname,
    filePath: `/uploads/${req.file.filename}`,
    fileSize: req.file.size,
    fileType: req.file.mimetype,
    uploadDate: new Date().toISOString(),
    status: 'pending', // Default status
    version: 1,
    uploadedBy: 'Ahmed Mohamud', // Using mock user as requested
    history: [
      {
user: 'Ahmed Mohamud',
        changes: 'Initial upload',
      },
    ],
  };

  documents.push(newDocument);
  console.log('New document uploaded:', newDocument);
  res.status(201).json(newDocument);
});

// Get all documents (with filtering)
app.get('/api/documents', (req, res) => {
  const { q, category, department, status, confidentiality, dateFrom, dateTo } = req.query;

  let filteredDocuments = documents;

  if (q) {
    const searchTerm = q.toString().toLowerCase();
    filteredDocuments = filteredDocuments.filter(doc =>
      doc.title.toLowerCase().includes(searchTerm) ||
      doc.description.toLowerCase().includes(searchTerm) ||
      doc.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm))
    );
  }

  if (category) {
    filteredDocuments = filteredDocuments.filter(doc => doc.category === category);
  }

  if (department) {
    filteredDocuments = filteredDocuments.filter(doc => doc.department === department);
  }

  if (status) {
    filteredDocuments = filteredDocuments.filter(doc => doc.status === status);
  }

  if (confidentiality) {
    filteredDocuments = filteredDocuments.filter(doc => doc.confidentiality === confidentiality);
  }

  if (dateFrom) {
    filteredDocuments = filteredDocuments.filter(doc => new Date(doc.uploadDate) >= new Date(dateFrom.toString()));
  }

  if (dateTo) {
    filteredDocuments = filteredDocuments.filter(doc => new Date(doc.uploadDate) <= new Date(dateTo.toString()));
  }

  res.json(filteredDocuments);
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

// Delete a document
app.delete('/api/documents/:id', (req, res) => {
  const documentIndex = documents.findIndex(doc => doc.id === req.params.id);
  if (documentIndex === -1) {
    return res.status(404).send('Document not found.');
  }
  
  // Also delete the physical file
  const document = documents[documentIndex];
  const filePath = path.join(uploadsDir, document.fileName);
  fs.unlink(filePath, (err) => {
    if (err) {
      // Log the error but don't block the metadata deletion
      console.error('Failed to delete physical file:', err);
    }
  });

  documents.splice(documentIndex, 1);
  console.log('Document deleted:', req.params.id);
  res.status(204).send();
});

// Update a document
app.put('/api/documents/:id', (req, res) => {
  const documentIndex = documents.findIndex(doc => doc.id === req.params.id);
  if (documentIndex === -1) {
    return res.status(404).send('Document not found.');
  }

  const originalDocument = documents[documentIndex];
  const newVersion = originalDocument.version + 1;

  const updatedDocument = {
    ...originalDocument,
    ...req.body,
    version: newVersion,
    history: [
      {
        version: newVersion,
        date: new Date().toISOString(),
        user: 'Ahmed Mohamud', // Mock user
        changes: 'Metadata updated',
      },
      ...originalDocument.history,
    ],
  };

  documents[documentIndex] = updatedDocument;
  
  console.log('Document updated:', updatedDocument);
  res.json(updatedDocument);
});

// Update a document's status (for approval/rejection)
app.patch('/api/documents/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).send('Invalid status.');
  }

  const documentIndex = documents.findIndex(doc => doc.id === req.params.id);
  if (documentIndex === -1) {
    return res.status(404).send('Document not found.');
  }

  documents[documentIndex].status = status;
  console.log(`Document ${req.params.id} status updated to ${status}`);
  res.json(documents[documentIndex]);
});

// Get dashboard statistics
app.get('/api/stats', (req, res) => {
  const totalDocuments = documents.length;
  const pendingApprovals = documents.filter(doc => doc.status === 'pending').length;
  const storageUsedInBytes = documents.reduce((acc, doc) => acc + doc.fileSize, 0);
  const storageUsed = `${(storageUsedInBytes / 1024 / 1024).toFixed(2)} MB`;
  
  // activeUsers would be dynamic in a real app
  const activeUsers = 5; 

  res.json({
    totalDocuments,
    pendingApprovals,
    storageUsed,
    activeUsers
  });
});

// Get recent activities
app.get('/api/activities', (req, res) => {
  const allActivities = documents.flatMap(doc => 
    doc.history.map((entry: any) => ({
      ...entry,
      documentId: doc.id,
      documentTitle: doc.title,
    }))
  );

  allActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const recentActivities = allActivities.slice(0, 5);

  res.json(recentActivities);
});

app.listen(port, () => {
  console.log(`Backend server is running at http://localhost:${port}`);
});
