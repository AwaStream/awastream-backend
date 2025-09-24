// const express = require('express');
// const dotenv = require('dotenv');
// const cors = require('cors');
// const session = require('express-session');
// const passport = require('passport');
// const cookieParser = require('cookie-parser') 
// const connectDB = require('./config/db');
// const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// // Load environment variables
// dotenv.config();

// // Connect to MongoDB
// connectDB();

// // Initialize Express app
// const app = express();

// // --- Middleware ---

// // --- Detailed CORS Configuration ---
// const allowedOrigins = [
//     'http://localhost:5173',
//     'https://awastream.onrender.com', // Your local development URL
//     process.env.FRONTEND_URL  // Your deployed frontend URL from .env
// ];

// const corsOptions = {
//     // The origin property can be a function that checks against a whitelist.
//     origin: (origin, callback) => {
//         // Allow requests with no origin (like mobile apps or curl requests)
//         if (!origin) return callback(null, true);
//         if (allowedOrigins.indexOf(origin) === -1) {
//             const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
//             return callback(new Error(msg), false);
//         }
//         return callback(null, true);
//     },
//     credentials: true, // This is the crucial part that allows cookies to be sent
// };

// // Use the configured CORS options
// app.use(cors(corsOptions));


// // Body parser middleware to accept JSON data
// app.use(express.json());
// app.use(cookieParser());

// app.use(session({
//     secret: process.env.SESSION_SECRET, // Add a SESSION_SECRET to your .env file
//     resave: false,
//     saveUninitialized: false,
//     cookie: { secure: process.env.NODE_ENV === 'production' }
// }));

// // Passport middleware for authentication
// app.use(passport.initialize());
// require('./config/passport-setup');

// // app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // --- API Routes ---
// const authRoutes = require('./routes/authRoutes');
// const videoRoutes = require('./routes/videoRoutes');
// const creatorRoutes = require('./routes/creatorRoutes');
// const paymentRoutes = require('./routes/paymentRoutes');
// const adminRoutes = require('./routes/adminRoutes');

// app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/videos', videoRoutes);
// app.use('/api/v1/creator', creatorRoutes);
// app.use('/api/v1/payments', paymentRoutes);
// app.use('/api/v1/admin', adminRoutes);

// // --- Health Check Route ---
// app.get('/', (req, res) => {
//     res.send('AwaStream API is running...');
// });

// // --- Error Handling Middleware ---
// // This must be the last thing you app.use()
// app.use(notFound);
// app.use(errorHandler);

// // --- Start Server ---
// const PORT = process.env.PORT || 5001;
// app.listen(PORT, () => {
//     console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
// });




const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const MongoStore = require('connect-mongo'); // <-- 1. IMPORT MONGOSTORE
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();

// --- Middleware ---

const allowedOrigins = [
    'http://localhost:5173',
    'https://awastream.onrender.com',
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
const accessRoutes = require('./routes/accessRoutes'); // <-- 3. IMPORT ACCESS ROUTES

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/videos', videoRoutes);
app.use('/api/v1/creator', creatorRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/access', accessRoutes); // <-- 4. MOUNT ACCESS ROUTES

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