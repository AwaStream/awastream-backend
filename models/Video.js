const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
    creator: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    youtubeUrl: { type: String, required: true }, 
    youtubeVideoId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    thumbnailUrl: { type: String, required: true },
    priceNaira: { type: Number, required: true },
    priceKobo: { type: Number, required: true, min: 15000 }, // Minimum price of 50 NGN
    shareableSlug: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Video = mongoose.model('Video', VideoSchema);
module.exports = Video;







// HLS Version

// const mongoose = require('mongoose');

// const VideoSchema = new mongoose.Schema({
//     creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//     youtubeUrl: { type: String, required: true },
//     youtubeVideoId: { type: String, required: true },
//     title: { type: String, required: true },
//     description: { type: String },
//     thumbnailUrl: { type: String, required: true },
//     priceNaira: { type: Number, required: true },
//     priceKobo: { type: Number, required: true, min: 15000 },
//     hlsManifestPath: { type: String, required: true },
//     hlsEncryptionKey: { type: Buffer, required: true, select: false },
//     shareableSlug: { type: String, required: true, unique: true },
//     isActive: { type: Boolean, default: true },
// }, { timestamps: true });

// const Video = mongoose.model('Video', VideoSchema);
// module.exports = Video;