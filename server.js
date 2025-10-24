const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

// --- Load Config & Connectors ---
const connectDB = require('./config/db');
const { notFound } = require('./middleware/errorMiddleware');
const logger = require('./config/logger');
const MongoStore = require('connect-mongo');

// Load environment variabless
dotenv.config();

// Create the Start Function
const startServer = async () => {
    try {
    await connectDB();

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
    // Initialize Express app
    const app = express();

    // IP for rate limiting
    app.set('trust proxy', 'loopback');

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

    // --- Session Store Configuration (SameSite Policy) ---
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
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
        }
    }));

    app.use(passport.initialize());
    require('./config/passport-setup');


    app.get('/health', (req, res) => {
      res.status(200).send('OK');
    });

    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/videos',  videoRoutes); 
    app.use('/api/v1/bundles',  bundleRoutes); 
    app.use('/api/v1/creator',  creatorRoutes);
    app.use('/api/v1/payments',  paymentRoutes);
    app.use('/api/v1/admin',  adminRoutes);
    app.use('/api/v1/access',  accessRoutes);
    app.use('/api/v1/utils',  utilsRoutes);
    app.use('/api/v1/viewer',  viewerRoutes);
    app.use('/api/v1/creators', creatorPublicRoutes);
    app.use('/api/v1/onboarder', onboarderRoutes);
    app.use('/api/v1/comments', commentRoutes);
    app.use('/api/v1/notifications', notificationRoutes);

    // --- Health Check Route ---
    app.get('/', (req, res) => {
        res.send('AwaStream API is running...');
    });

    // --- Error Middleware ---
    app.use(notFound);
    app.use((err, req, res, next) => {
        const statusCode = err.status || res.statusCode === 200 ? 500 : res.statusCode;
        res.status(statusCode);

        logger.error(`${statusCode} - ${err.message}`, {
            request_path: req.originalUrl,
            request_method: req.method,
            client_ip: req.ip, 
        });
        
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

    } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }

};

startServer();