// const axios = require('axios');

// /**
//  * Fetches video details from the official YouTube Data API v3.
//  * @param {string} youtubeVideoId - The 11-character ID of the YouTube video.
//  * @returns {Promise<object|null>} - An object with title, thumbnailUrl, and description, or null if not found.
//  */
// const fetchVideoDetails = async (youtubeVideoId) => {
//     const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
//     if (!YOUTUBE_API_KEY) {
//         throw new Error("YOUTUBE_API_KEY is not set in environment variables.");
//     }
    
//     // THIS IS THE CORRECT, OFFICIAL GOOGLE API URL
//     const url = `https://www.googleapis.com/youtube/v3/videos?id=${youtubeVideoId}&part=snippet&key=${YOUTUBE_API_KEY}`;
    
//     try {
//         const response = await axios.get(url);
        
//         if (!response.data.items || response.data.items.length === 0) {
//             return null; // Video not found on YouTube
//         }
        
//         const snippet = response.data.items[0].snippet;
//         const title = snippet.title;
//         // Prefer maxres, then high, then medium quality thumbnail for the best image.
//         const thumbnailUrl = snippet.thumbnails.maxres?.url || snippet.thumbnails.high?.url || snippet.thumbnails.medium.url;

//         return { title, thumbnailUrl, description: snippet.description };
//     } catch (error) {
//         // This will now only catch genuine network errors or problems with your API key.
//         console.error("Failed to fetch from YouTube API:", error.response ? error.response.data : error.message);
//         throw new Error('Could not retrieve video details from YouTube.');
//     }
// };

// module.exports = { fetchVideoDetails };








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
    // --- THE FIX: First, we extract the ID from the full URL ---
    const youtubeVideoId = getYouTubeVideoId(youtubeUrl);

    if (!youtubeVideoId) {
        // This error is now more accurate and will be triggered if the URL is truly invalid.
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
            // This means the ID was valid but the video doesn't exist (e.g., private or deleted).
            throw new Error('Video could not be found on YouTube. It may be private or deleted.');
        }
        
        const snippet = response.data.items[0].snippet;
        const title = snippet.title;
        const thumbnailUrl = snippet.thumbnails.maxres?.url || snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url || snippet.thumbnails.default.url;

        return { title, thumbnailUrl, description: snippet.description };
    } catch (error) {
        // This will now catch genuine network errors or problems with your API key.
        console.error("Failed to fetch from YouTube API:", error.response ? error.response.data : error.message);
        // We re-throw the specific error from the API if possible, otherwise a generic one.
        const errorMessage = error.response?.data?.error?.message || 'Could not retrieve video details from YouTube.';
        throw new Error(errorMessage);
    }
};

module.exports = { fetchVideoDetails, getYouTubeVideoId };