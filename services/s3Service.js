const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

// Initialize the S3 Client once and reuse it.
const s3Client = new S3Client({
    region: process.env.AWS_S3_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

/**
 * @desc    Generates a secure, temporary URL for uploading a file directly to S3.
 * @param   {string} creatorId - The ID of the user uploading the file.
 * @param   {string} filename - The original name of the file.
 * @param   {string} filetype - The MIME type of the file (e.g., 'video/mp4').
 * @returns {Promise<object>} - An object containing the uploadUrl and the unique file key.
 */
const generatePresignedUploadUrl = async (creatorId, filename, filetype) => {
    try {
        // Generate a unique file name to prevent overwrites and organize by creator
        const randomBytes = crypto.randomBytes(16).toString('hex');
        const key = `${creatorId}/${randomBytes}-${filename.replace(/\s/g, '_')}`;

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
            ContentType: filetype,
        });

        // Generate the temporary, secure URL (valid for 10 minutes)
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });

        return { uploadUrl, key };
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        throw new Error("Could not generate upload link. Please try again later.");
    }
};

/**
 * @desc    Fetches a video file from S3 as a readable stream.
 * @param   {string} key - The key of the S3 object (video.sourceId).
 * @returns {Promise<object>} - An object containing the stream, contentType, and contentLength.
 */
const getVideoStream = async (key) => {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
        });

        const response = await s3Client.send(command);

        return {
            stream: response.Body,
            contentType: response.ContentType,
            contentLength: response.ContentLength,
        };
    } catch (error) {
        console.error("Error getting video stream from S3:", error);
        throw new Error("Could not retrieve video file.");
    }
};

module.exports = {
    generatePresignedUploadUrl,
    getVideoStream,
};