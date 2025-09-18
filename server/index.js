const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
dotenv.config();
const uploadRoutes = require('./routes/upload');
const transactionRoutes = require('./routes/transactions');
connectDB()

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.send('AI Finance Tracker API is running');
});

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/transactions', transactionRoutes);
// Process route for AI processing
app.use('/api/process', require('./routes/process'));
// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});