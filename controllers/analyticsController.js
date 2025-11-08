const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const WatchSession = require('../models/WatchSession');
const VideoViewAggregate = require('../models/VideoViewAggregate');
const Video = require('../models/Video');
const checkAccess = require('../controllers/accessController')

const VIEW_THRESHOLD_SECONDS = 30;

/**
 * @desc    A user has started playing a video.
 * @route   POST /api/videos/analytics/start
 */
const startWatchSession = asyncHandler(async (req, res) => {
    const { videoId } = req.body;
    const user = req.user;

    const video = await Video.findById(videoId).select('priceKobo creator');
    if (!video) {
        res.status(404);
        throw new Error('Video not found.');
    }

    const hasAccess = await checkAccess(user, video);
    if (!hasAccess) {
        res.status(403);
        throw new Error('You do not have access to this video to start a session.');
    }

    const aggregate = await VideoViewAggregate.findOneAndUpdate(
        { user: user._id, video: videoId },
        { $setOnInsert: { user: user._id, video: videoId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const sessionId = uuidv4();
    await WatchSession.create({
        user: user._id,
        video: videoId,
        sessionId: sessionId,
        lastReportedTime: 0,
        lastHeartbeatAt: Date.now(),
    });

    res.status(201).json({ 
        sessionId,
        message: "Session started.",
        startTime: aggregate.maxDurationReached || 0 
    });
});

/**
 * @desc    A user sends a "ping" to show they are still watching.
 * @route   POST /api/videos/analytics/heartbeat
 */
const sendWatchHeartbeat = asyncHandler(async (req, res) => {
    const { sessionId, currentTime } = req.body;
    const user = req.user;

    const session = await WatchSession.findOne({ 
        sessionId, 
        user: user._id, 
        status: 'active' 
    });

    if (!session) {
        return res.status(404).json({ message: "Active session not found." });
    }

    const now = Date.now();
    const timeDiffSinceLastHeartbeat = (now - session.lastHeartbeatAt) / 1000;
    const watchTimeToAdd = Math.min(timeDiffSinceLastHeartbeat, 90); 

    session.lastReportedTime = currentTime;
     session.lastHeartbeatAt = now;
    await session.save();

    const aggregate = await VideoViewAggregate.findOne({ 
        user: user._id, 
        video: session.video 
    });

    if (aggregate) {
        aggregate.totalWatchTimeInSeconds += watchTimeToAdd;
        aggregate.maxDurationReached = Math.max(aggregate.maxDurationReached, currentTime);

        if (aggregate.maxDurationReached >= VIEW_THRESHOLD_SECONDS && !aggregate.viewCounted) {
            aggregate.viewCounted = true;
            aggregate.viewCountedAt = Date.now();
            await Video.findByIdAndUpdate(session.video, { $inc: { totalViews: 1 } });
        }
        await aggregate.save();
    }

    res.status(200).json({ message: "Heartbeat received." });
});

/**
 * @desc    A user has stopped watching
 * @route   POST /api/videos/analytics/end
 */
const endWatchSession = asyncHandler(async (req, res) => {
    let sessionId, currentTime;

    // --- THIS IS THE CRITICAL FIX ---
    // It handles both a normal JSON request and the 'text/plain' request from sendBeacon
    if (req.is('application/json')) {
        sessionId = req.body.sessionId;
        currentTime = req.body.currentTime;
    } else if (req.is('text/plain')) {
        try {
            const body = JSON.parse(req.body);
            sessionId = body.sessionId;
            currentTime = body.currentTime;
        } catch (e) {
            console.error("Failed to parse sendBeacon body:", req.body);
           return res.status(400).send('Invalid request body');
        }
    } else {
        return res.status(400).send('Unsupported content type');
    }
    // --- END OF FIX ---

    // The user ID must be retrieved from the token, not the body
    const user = req.user; 

    if (!sessionId) {
        return res.status(400).json({ message: 'Session ID is required' });
    }

    // 1. Find the active session
    const session = await WatchSession.findOne({ 
        sessionId, 
        user: user._id, // Ensure session belongs to the authenticated user
        status: 'active' 
    });

    if (!session) {
        return res.status(200).json({ message: "Session not found or already ended." });
    }

    // 2. Mark session as ended
    session.status = 'ended';
    session.lastReportedTime = currentTime;
    session.lastHeartbeatAt = Date.now();
    await session.save();

    // 3. Do a FINAL update on the aggregate record
    // Use parseFloat to ensure currentTime is a number
    const finalCurrentTime = parseFloat(currentTime) || 0; 

    const aggregate = await VideoViewAggregate.findOne({ 
        user: user._id, 
        video: session.video 
    });

    if (aggregate) {
        if (finalCurrentTime > aggregate.maxDurationReached) {
            aggregate.maxDurationReached = finalCurrentTime;
        }

        if (aggregate.maxDurationReached >= VIEW_THRESHOLD_SECONDS && !aggregate.viewCounted) {
            aggregate.viewCounted = true;
            aggregate.viewCountedAt = Date.now();
            await Video.findByIdAndUpdate(session.video, { $inc: { totalViews: 1 } });
        }
        await aggregate.save();
    }
    
    res.status(200).json({ message: "Session ended and progress saved." });
});

module.exports = {
    startWatchSession,
    sendWatchHeartbeat,
    endWatchSession,
};