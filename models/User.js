const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: false, select: false }, // 'select: false' is a good practice
    authMethod: { type: String, enum: ['local', 'google'], default: 'local' },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    userName: { type: String, required: true, trim: true },
    avatarUrl: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ['creator', 'viewer', 'superadmin'], default: 'creator' },
     payoutBankName: { type: String, trim: true },
    payoutAccountNumber: { type: String, trim: true },
    payoutAccountName: { type: String, trim: true },
    paystackRecipientCode: { type: String, trim: true }, 
    isEmailVerified: { type: Boolean, default: false },
    lastLogin: { type: Date },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    emailVerificationToken: String,
    emailVerificationTokenExpires: Date,
}, { timestamps: true });

// NOTE: We have removed the pre-save hook for hashing, as it's now done in the controller.

// This method remains the same and is correct.
UserSchema.methods.matchPassword = async function(enteredPassword) {
    if (!this.passwordHash) return false;
    return await bcrypt.compare(enteredPassword, this.passwordHash);
};

const User = mongoose.model('User', UserSchema);
module.exports = User;