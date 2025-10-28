const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const generateTokens = require('../utils/generateTokens');
const { MAX_LOGIN_ATTEMPTS, LOCK_TIME } = require('../config/constants')
const { sendEmail } = require('../services/emailService');

// --- Updated sendTokenResponse function (Performs Redirect) ---
const sendTokenResponse = (user, statusCode, res) => {
    // Assume generateTokens and other necessary functions are defined elsewhere
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);

    const cookieDomain = process.env.AWASTREAM_ROOT_DOMAIN || undefined;
    
    // REFRESH Token Options (HTTP-ONLY, 7 Days)
    const refreshTokenCookieOptions = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        httpOnly: true, 
        path: '/',
        domain: cookieDomain
    };
    
    // ACCESS Token Options (HTTP-ONLY, 15 Minutes)
    const accessTokenCookieOptions = {
        expires: new Date(Date.now() + 15 * 60 * 1000),
        httpOnly: true, // Securely set as HTTP-only
        path: '/',
        domain: cookieDomain,
    };

    if (process.env.NODE_ENV === 'production') {
        refreshTokenCookieOptions.secure = true;
        refreshTokenCookieOptions.sameSite = 'none';
        accessTokenCookieOptions.secure = true;
        accessTokenCookieOptions.sameSite = 'none';
    } else {
        refreshTokenCookieOptions.sameSite = 'lax';
        accessTokenCookieOptions.sameSite = 'lax';
    }

    res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);
    res.cookie('accessToken', accessToken, accessTokenCookieOptions);


    let redirectPath;
   // Role-based Path Determination
    switch (user.role) {
        case 'superadmin': 
            redirectPath = '/admin/dashboard'; 
            break;
        case 'onboarder': 
            redirectPath = '/onboarder/dashboard'; 
            break;
        case 'creator': 
            redirectPath = '/dashboard'; 
            break;
        case 'viewer': 
            redirectPath = '/library'; 
            break;
        default: 
            redirectPath = '/';
    }

    if (statusCode === 302) { 
        const frontendUrl = process.env.AWASTREAM_FRONTEND_URL || process.env.AWASTREAM_FRONTEND_HOST || 'http://localhost:5173';
        
        // Use res.redirect for a cleaner OAuth hand-off.
        return res.redirect(`${frontendUrl}${redirectPath}`);
    }
    
    // Fallback response for all non-redirect scenarios 
    res.status(statusCode).json({
        redirectPath: redirectPath,
        user: {
            firstName: user.firstName,
            avatarUrl: user.avatarUrl
        }
    });
};

const refreshToken = asyncHandler(async (req, res) => {
    const token = req.cookies.refreshToken;

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no refresh token provided.');
    }

    try {
        // 1. Verify the token to get the user ID
        // Assume jwt.verify is defined
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

        // Assume User is the Mongoose model
        const user = await User.findById(decoded.id);

        // 4. Check if user exists or is active/not suspended
        if (!user || user.status !== 'active') {
            res.status(401);
            throw new Error('User not found or account is inactive.');
        }

        // 5. Generate the new access token using the FRESH role from the database
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id, user.role); 

        const cookieDomain = process.env.AWASTREAM_ROOT_DOMAIN || undefined;

        const accessTokenCookieOptions = {
            expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
            httpOnly: true,
            path: '/',
            domain: cookieDomain, 
        };

        // --- REFRESH Token Options (Used for RTOR) ---
        const refreshTokenCookieOptions = {
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days (Match sendTokenResponse)
            httpOnly: true,
            path: '/',
            domain: cookieDomain
        };

       if (process.env.NODE_ENV === 'production') {
            accessTokenCookieOptions.secure = true;
            accessTokenCookieOptions.sameSite = 'none';
            refreshTokenCookieOptions.secure = true; // Set secure flags for the new refresh token
            refreshTokenCookieOptions.sameSite = 'none';
        } else {
            accessTokenCookieOptions.sameSite = 'lax';
            refreshTokenCookieOptions.sameSite = 'lax';
        }

        res.cookie('refreshToken', newRefreshToken, refreshTokenCookieOptions);
        
        res.cookie('accessToken', accessToken, accessTokenCookieOptions);

        res.status(200).json({ message: 'Token refreshed'});

        } catch (error) {

        const cookieDomain = process.env.AWASTREAM_ROOT_DOMAIN || undefined;

        const cookieOptions = {
            httpOnly: true,
            expires: new Date(0), // Clears the cookie immediately
            path: '/',
            domain: cookieDomain,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        };
        
        // Clear all session cookies
        res.cookie('refreshToken', '', cookieOptions);
        
        res.cookie('accessToken', '', { 
            ...cookieOptions, 
            httpOnly: true 
        });
        
        res.status(401);
        throw new Error('Not authorized, token failed or user session is invalid.');
    }
});

const registerUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, userName, email, password, intent, referralCode } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User with this email already exists.');
    }
    const userNameExists = await User.findOne({ userName });
    if (userNameExists) {
        res.status(400);
        throw new Error(`The username "${userName}" is already taken. Please choose another.`);
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    let userRole = (intent === 'creator') ? 'creator' : 'viewer';
    const user = await User.create({
        firstName,
        lastName,
        userName,
        email,
        passwordHash,
        authMethod: 'local',
        role: userRole,
    });
if (referralCode) {
    const referrer = await User.findOne({ userName: referralCode, role: 'onboarder' });
    if (referrer) {
        user.referredBy = referrer._id; // Update the user object we created
        await user.save(); // And save the change to the database
    }
}
    if (!user) {
        res.status(400);
        throw new Error('Invalid user data');
    }
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();
    const verificationUrl = `${process.env.AWASTREAM_FRONTEND_HOST}/verify-email?token=${verificationToken}`;
    try {
        await sendEmail({
            subject: 'Verify Your AwaStream Account',
            send_to: user.email,
            sent_from: `${process.env.AWASTREAM_FROM_NAME || 'AwaStream Team'} <${process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com'}>`,
            reply_to: process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com',
            template: 'emailVerification',
            name: user.firstName,
            link: verificationUrl,
        });
        res.status(201).json({
            message: `Registration successful! A verification email has been sent to ${user.email}.`
        });
    } catch (error) {
        user.emailVerificationToken = undefined;
        user.emailVerificationTokenExpires = undefined;
        await user.save();
        res.status(500);
        throw new Error('Email could not be sent. Please check server configuration.');
    }
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // 1. Find user, explicitly selecting passwordHash and the new lockout fields.
    const user = await User.findOne({ email }).select('+passwordHash +loginAttempts +lockUntil');

    if (!user) {
        res.status(401);
        throw new Error('Invalid email or password.');
    }

    // 2. 🚨 CRITICAL CHECK: ACCOUNT LOCKOUT
    if (user.isLocked()) {
        res.status(423); // 423 Locked is the correct status code
        const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));
        throw new Error(`Account locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`);
    }

    // 3. Check password
    const isMatch = await user.matchPassword(password);

    if (isMatch) {
        // SUCCESS PATH: Reset lockout fields and continue
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        user.lastLogin = Date.now();
        await user.save();
        
        // Final check for email verification status
        if (!user.isEmailVerified) {
             // 403 status is handled by the overall error handler; just send the specific error code
             res.status(403);
             res.json({ error: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email to continue login.' });
             return;
        }

        sendTokenResponse(user, 200, res);

    } else {
        // Increment attempts
        user.loginAttempts += 1;
        
        // Check if lockout threshold is met
        if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
            user.lockUntil = new Date(Date.now() + LOCK_TIME);
            user.loginAttempts = 0; // Reset attempts after locking
            
            await user.save();
            
            res.status(423); // 423 Locked
            throw new Error(`Too many failed login attempts. Account locked for ${LOCK_TIME / (60 * 1000)} minutes.`);
        }
        
        // If not locked, just save the incremented attempt count
        await user.save();

        res.status(401);
        throw new Error('Invalid email or password.'); 
    }
});


