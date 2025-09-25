const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars').default;
const path = require('path');

const sendEmail = async (options) => {
    // Extract all properties from options objects
    const {
        subject,
        send_to,
        sent_from,
        reply_to,
        template,
        name,
        code,
        link,
        date,
    } = options;

    if (!template) {
        console.error("Email template name is required!");
        return false;
    }

const transporter = nodemailer.createTransport({
    host: process.env.AWASTREAM_EMAIL_HOST,
    port: process.env.AWASTREAM_EMAIL_PORT,
    secure: true,
    auth: {
        user: process.env.AWASTREAM_EMAIL_USER,
        pass: process.env.AWASTREAM_EMAIL_PASS,
    },
});

    const handlebarOptions = {
        viewEngine: {
            extname: '.handlebars',
            layoutsDir: path.resolve('./emails/layouts/'), 
            partialsDir: path.resolve('./emails/'),
            defaultLayout: 'baseLayout',
        },
        viewPath: path.resolve('./emails'),
        extName: '.handlebars',
    };

    console.log("📧 Using email template:", template);

    transporter.use('compile', hbs(handlebarOptions));

    const mailOptions = {
        from: sent_from,
        to: send_to,
        replyTo: reply_to,
        subject: subject,
        template: template, // e.g., "welcome"
        context: {
            name,
            code,
            link,
            date,
            currentYear: new Date().getFullYear()
        },
    };

    // Return a promise for better error handling
    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, function (err, info) {
            if (err) {
                console.log('Email sending failed:', err);
                reject(err);
            } else {
                console.log('Email sent:', info.response);
                resolve(info);
            }
        });
    });
};

module.exports = sendEmail;