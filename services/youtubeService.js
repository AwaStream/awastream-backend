const axios = require('axios');

/**
 * Fetches video details from the official YouTube Data API v3.
 * @param {string} youtubeVideoId - The 11-character ID of the YouTube video.
 * @returns {Promise<object|null>} - An object with title, thumbnailUrl, and description, or null if not found.
 */
const fetchVideoDetails = async (youtubeVideoId) => {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    if (!YOUTUBE_API_KEY) {
        throw new Error("YOUTUBE_API_KEY is not set in environment variables.");
    }
    
    // THIS IS THE CORRECT, OFFICIAL GOOGLE API URL
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${youtubeVideoId}&part=snippet&key=${YOUTUBE_API_KEY}`;
    
    try {
        const response = await axios.get(url);
        
        if (!response.data.items || response.data.items.length === 0) {
            return null; // Video not found on YouTube
        }
        
        const snippet = response.data.items[0].snippet;
        const title = snippet.title;
        // Prefer maxres, then high, then medium quality thumbnail for the best image.
        const thumbnailUrl = snippet.thumbnails.maxres?.url || snippet.thumbnails.high?.url || snippet.thumbnails.medium.url;

        return { title, thumbnailUrl, description: snippet.description };
    } catch (error) {
        // This will now only catch genuine network errors or problems with your API key.
        console.error("Failed to fetch from YouTube API:", error.response ? error.response.data : error.message);
        throw new Error('Could not retrieve video details from YouTube.');
    }
};

module.exports = { fetchVideoDetails };