const googleCallback = asyncHandler(async (req, res) => {
    sendTokenResponse(req.user, 302, res);
});

const verifyEmail = asyncHandler(async (req, res) => {
    const { token } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationTokenExpires: { $gt: Date.now() },
    });
    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired verification token. Please request a new one.');
    }
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpires = undefined;
    await user.save();
    sendTokenResponse(user, 200, res);
});

const resendVerificationEmail = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
        res.status(404);
        throw new Error('User with that email does not exist.');
    }
    if (user.isEmailVerified) {
        res.status(400);
        throw new Error('This account has already been verified.');
    }
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();
    const verificationUrl = `${process.env.AWASTREAM_FRONTEND_HOST}/verify-email?token=${verificationToken}`;
    try {
        await sendEmail({
            subject: 'Resend: Verify Your AwaStream Account',
            send_to: user.email,
            sent_from: `${process.env.AWASTREAM_FROM_NAME || 'AwaStream Team'} <${process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com'}>`,
            reply_to: process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com',
            template: 'emailVerification',
            name: user.firstName,
            link: verificationUrl,
        });
        res.status(200).json({ message: `A new verification email has been sent to ${user.email}.` });
    } catch (error) {
        res.status(500);
        throw new Error('Email could not be sent. Please try again later.');
    }
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
        res.status(404);
        throw new Error('There is no user with that email address.');
    }
    const resetToken = user.generatePasswordResetToken();
    await user.save();
    const resetUrl = `${process.env.AWASTREAM_FRONTEND_HOST}/reset-password?token=${resetToken}`;
    try {
        await sendEmail({
            subject: 'AwaStream Password Reset Request',
            send_to: user.email,
            sent_from: `${process.env.AWASTREAM_FROM_NAME || 'AwaStream Team'} <${process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com'}>`,
            reply_to: process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com',
            template: 'passwordReset',
            name: user.firstName,
            link: resetUrl,
        });
        res.status(200).json({ message: 'Password reset link has been sent to your email.' });
    } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        res.status(500);
        throw new Error('Email could not be sent.');
    }
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token } = req.query;
    const { password } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired password reset token.');
    }
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    sendTokenResponse(user, 200, res);
});


const changePassword = asyncHandler(async (req, res) => {
    
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id).select('+passwordHash');

    if (!user) {

        res.status(404);
        throw new Error('User not found.');
    }

    // 3. Verify their current password
    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
        res.status(401); 
        throw new Error('Incorrect current password.');
    }

    // 4. Hash and save the new password
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({ message: 'Password changed successfully.' });
});


const logoutUser = asyncHandler(async (req, res) => {
    const cookieDomain = process.env.AWASTREAM_ROOT_DOMAIN || undefined;
    
    const cookieOptions = {
        httpOnly: true,
        expires: new Date(0),
        path: '/',
        domain: cookieDomain, 
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    };

    res.cookie('refreshToken', '', cookieOptions);


    const accessTokenCookieOptions = {
        ...cookieOptions,
        httpOnly: false,};

    res.cookie('accessToken', '', accessTokenCookieOptions);
    
    // 3. CRITICAL: Destroy the server-side session (clears connect.id cookie)
    // This depends on your session setup (e.g., express-session)
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                console.error("Session destruction failed:", err);
                // Continue with response even on minor session failure
            }
        });
    }

    res.status(200).json({ message: 'Logout successful' });
});


