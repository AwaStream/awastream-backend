// test-mailjet.js

// Load environment variables from .env file
require('dotenv').config();

const Mailjet = require('node-mailjet');

// --- CONFIGURATION ---
const YOUR_API_KEY = process.env.MAILJET_API_KEY;
const YOUR_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

// This MUST be your verified sender email
const SENDER_EMAIL = process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com';

// Change this to your personal email
const RECIPIENT_EMAIL = 'baki.sodiq@gmail.com'; 
// --- END CONFIGURATION ---


console.log('--- Mailjet Test Starting ---');
console.log('API Key (Public):', YOUR_API_KEY ? `${YOUR_API_KEY.substring(0, 5)}...` : 'NOT FOUND');
console.log('Secret Key (Private):', YOUR_SECRET_KEY ? `${YOUR_SECRET_KEY.substring(0, 5)}...` : 'NOT FOUND');
console.log('Sender Email:', SENDER_EMAIL);

if (!YOUR_API_KEY || !YOUR_SECRET_KEY) {
    console.error('ERROR: MAILJET_API_KEY or MAILJET_SECRET_KEY is missing from your .env file.');
    process.exit(1);
}

const mailjetClient = Mailjet.apiConnect(YOUR_API_KEY, YOUR_SECRET_KEY);

const request = mailjetClient
    .post('send', { version: 'v3.1' })
    .request({
        Messages: [
            {
                From: {
                    Email: SENDER_EMAIL,
                    Name: 'Mailjet Test',
                },
                To: [
                    {
                        Email: RECIPIENT_EMAIL,
                        Name: 'Test Recipient',
                    },
                ],
                Subject: 'Mailjet API Test',
                TextPart: 'Your Mailjet keys are working!',
                HTMLPart: '<h3>Your Mailjet keys are working!</h3>',
            },
        ],
    });

request
    .then((result) => {
        console.log('\n--- SUCCESS ---');
        console.log('Test email sent successfully!');
        console.log(JSON.stringify(result.body, null, 2));
    })
    .catch((err) => {
        console.error('\n--- FAILED ---');
        console.error('Error sending email:');

        // This is the *real* error
        if (err.response && err.response.data) {
            console.error(JSON.stringify(err.response.data, null, 2));
        } else {
            console.error(err);
        }
    });