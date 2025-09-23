const cloudinary = require('../config/cloudinary');

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

module.exports = { deleteFromCloudinary };