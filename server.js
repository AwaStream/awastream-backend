// const express = require('express');
// const dotenv = require('dotenv');
// const helmet = require('helmet')
// const cors = require('cors');
// const session = require('express-session');
// const passport = require('passport');
// const cookieParser = require('cookie-parser');
// const MongoStore = require('connect-mongo'); 
// const connectDB = require('./config/db');
// require('./config/redisClient');
// const { notFound } = require('./middleware/errorMiddleware');
// const logger = require('./config/logger');
// const { authLimiter, apiLimiter, userLimiter } = require('./middleware/rateLimiterMiddleware');
// const morgan = require('morgan');
// // Load environment variables
// dotenv.config();

// // Connect to MongoDB
// connectDB();

// // Initialize Express app
// const app = express();

// app.set('trust proxy', 1);

// // --- Middleware ---
// app.use(helmet());
// app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// const allowedOrigins = [
//     'http://localhost:5173',
//     'https://awastream.onrender.com',
//     'https://awastream.com',
//     process.env.FRONTEND_URL
// ];

// const corsOptions = {
//     origin: (origin, callback) => {
//         if (!origin || allowedOrigins.indexOf(origin) !== -1) {
//             callback(null, true);
//         } else {
//             callback(new Error('Not allowed by CORS'));
//         }
//     },
//     credentials: true,
// };
// app.use(cors(corsOptions));

// app.use(express.json({
//     // We need the raw body for Stripe webhook verification
//     verify: (req, res, buf) => {
//         if (req.originalUrl.startsWith('/api/v1/payments/webhook/stripe')) {
//             req.rawBody = buf.toString();
//         }
//     }
// }));
// app.use(cookieParser());


// // --- 2. UPGRADE SESSION STORE FOR PRODUCTION ---
// app.use(session({
//     secret: process.env.SESSION_SECRET,
//     resave: false,
//     saveUninitialized: false,
//     store: MongoStore.create({ 
//         mongoUrl: process.env.MONGO_URI 
//     }),
//     cookie: { 
//         secure: process.env.NODE_ENV === 'production',
//         httpOnly: true,
//         sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // FIX: Explicit SameSite Policy
//         maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
//     }
// }));

// app.use(passport.initialize());
// require('./config/passport-setup');


// // --- API Routes ---
// const authRoutes = require('./routes/authRoutes');
// const videoRoutes = require('./routes/videoRoutes');
// const creatorRoutes = require('./routes/creatorRoutes');
// const paymentRoutes = require('./routes/paymentRoutes');
// const adminRoutes = require('./routes/adminRoutes');
// const accessRoutes = require('./routes/accessRoutes');
// const utilsRoutes = require('./routes/utilsRoute');
// const viewerRoutes = require('./routes/viewerRoutes');
// const creatorPublicRoutes = require('./routes/creatorPublicRoutes');
// const onboarderRoutes = require('./routes/onboarderRoutes');
// const commentRoutes = require('./routes/commentRoutes');
// const bundleRoutes = require('./routes/bundleRoutes');
// const notificationRoutes = require('./routes/notificationRoutes');

// app.get('/health', (req, res) => {
//   res.status(200).send('OK');
// });


// app.use('/api/v1/auth', authLimiter, authRoutes);
// app.use('/api/v1/videos', apiLimiter, videoRoutes);
// app.use('/api/v1/bundles',apiLimiter,  bundleRoutes);
// app.use('/api/v1/creator', apiLimiter, creatorRoutes);
// app.use('/api/v1/payments',apiLimiter,  paymentRoutes);
// app.use('/api/v1/admin',apiLimiter,  adminRoutes);
// app.use('/api/v1/access',  accessRoutes);
// app.use('/api/v1/utils',  utilsRoutes);
// app.use('/api/v1/viewer',  viewerRoutes);
// app.use('/api/v1/creators',  creatorPublicRoutes);
// app.use('/api/v1/onboarder', onboarderRoutes);
// app.use('/api/v1/comments', commentRoutes);
// app.use('/api/v1/notifications', notificationRoutes);

// // --- Health Check Route ---
// app.get('/', (req, res) => {
//     res.send('AwaStream API is running...');
// });

