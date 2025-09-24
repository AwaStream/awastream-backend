const axios = require('axios');

/**
 * @desc    Extracts the YouTube video ID from various URL formats using a regular expression.
 * @param   {string} url - The full YouTube URL (e.g., https://youtu.be/..., https://www.youtube.com/watch?v=...).
 * @returns {string|null} - The 11-character video ID or null if no match is found.
 */
const getYouTubeVideoId = (url) => {
    // This regex is designed to capture the video ID from all common YouTube link formats.
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
};

/**
 * @desc    Fetches video details from the official YouTube Data API v3.
 * @param   {string} youtubeUrl - The FULL YouTube URL provided by the user.
 * @returns {Promise<object|null>} - An object with title, thumbnailUrl, and description, or null if not found.
 */
const fetchVideoDetails = async (youtubeUrl) => {
    const youtubeVideoId = getYouTubeVideoId(youtubeUrl);

    if (!youtubeVideoId) {
        throw new Error('Invalid YouTube URL provided. Could not extract a video ID.');
    }

    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    if (!YOUTUBE_API_KEY) {
        throw new Error("YOUTUBE_API_KEY is not set in environment variables.");
    }
    
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${youtubeVideoId}&part=snippet&key=${YOUTUBE_API_KEY}`;
    
    try {
        const response = await axios.get(url);
        
        if (!response.data.items || response.data.items.length === 0) {
           throw new Error('Video could not be found on YouTube. It may be private or deleted.');
        }
        
        const snippet = response.data.items[0].snippet;
        const title = snippet.title;
        const thumbnailUrl = snippet.thumbnails.maxres?.url || snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url || snippet.thumbnails.default.url;

        return { title, thumbnailUrl, description: snippet.description };
    } catch (error) {
       console.error("Failed to fetch from YouTube API:", error.response ? error.response.data : error.message);
       const errorMessage = error.response?.data?.error?.message || 'Could not retrieve video details from YouTube.';
        throw new Error(errorMessage);
    }
};

module.exports = { fetchVideoDetails, getYouTubeVideoId };