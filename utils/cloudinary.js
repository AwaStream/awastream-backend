const cloudinary = require('../config/cloudinary');
const validator = require('validator')

/**
 * Uploads an external image URL to Cloudinary, serving as a secure proxy.
 * @param {string} externalUrl - The external URL (e.g., Google photo URL).
 * @param {string} folder - The target folder in Cloudinary (e.g., 'avatars').
 * @returns {Promise<string|null>} - The secure Cloudinary URL or null on failure.
 */
const uploadExternalImageToCloudinary = async (externalUrl, folder = 'avatars') => {
    if (!validator.isURL(externalUrl, { require_protocol: true, protocols: ['http', 'https'] })) {
        console.error('SSRF Defense: Invalid or non-public URL rejected.', externalUrl);
        return null;
    }
    
    try {
        const result = await cloudinary.uploader.upload(externalUrl, {
            folder: folder, 
            resource_type: 'image', // Explicitly specify image type
        });

        // 3. Return the secure, hosted URL
        return result.secure_url; 
    } catch (error) {
        // Log the error but fail gracefully during user creation.
        console.error('Cloudinary upload failed for external URL:', error);
        return null; 
    }
};

/**
 * Deletes a file from Cloudinary.
 * @param {string} publicId - The public_id of the file to delete.
 * @returns {Promise<object>} - The result from the Cloudinary API.
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    // Cloudinary's destroy method can handle images, videos, and raw files.
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`Successfully deleted ${publicId} from Cloudinary.`, result);
    return result;
  } catch (error) {
    console.error(`Failed to delete ${publicId} from Cloudinary.`, error);
    // Depending on your error handling strategy, you might want to throw the error
    // or just log it without stopping the parent process.
  }
};

module.exports = { deleteFromCloudinary,
  uploadExternalImageToCloudinary
 };