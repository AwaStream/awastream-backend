const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { uploadExternalImageToCloudinary } = require('../utils/cloudinary')

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

            const originalAvatarUrl = photos ? photos[0].value : null;

            let avatarUrl = null;
            if (originalAvatarUrl) {
                avatarUrl = await uploadExternalImageToCloudinary(originalAvatarUrl);

            }

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
                // Add a strict whitelist for the role assignment
                const allowedIntents = ['creator', 'viewer'];
                const userIntent = req.session.intent;

                // Use 'viewer' as the strict default if the intent is missing or invalid
                let newRole = 'viewer';
                if (allowedIntents.includes(userIntent)) {
                    newRole = userIntent;
                }
                

                const firstName = name.givenName || 'User';
                const lastName = name.familyName || ''; 
                const userName = email.split('@')[0] + Math.floor(Math.random() * 1000);

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
                    role: newRole,
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
    User.findById(id, (err, user) => {
        done(err, user);
    });
});