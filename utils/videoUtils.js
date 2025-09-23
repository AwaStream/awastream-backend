/**
 * A highly robust function to extract the YouTube Video ID from various URL formats or a plain ID.
 * It tries multiple parsing strategies to ensure maximum compatibility.
 * @param {string} url - The YouTube URL or string to parse.
 * @returns {string|null} - The 11-character YouTube Video ID or null if not found.
 */
const getYouTubeVideoId = (url) => {
    if (!url || typeof url !== 'string') {
        return null;
    }

    // Strategy 1: Check if the input is just a plain 11-character ID.
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
        return url;
    }

    // Strategy 2: Use a comprehensive regex to find the ID in various URL structures.
    // This is often the most reliable method.
    const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    if (match && match[1]) {
        return match[1];
    }
    
    // Strategy 3: Try to parse as a URL object as a fallback (safer with a try-catch).
    try {
        const urlObj = new URL(url);
        let videoId = urlObj.searchParams.get('v');
        if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
            return videoId;
        }
        
        // Check path for youtu.be/ID or /embed/ID formats
        const pathParts = urlObj.pathname.split('/');
        const potentialId = pathParts[pathParts.length - 1];
        if (/^[a-zA-Z0-9_-]{11}$/.test(potentialId)) {
            return potentialId;
        }
    } catch (e) {
        // This catch block handles cases where the input is not a full, valid URL.
        // We can safely ignore this error because the regex should have already caught valid cases.
    }

    // If all strategies fail, return null.
    return null;
};

module.exports = { getYouTubeVideoId };