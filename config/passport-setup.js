// const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
// const User = require('../models/User');

// passport.use(
//     new GoogleStrategy(
//         {
//             clientID: process.env.GOOGLE_CLIENT_ID,
//             clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//             callbackURL: '/api/v1/auth/google/callback',
//             passReqToCallback: true,
//         },
//         async (req, accessToken, refreshToken, profile, done) => {
//             const { id, displayName, emails, photos } = profile;
//             const email = emails[0].value;
//             const avatarUrl = photos[0].value;

//             try {
//                 let user = await User.findOne({ googleId: id });

//                 if (user) {

//                     user.lastLogin = new Date();
//                     await user.save();
//                     return done(null, user);
//                 }

//                 const existingEmailUser = await User.findOne({ email });
//                 if (existingEmailUser) {
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
//                     isEmailVerified: true,
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
            callbackURL: '/api/v1/auth/google/callback',
            passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
            const { id, name, emails, photos } = profile;
            const email = emails[0].value;
            const avatarUrl = photos ? photos[0].value : null;

            try {
                let user = await User.findOne({ googleId: id });

                if (user) {
                    user.lastLogin = new Date();
                    await user.save();
                    return done(null, user);
                }

                const existingEmailUser = await User.findOne({ email });
                if (existingEmailUser) {
                    return done(new Error(`An account with ${email} already exists. Please use your original sign-in method.`), null);
                }
                
                // --- THIS IS THE FIX ---
                // We must define our variables before using them.
                const firstName = name.givenName || 'User';
                const lastName = name.familyName || '';
                // Create a unique username from the email to prevent errors.
                const userName = email.split('@')[0] + Math.floor(Math.random() * 1000);
                
                const intent = req.session.intent;

                const newUser = await User.create({
                    googleId: id,
                    firstName: firstName, // Now using the variable we defined above
                    lastName: lastName,   // Now using the variable we defined above
                    userName: userName,   // Now using the variable we defined above
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

// These functions are required by passport
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user);
    });
});