const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (user) {
        res.json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            userName: user.userName,
            email: user.email,
            avatarUrl: user.avatarUrl,
            role: user.role,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

module.exports = {
    registerUser,
    loginUser,
    googleCallback,
    refreshToken,
    getMe,
    logoutUser,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    changePassword,
};


//clean up









// const asyncHandler = require('express-async-handler');

// const bcrypt = require('bcryptjs');

// const jwt = require('jsonwebtoken');

// const crypto = require('crypto');

// const User = require('../models/User');

// const generateTokens = require('../utils/generateTokens');

// const { MAX_LOGIN_ATTEMPTS, LOCK_TIME } = require('../config/constants')

// const { sendEmail } = require('../services/emailService');



// // --- Updated sendTokenResponse function (Performs Redirect) ---

// const sendTokenResponse = (user, statusCode, res) => {

//     const { accessToken, refreshToken } = generateTokens(user._id, user.role);



// const cookieDomain = process.env.AWASTREAM_ROOT_DOMAIN || undefined;

//     // REFRESH Token Options (HTTP-ONLY)

//     const refreshTokenCookieOptions = {

//         expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days

//         httpOnly: true,

//         path: '/',

//         domain: cookieDomain



//     };

   

//     // ACCESS Token Options (NON-HTTP-ONLY)

//     const accessTokenCookieOptions = {

//         expires: new Date(Date.now() + 15 * 60 * 1000),

//         httpOnly: true,

//         path: '/',

//         domain: cookieDomain,

//     };



//     if (process.env.NODE_ENV === 'production') {

//         refreshTokenCookieOptions.secure = true;

//         refreshTokenCookieOptions.sameSite = 'none';

//         accessTokenCookieOptions.secure = true;

//         accessTokenCookieOptions.sameSite = 'none';

//     } else {

//         refreshTokenCookieOptions.sameSite = 'lax';

//         accessTokenCookieOptions.sameSite = 'lax';

//     }



//     res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);

//     res.cookie('accessToken', accessToken, accessTokenCookieOptions);





//     let redirectPath;

//    // Role-based Path Determination

//     switch (user.role) {

//         case 'superadmin':

//             redirectPath = '/admin/dashboard';

//             break;

//         case 'onboarder':

//             redirectPath = '/onboarder/dashboard';

//             break;

//         case 'creator':

//             redirectPath = '/dashboard';

//             break;

//         case 'viewer':

//             redirectPath = '/library';

//             break;

//         default:

//             redirectPath = '/';

//     }



//     if (statusCode === 302) {

//         const frontendUrl = process.env.AWASTREAM_FRONTEND_URL || process.env.AWASTREAM_FRONTEND_HOST || 'http://localhost:5173';

       

//         // Use res.redirect for a cleaner OAuth hand-off.

//         return res.redirect(`${frontendUrl}${redirectPath}`);

//     }

   

//     // Fallback response for all non-redirect scenarios

//     res.status(statusCode).json({

//         redirectPath: redirectPath,

//         user: {

//             firstName: user.firstName,

//             avatarUrl: user.avatarUrl

//         }

//     });

// };



// const refreshToken = asyncHandler(async (req, res) => {

//     const token = req.cookies.refreshToken;



//     if (!token) {

//         res.status(401);

//         throw new Error('Not authorized, no refresh token provided.');

//     }



//     try {

//         // 1. Verify the token to get the user ID

//         const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);



//         const user = await User.findById(decoded.id);



//         // 4. Check if user exists or is active/not suspended

//         if (!user || user.status !== 'active') {

//             res.status(401);

//             throw new Error('User not found or account is inactive.');

//         }



//         // 5. Generate the new access token using the FRESH role from the database

//         const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id, user.role);



//         const cookieDomain = process.env.AWASTREAM_ROOT_DOMAIN || undefined;



//         const accessTokenCookieOptions = {

//             expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes

//             httpOnly: true,

//             path: '/',

//             domain: cookieDomain,

//         };



//         // --- REFRESH Token Options (Used for RTOR) ---

//         const refreshTokenCookieOptions = {

//             expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days (Match sendTokenResponse)

//             httpOnly: true,

//             path: '/',

//             domain: cookieDomain

//         };



//        if (process.env.NODE_ENV === 'production') {

//             accessTokenCookieOptions.secure = true;

//             accessTokenCookieOptions.sameSite = 'none';

//             refreshTokenCookieOptions.secure = true; // Set secure flags for the new refresh token

//             refreshTokenCookieOptions.sameSite = 'none';

//         } else {

//             accessTokenCookieOptions.sameSite = 'lax';

//             refreshTokenCookieOptions.sameSite = 'lax';

//         }



//         res.cookie('refreshToken', newRefreshToken, refreshTokenCookieOptions);

       

//         res.cookie('accessToken', accessToken, accessTokenCookieOptions);



//         res.status(200).json({ message: 'Token refreshed'});



//         } catch (error) {



//         const cookieDomain = process.env.AWASTREAM_ROOT_DOMAIN || undefined;



//         const cookieOptions = {

//             httpOnly: true,

//             expires: new Date(0),

//             path: '/',

//             domain: cookieDomain,

//             secure: process.env.NODE_ENV === 'production',

//             sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',

//         };

       

//         res.cookie('refreshToken', '', cookieOptions);

       

//         res.cookie('accessToken', '', {

//             ...cookieOptions,

//             httpOnly: false

//         });

       

//         res.status(401);

//         throw new Error('Not authorized, token failed or user session is invalid.');

//     }

// });



// const registerUser = asyncHandler(async (req, res) => {

//     const { firstName, lastName, userName, email, password, intent, referralCode } = req.body;

//     const userExists = await User.findOne({ email });

//     if (userExists) {

//         res.status(400);

//         throw new Error('User with this email already exists.');

//     }

//     const userNameExists = await User.findOne({ userName });

//     if (userNameExists) {

//         res.status(400);

//         throw new Error(`The username "${userName}" is already taken. Please choose another.`);

//     }

//     const salt = await bcrypt.genSalt(10);

//     const passwordHash = await bcrypt.hash(password, salt);

//     let userRole = (intent === 'creator') ? 'creator' : 'viewer';

//     const user = await User.create({

//         firstName,

//         lastName,

//         userName,

//         email,

//         passwordHash,

//         authMethod: 'local',

//         role: userRole,

//     });

// if (referralCode) {

//     const referrer = await User.findOne({ userName: referralCode, role: 'onboarder' });

//     if (referrer) {

//         user.referredBy = referrer._id; // Update the user object we created

//         await user.save(); // And save the change to the database

//     }

// }

//     if (!user) {

//         res.status(400);

//         throw new Error('Invalid user data');

//     }

//     const verificationToken = user.generateEmailVerificationToken();

//     await user.save();

//     const verificationUrl = `${process.env.AWASTREAM_FRONTEND_HOST}/verify-email?token=${verificationToken}`;

//     try {

//         await sendEmail({

//             subject: 'Verify Your AwaStream Account',

//             send_to: user.email,

//             sent_from: `${process.env.AWASTREAM_FROM_NAME || 'AwaStream Team'} <${process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com'}>`,

//             reply_to: process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com',

//             template: 'emailVerification',

//             name: user.firstName,

//             link: verificationUrl,

//         });

//         res.status(201).json({

//             message: `Registration successful! A verification email has been sent to ${user.email}.`

//         });

//     } catch (error) {

//         user.emailVerificationToken = undefined;

//         user.emailVerificationTokenExpires = undefined;

//         await user.save();

//         res.status(500);

//         throw new Error('Email could not be sent. Please check server configuration.');

//     }

// });



// const loginUser = asyncHandler(async (req, res) => {

//     const { email, password } = req.body;



//     // 1. Find user, explicitly selecting passwordHash and the new lockout fields.

//     const user = await User.findOne({ email }).select('+passwordHash +loginAttempts +lockUntil');



//     if (!user) {

//         res.status(401);

//         throw new Error('Invalid email or password.');

//     }



//     // 2. 🚨 CRITICAL CHECK: ACCOUNT LOCKOUT

//     if (user.isLocked()) {

//         res.status(423); // 423 Locked is the correct status code

//         const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));

//         throw new Error(`Account locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`);

//     }



//     // 3. Check password

//     const isMatch = await user.matchPassword(password);



//     if (isMatch) {

//         // SUCCESS PATH: Reset lockout fields and continue

//         user.loginAttempts = 0;

//         user.lockUntil = undefined;

//         user.lastLogin = Date.now();

//         await user.save();

       

//         // Final check for email verification status

//         if (!user.isEmailVerified) {

//              // 403 status is handled by the overall error handler; just send the specific error code

//              res.status(403);

//              res.json({ error: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email to continue login.' });

//              return;

//         }



//         sendTokenResponse(user, 200, res);



//     } else {

//         // Increment attempts

//         user.loginAttempts += 1;

       

//         // Check if lockout threshold is met

//         if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {

//             user.lockUntil = new Date(Date.now() + LOCK_TIME);

//             user.loginAttempts = 0; // Reset attempts after locking

           

//             await user.save();

           

//             res.status(423); // 423 Locked

//             throw new Error(`Too many failed login attempts. Account locked for ${LOCK_TIME / (60 * 1000)} minutes.`);

//         }

       

//         // If not locked, just save the incremented attempt count

//         await user.save();



//         res.status(401);

//         throw new Error('Invalid email or password.');

//     }

// });





// const googleCallback = asyncHandler(async (req, res) => {

//     sendTokenResponse(req.user, 302, res);

// });



// const verifyEmail = asyncHandler(async (req, res) => {

//     const { token } = req.body;

//     const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

//     const user = await User.findOne({

//         emailVerificationToken: hashedToken,

//         emailVerificationTokenExpires: { $gt: Date.now() },

//     });

//     if (!user) {

//         res.status(400);

//         throw new Error('Invalid or expired verification token. Please request a new one.');

//     }

//     user.isEmailVerified = true;

//     user.emailVerificationToken = undefined;

//     user.emailVerificationTokenExpires = undefined;

//     await user.save();

//     sendTokenResponse(user, 200, res);

// });



// const resendVerificationEmail = asyncHandler(async (req, res) => {

//     const { email } = req.body;

//     const user = await User.findOne({ email });

//     if (!user) {

//         res.status(404);

//         throw new Error('User with that email does not exist.');

//     }

//     if (user.isEmailVerified) {

//         res.status(400);

//         throw new Error('This account has already been verified.');

//     }

//     const verificationToken = user.generateEmailVerificationToken();

//     await user.save();

//     const verificationUrl = `${process.env.AWASTREAM_FRONTEND_HOST}/verify-email?token=${verificationToken}`;

//     try {

//         await sendEmail({

//             subject: 'Resend: Verify Your AwaStream Account',

//             send_to: user.email,

//             sent_from: `${process.env.AWASTREAM_FROM_NAME || 'AwaStream Team'} <${process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com'}>`,

//             reply_to: process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com',

//             template: 'emailVerification',

//             name: user.firstName,

//             link: verificationUrl,

//         });

//         res.status(200).json({ message: `A new verification email has been sent to ${user.email}.` });

//     } catch (error) {

//         res.status(500);

//         throw new Error('Email could not be sent. Please try again later.');

//     }

// });



// const forgotPassword = asyncHandler(async (req, res) => {

//     const { email } = req.body;

//     const user = await User.findOne({ email });

//     if (!user) {

//         res.status(404);

//         throw new Error('There is no user with that email address.');

//     }

//     const resetToken = user.generatePasswordResetToken();

//     await user.save();

//     const resetUrl = `${process.env.AWASTREAM_FRONTEND_HOST}/reset-password?token=${resetToken}`;

//     try {

//         await sendEmail({

//             subject: 'AwaStream Password Reset Request',

//             send_to: user.email,

//             sent_from: `${process.env.AWASTREAM_FROM_NAME || 'AwaStream Team'} <${process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com'}>`,

//             reply_to: process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com',

//             template: 'passwordReset',

//             name: user.firstName,

//             link: resetUrl,

//         });

//         res.status(200).json({ message: 'Password reset link has been sent to your email.' });

//     } catch (error) {

//         user.resetPasswordToken = undefined;

//         user.resetPasswordExpires = undefined;

//         await user.save();

//         res.status(500);

//         throw new Error('Email could not be sent.');

//     }

// });



// const resetPassword = asyncHandler(async (req, res) => {

//     const { token } = req.query;

//     const { password } = req.body;

//     const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

//     const user = await User.findOne({

//         resetPasswordToken: hashedToken,

//         resetPasswordExpires: { $gt: Date.now() },

//     });

//     if (!user) {

//         res.status(400);

//         throw new Error('Invalid or expired password reset token.');

//     }

//     const salt = await bcrypt.genSalt(10);

//     user.passwordHash = await bcrypt.hash(password, salt);

//     user.resetPasswordToken = undefined;

//     user.resetPasswordExpires = undefined;

//     await user.save();

//     sendTokenResponse(user, 200, res);

// });





// const changePassword = asyncHandler(async (req, res) => {

   

//     const { currentPassword, newPassword } = req.body;

   

//     const user = await User.findById(req.user.id).select('+passwordHash');



//     if (!user) {



//         res.status(404);

//         throw new Error('User not found.');

//     }



//     // 3. Verify their current password

//     const isMatch = await user.matchPassword(currentPassword);



//     if (!isMatch) {

//         res.status(401);

//         throw new Error('Incorrect current password.');

//     }



//     // 4. Hash and save the new password

//     const salt = await bcrypt.genSalt(10);

//     user.passwordHash = await bcrypt.hash(newPassword, salt);

//     await user.save();



//     res.status(200).json({ message: 'Password changed successfully.' });

// });





// const logoutUser = asyncHandler(async (req, res) => {

//     const cookieDomain = process.env.AWASTREAM_ROOT_DOMAIN || undefined;

   

//     const cookieOptions = {

//         httpOnly: true,

//         expires: new Date(0),

//         path: '/',

//         domain: cookieDomain,

//         secure: process.env.NODE_ENV === 'production',

//         sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',

//     };



//     res.cookie('refreshToken', '', cookieOptions);





//     const accessTokenCookieOptions = {

//         ...cookieOptions,

//         httpOnly: false,};



//     res.cookie('accessToken', '', accessTokenCookieOptions);

   

//     // 3. CRITICAL: Destroy the server-side session (clears connect.id cookie)

//     // This depends on your session setup (e.g., express-session)

//     if (req.session) {

//         req.session.destroy(err => {

//             if (err) {

//                 console.error("Session destruction failed:", err);

//                 // Continue with response even on minor session failure

//             }

//         });

//     }



//     res.status(200).json({ message: 'Logout successful' });

// });





// const getMe = asyncHandler(async (req, res) => {

//     const user = await User.findById(req.user.id);

//     if (user) {

//         res.json({

//             _id: user._id,

//             firstName: user.firstName,

//             lastName: user.lastName,

//             userName: user.userName,

//             email: user.email,

//             avatarUrl: user.avatarUrl,

//             role: user.role,

//         });

//     } else {

//         res.status(404);

//         throw new Error('User not found');

//     }

// });



// module.exports = {

//     registerUser,

//     loginUser,

//     googleCallback,

//     refreshToken,

//     getMe,

//     logoutUser,

//     verifyEmail,

//     resendVerificationEmail,

//     forgotPassword,

//     resetPassword,

//     changePassword,

// };
