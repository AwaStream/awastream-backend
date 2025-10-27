const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: false, select: false },
    authMethod: { type: String, enum: ['local', 'google'], default: 'local' },
    firstName: { type: String, required: true },
    lastName: { type: String, required: false, default: '' },
    userName: { type: String, required: true, trim: true },
    avatarUrl: { type: String },
    bio: { type: String, maxlength: 200 }, // A short bio
    websiteUrl: { type: String },
    twitterUrl: { type: String },
    youtubeUrl: {type: String},
    googleId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ['creator', 'viewer', 'superadmin', 'onboarder'], default: 'viewer' },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    payoutBankName: { type: String, trim: true },
    payoutAccountNumber: { type: String, trim: true },
    payoutAccountName: { type: String, trim: true },
    paystackRecipientCode: { type: String, trim: true },
    isEmailVerified: { type: Boolean, default: false },
    lastLogin: { type: Date },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },

    // --- NEW & UPDATED FIELDS ---
    emailVerificationToken: { type: String, select: false },
    emailVerificationTokenExpires: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },

}, { timestamps: true });


/**
 * Generates an email verification token.
 * Hashes the token before saving to the database for security.
 * Sets an expiry of 30 minutes.
 * @returns {string} The unhashed token to be sent in the email.
 */
UserSchema.methods.generateEmailVerificationToken = function() {
    const verificationToken = crypto.randomBytes(32).toString('hex');

    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

    // 🚨 FIX 2A: Extend expiry to 24 hours (24 * 60 * 60 * 1000)
    this.emailVerificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;

    return verificationToken;
};

/**
 * Generates a password reset token.
 * Hashes the token before saving to the database for security.
 * Sets an expiry of 15 minutes.
 * @returns {string} The unhashed token to be sent in the email.
 */
UserSchema.methods.generatePasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
    this.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    
    return resetToken;
};

// Method to compare entered password with the hashed password
UserSchema.methods.matchPassword = async function(enteredPassword) {
    if (!this.passwordHash) return false;
    return await bcrypt.compare(enteredPassword, this.passwordHash);
};

const User = mongoose.model('User', UserSchema);
module.exports = User;