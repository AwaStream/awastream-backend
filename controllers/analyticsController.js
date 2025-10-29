const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid'); // For generating session IDs
const WatchSession = require('../models/WatchSession');
const VideoViewAggregate = require('../models/VideoViewAggregate');
const Video = require('../models/Video');

const VIEW_THRESHOLD_SECONDS = 30; // User must watch 30 seconds to count as a "view"

/**
 * @desc    A user has started playing a video.
 * @route   POST /api/videos/analytics/start
 */
const startWatchSession = asyncHandler(async (req, res) => {
    const { videoId } = req.body;
    const user = req.user;

    // 1. Create the permanent "Aggregate" row if it doesn't exist.
    // This is "upsert": update if exists, insert if not.
    // This is the key to our unique [user, video] index.
    const aggregate = await VideoViewAggregate.findOneAndUpdate(
        { user: user._id, video: videoId },
        { $setOnInsert: { user: user._id, video: videoId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 2. Create a new, unique WatchSession
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
        // Send back the user's previous progress
        startTime: aggregate.maxDurationReached || 0 
    });
});

/**
 * @desc    A user sends a "ping" to show they are still watching.
 * @route   POST /api/videos/analytics/heartbeat
 */
const sendWatchHeartbeat = asyncHandler(async (req, res) => {
    const { sessionId, currentTime } = req.body;
    const user = req.user;

    // 1. Find the active session
    const session = await WatchSession.findOne({ 
        sessionId, 
        user: user._id, 
        status: 'active' 
    });

    if (!session) {
        return res.status(404).json({ message: "Active session not found." });
    }

    // 2. Update the session stats
    const now = Date.now();
    const timeDiffSinceLastHeartbeat = (now - session.lastHeartbeatAt) / 1000;
    
    // We cap the recorded watch time at 1.5x the heartbeat interval (e.g., 90s for a 60s ping)
    // This prevents a user from "scrubbing" the video to fake watch time.
    const watchTimeToAdd = Math.min(timeDiffSinceLastHeartbeat, 90); 

    session.lastReportedTime = currentTime;
    session.lastHeartbeatAt = now;
    await session.save();

    // 3. Update the permanent aggregate record
    const aggregate = await VideoViewAggregate.findOne({ 
        user: user._id, 
        video: session.video 
    });

    if (aggregate) {
        aggregate.totalWatchTimeInSeconds += watchTimeToAdd;
        aggregate.maxDurationReached = Math.max(aggregate.maxDurationReached, currentTime);

        // 4. *** THIS IS THE "VIEW COUNT" LOGIC ***
        // Has the user passed the 30-second mark AND we haven't counted the view yet?
        if (aggregate.maxDurationReached >= VIEW_THRESHOLD_SECONDS && !aggregate.viewCounted) {
            aggregate.viewCounted = true;
            
            // Increment the master counter on the Video model
            await Video.findByIdAndUpdate(session.video, { $inc: { totalViews: 1 } });
        }
        await aggregate.save();
    }

    res.status(200).json({ message: "Heartbeat received." });
});

/**
 * @desc    A user has stopped watching (closed tab, etc.)
 * @route   POST /api/videos/analytics/end
 */
const endWatchSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.body;
    
    await WatchSession.updateOne(
        { sessionId, user: req.user._id },
        { status: 'ended', lastHeartbeatAt: Date.now() }
    );

    // Note: We already updated the aggregate stats during the heartbeats,
    // so we don't need to do a final calculation here.
    
    res.status(200).json({ message: "Session ended." });
});

module.exports = {
    startWatchSession,
    sendWatchHeartbeat,
    endWatchSession,
};