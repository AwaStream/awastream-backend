const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const MongoStore = require('connect-mongo'); 
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();

app.set('trust proxy', 1);

// --- Middleware ---

const allowedOrigins = [
    'http://localhost:5173',
    'https://awastream.onrender.com',
    'https://awastream.com',
    process.env.FRONTEND_URL
];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json({
    // We need the raw body for Stripe webhook verification
    verify: (req, res, buf) => {
        if (req.originalUrl.startsWith('/api/v1/payments/webhook/stripe')) {
            req.rawBody = buf.toString();
        }
    }
}));
app.use(cookieParser());


// --- 2. UPGRADE SESSION STORE FOR PRODUCTION ---
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGO_URI 
    }),
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
}));

app.use(passport.initialize());
require('./config/passport-setup');


// --- API Routes ---
const authRoutes = require('./routes/authRoutes');
const videoRoutes = require('./routes/videoRoutes');
const creatorRoutes = require('./routes/creatorRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const accessRoutes = require('./routes/accessRoutes');
const utilsRoutes = require('./routes/utilsRoute');
const viewerRoutes = require('./routes/viewerRoutes');
const creatorPublicRoutes = require('./routes/creatorPublicRoutes');
const commentRoutes = require('./routes/commentRoutes');



app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/videos', videoRoutes);
app.use('/api/v1/creator', creatorRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/access', accessRoutes);
app.use('/api/v1/utils', utilsRoutes);
app.use('/api/v1/viewer', viewerRoutes);
app.use('/api/v1/creators', creatorPublicRoutes);
app.use('/api/v1/comments', commentRoutes);

// --- Health Check Route ---
app.get('/', (req, res) => {
    res.send('AwaStream API is running...');
});

// --- Error Handling Middleware ---
app.use(notFound);
app.use(errorHandler);

// --- Start Server ---
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});