// // --- Error Handling Middleware ---
// app.use(notFound);

// app.use((err, req, res, next) => {
//     // 1. Determine Status Code safely
//     // Use the error's status if available, otherwise rely on the existing status code, 
//     // defaulting to 500 if the status code was an accidental 200.
//     const statusCode = err.status || res.statusCode === 200 ? 500 : res.statusCode;
//     res.status(statusCode);

//     // 2. Log error details, avoiding raw client IP in standard logs
//     logger.error(`${statusCode} - ${err.message}`, {
//         // Log sensitive request details as separate fields, not just a string
//         request_path: req.originalUrl,
//         request_method: req.method,
//         // Remove raw req.ip from standard logs for privacy
//         // stack: err.stack, 
//     });
    
//     // 3. Send sanitized response to client
//     res.json( {
//         // Only send the detailed message if not a generic 500 error
//         message: statusCode >= 500 && process.env.NODE_ENV === 'production' 
//              ? 'Server Error. Please try again later.' 
//              : err.message,
//         stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
//     });
// });


// // --- Start Server ---
// const PORT = process.env.PORT || 5001;
// app.listen(PORT, () => {
//     logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
// });






const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet')
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const MongoStore = require('connect-mongo'); 
const connectDB = require('./config/db');
require('./config/redisClient');
const { notFound } = require('./middleware/errorMiddleware');
const logger = require('./config/logger');
// Ensure the authLimiter settings are relaxed in the middleware file
const { authLimiter, apiLimiter, userLimiter } = require('./middleware/rateLimiterMiddleware'); 
const morgan = require('morgan');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();

// CRITICAL FIX: Trust proxies to correctly read the client's IP for rate limiting
app.set('trust proxy', 1);

// --- Middleware ---
app.use(helmet());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

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
    verify: (req, res, buf) => {
        if (req.originalUrl.startsWith('/api/v1/payments/webhook/stripe')) {
            req.rawBody = buf.toString();
        }
    }
}));
app.use(cookieParser());


// --- FIX: Session Store Configuration (SameSite Policy) ---
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
        // CRITICAL FIX: Explicitly set SameSite for CSRF defense
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
const onboarderRoutes = require('./routes/onboarderRoutes');
const commentRoutes = require('./routes/commentRoutes');
const bundleRoutes = require('./routes/bundleRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// --- FIX: Rate Limiter Deployment ---
// DELETE: app.use('/api/v1/', apiLimiter); // Removed global limit

app.use('/api/v1/auth', authLimiter, authRoutes); // Auth routes use STRICT limiter
app.use('/api/v1/videos', apiLimiter, videoRoutes); // Other resource routes use general limit
app.use('/api/v1/bundles', apiLimiter, bundleRoutes); // Apply selectively
// Assuming subsequent routes will also be updated to use apiLimiter or userLimiter as needed.
app.use('/api/v1/creator', creatorRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/access', accessRoutes);
app.use('/api/v1/utils', utilsRoutes);
app.use('/api/v1/viewer', viewerRoutes);
app.use('/api/v1/creators', creatorPublicRoutes);
app.use('/api/v1/onboarder', onboarderRoutes);
app.use('/api/v1/comments', commentRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// --- Health Check Route ---
app.get('/', (req, res) => {
    res.send('AwaStream API is running...');
});

// --- FIX: Error Handling Middleware (Secure Logging & Status) ---
app.use(notFound);
app.use((err, req, res, next) => {
    // 1. Determine Status Code safely
    const statusCode = err.status || res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);

    // 2. Secure Logging: Log status, message, and path. Remove raw req.ip from message string.
    logger.error(`${statusCode} - ${err.message}`, {
        request_path: req.originalUrl,
        request_method: req.method,
        // Log IP as a separate field, not in the main message string
        client_ip: req.ip, 
    });
    
    // 3. Send Sanitized Response: Use generic message for server errors in production
    res.json( {
        message: statusCode >= 500 && process.env.NODE_ENV === 'production' 
             ? 'Server Error. Please try again later.' 
             : err.message,
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
    });
});

// --- Start Server ---
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});