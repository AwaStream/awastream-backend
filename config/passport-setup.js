// const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
// const User = require('../models/User');
// const { uploadExternalImageToCloudinary } = require('../utils/cloudinary')

// passport.use(
//     new GoogleStrategy(
//         {
//             clientID: process.env.GOOGLE_CLIENT_ID,
//             clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//             callbackURL: '/api/v1/auth/google/callback',
//             passReqToCallback: true,
//         },
//         async (req, accessToken, refreshToken, profile, done) => {
//             const { id, name, emails, photos } = profile;
//             const email = emails[0].value;

//             const originalAvatarUrl = photos ? photos[0].value : null;

//             let avatarUrl = null;
//             if (originalAvatarUrl) {
//                 avatarUrl = await uploadExternalImageToCloudinary(originalAvatarUrl);

//             }

//             try {
//                 let user = await User.findOne({ googleId: id });

//                 if (user) {
//                     user.lastLogin = new Date();
//                     await user.save();
//                     return done(null, user);
//                 }

//                 const existingEmailUser = await User.findOne({ email });
//                 if (existingEmailUser) {
//                     if (existingEmailUser.authMethod === 'local') {
//                         existingEmailUser.googleId = id;
//                         existingEmailUser.authMethod = 'google'; // or 'hybrid' if you want to allow both
//                         existingEmailUser.isEmailVerified = true; // Google guarantees this
//                         existingEmailUser.avatarUrl = avatarUrl; // Update avatar from Google
//                         existingEmailUser.lastLogin = new Date();
        
//                         await existingEmailUser.save();
//                         return done(null, existingEmailUser);
//                 } else {
//                     return done(new Error(`This email (${email}) is already linked to another social account.`), null);

//                 }
//                 // Add a strict whitelist for the role assignment
//                 const allowedIntents = ['creator', 'viewer'];
//                 const userIntent = req.session.intent;

//                 // Use 'creator' as the strict default if the intent is missing or invalid
//                 let newRole = 'creator';
//                 if (allowedIntents.includes(userIntent)) {
//                     newRole = userIntent;
//                 }
                

//                 const firstName = name.givenName || 'User';
//                 const lastName = name.familyName || ''; 
//                 const userName = email.split('@')[0] + Math.floor(Math.random() * 1000);

//                 const newUser = await User.create({
//                     googleId: id,
//                     firstName: firstName,
//                     lastName: lastName, 
//                     userName: userName,
//                     email: email,
//                     avatarUrl: avatarUrl,
//                     authMethod: 'google',
//                     isEmailVerified: true,
//                     lastLogin: new Date(),
//                     role: newRole,
//                 });

//                 return done(null, newUser);
//             } catch (error) {
//                 return done(error, null);
//             }
//         }
//     )
// );

// passport.serializeUser((user, done) => {
//     done(null, user.id);
// });

// passport.deserializeUser((id, done) => {
//     User.findById(id, (err, user) => {
//         done(err, user);
//     });
// });


const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { uploadExternalImageToCloudinary } = require('../utils/cloudinary');

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/api/v1/auth/google/callback',
            passReqToCallback: true, // We need this to access 'req.query.state'
        },
        async (req, accessToken, refreshToken, profile, done) => {
            const { id, name, emails, photos } = profile;
            const email = emails[0].value;

            const originalAvatarUrl = photos ? photos[0].value : null;

            let avatarUrl = null;
            if (originalAvatarUrl) {
                try {
                    avatarUrl = await uploadExternalImageToCloudinary(originalAvatarUrl);
                } catch (uploadError) {
                    console.error("Cloudinary upload failed:", uploadError.message);
                    // Non-critical, so we'll just set avatarUrl to null and continue
                    avatarUrl = null; 
                }
            }

            try {
                // 1. Check if this Google ID already exists
                let user = await User.findOne({ googleId: id });

                if (user) {
                    user.lastLogin = new Date();
                    await user.save();
                    return done(null, user);
                }

                // 2. If Google ID not found, check if the email is already in use
                const existingEmailUser = await User.findOne({ email });

                if (existingEmailUser) {
                    // 2a. If user registered with 'local' (email/pass) first, link their Google ID.
                    if (existingEmailUser.authMethod === 'local') {
                        existingEmailUser.googleId = id;
                        // You might want to set this to 'hybrid' if you want to allow both logins
                        existingEmailUser.authMethod = 'google'; 
                        existingEmailUser.isEmailVerified = true; // Google guarantees this
                        
                        // Only update avatar if it's not already set, or if Google's is newer
                        if (!existingEmailUser.avatarUrl && avatarUrl) {
                             existingEmailUser.avatarUrl = avatarUrl;
                        }
                       
                        existingEmailUser.lastLogin = new Date();
                        
                        await existingEmailUser.save();
                        return done(null, existingEmailUser);
                    } else {
                        // 2b. This email is already tied to a *different* Google account. This is an error.
                        return done(new Error(`This email (${email}) is already linked to another social account.`), null);
                    }
                }

                // 3. If no user found by Google ID or Email, create a new user
                
                // --- SCALABILITY FIX: Get 'intent' from state, NOT session ---
                let userIntent = 'creator'; // Default to 'creator'
                const allowedIntents = ['creator', 'viewer'];

                if (req.query.state) {
                    try {
                        const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString('ascii'));
                        if (state.intent && allowedIntents.includes(state.intent)) {
                            userIntent = state.intent;
                        }
                    } catch (e) {
                        console.error("Failed to parse state:", e.message);
                        // Silently fall back to the default 'creator' role
                    }
                }
                // --- End of Scalability Fix ---

                const firstName = name.givenName || 'User';
                const lastName = name.familyName || ''; 
                // Generate a more unique username to avoid collisions
                const userName = email.split('@')[0] + '-' + crypto.randomBytes(4).toString('hex');

                const newUser = await User.create({
                    googleId: id,
                    firstName: firstName,
                    lastName: lastName, 
                    userName: userName,
                    email: email,
                    avatarUrl: avatarUrl,
                    authMethod: 'google',
                    isEmailVerified: true,
                    lastLogin: new Date(),
                    role: userIntent, // Use the role from the 'state'
                });

                return done(null, newUser);

            } catch (error) {
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

// IMPORTANT: Your original code used a deprecated callback format for findById
// This is the modern, async/await way which is safer.
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});