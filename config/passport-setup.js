// const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
// const User = require('../models/User');

// passport.use(
//     new GoogleStrategy(
//         {
//             clientID: process.env.GOOGLE_CLIENT_ID,
//             clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//             callbackURL: '/api/auth/google/callback',
//             passReqToCallback: true,
//         },
//         async (req, accessToken, refreshToken, profile, done) => {
//             const { id, displayName, emails, photos } = profile;
//             const email = emails[0].value;
//             const avatarUrl = photos[0].value;

//             try {
//                 let user = await User.findOne({ googleId: id });

//                 if (user) {
//                     // User exists, update last login and return
//                     user.lastLogin = new Date();
//                     await user.save();
//                     return done(null, user);
//                 }

//                 // If user doesn't exist, create a new one
//                 // Check if the email is already in use by a different auth method
//                 const existingEmailUser = await User.findOne({ email });
//                 if (existingEmailUser) {
//                     // This is an edge case where the email exists but not linked to a Google ID
//                     // You might want to link them or return an error
//                     return done(new Error(`Email ${email} is already registered. Please log in with your original method.`), null);
//                 }

//                 const intent = req.session.intent; 

//                 const newUser = await User.create({
//                     googleId: id,
//                     firstName: firstName,
//                     lastName: lastName,
//                     userName: userName,
//                     email: email,
//                     avatarUrl: avatarUrl,
//                     authMethod: 'google',
//                     isEmailVerified: true, // Email from Google is considered verified
//                     lastLogin: new Date(),
//                     role: intent === 'viewer' ? 'viewer' : 'creator',
//                 });

//                 return done(null, newUser);
//             } catch (error) {
//                 return done(error, null);
//             }
//         }
//     )
// );

// // We don't need to serialize/deserialize for JWT-based sessions
// // but these are required for passport to be configured.
// passport.serializeUser((user, done) => {
//     done(null, user.id);
// });

// passport.deserializeUser((id, done) => {
//     User.findById(id, (err, user) => done(err, user));
// });







const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/api/auth/google/callback',
            passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
            const { id, displayName, emails, photos } = profile;
            const email = emails[0].value;
            const avatarUrl = photos[0].value;

            try {
                let user = await User.findOne({ googleId: id });

                if (user) {

                    user.lastLogin = new Date();
                    await user.save();
                    return done(null, user);
                }

                const existingEmailUser = await User.findOne({ email });
                if (existingEmailUser) {
                    return done(new Error(`Email ${email} is already registered. Please log in with your original method.`), null);
                }

                const intent = req.session.intent; 

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
                    role: intent === 'viewer' ? 'viewer' : 'creator',
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

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => done(err, user));
});