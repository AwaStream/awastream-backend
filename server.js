const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const passport = require('passport');
const cookieParser = require('cookie-parser') 
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();

// --- Middleware ---
app.use(cors());

// Body parser middleware to accept JSON data
app.use(express.json());
app.use(cookieParser());

// Passport middleware for authentication
app.use(passport.initialize());
require('./config/passport-setup');

// --- API Routes ---
const authRoutes = require('./routes/authRoutes');
const videoRoutes = require('./routes/videoRoutes');
const creatorRoutes = require('./routes/creatorRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/videos', videoRoutes);
app.use('/api/v1/creator', creatorRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);

// --- Health Check Route ---
app.get('/', (req, res) => {
    res.send('AwaStream API is running...');
});

// --- Error Handling Middleware ---
// This must be the last thing you app.use()
app.use(notFound);
app.use(errorHandler);

// --- Start Server ---
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});