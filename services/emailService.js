const SibApiV3Sdk = require('sib-api-v3-sdk');
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const Settings = require('../models/Settings');

// --- Helper function to render Handlebars templates ---
const renderTemplate = (templateName, data) => {
    const filePath = path.join(__dirname, `../emails/${templateName}.handlebars`);
    const source = fs.readFileSync(filePath, 'utf-8').toString();
    const template = handlebars.compile(source);
    const dataWithYear = { ...data, currentYear: new Date().getFullYear() };
    return template(dataWithYear);
};

// --- Service 1: Brevo (API-based) ---
const sendEmailWithBrevo = async (options) => {
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKey = defaultClient.authentications['api-key'];
    apiKey.apiKey = process.env.BREVO_API_KEY;

    const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
    const sender = {
        email: options.sent_from.match(/<(.*)>/)[1],
        name: options.sent_from.replace(/ <.*>/, ''),
    };
    const receivers = [{ email: options.send_to }];
    const htmlContent = renderTemplate(options.template, {
        name: options.name,
        link: options.link,
    });

    console.log("📧 Sending email via Brevo to:", options.send_to);
    await tranEmailApi.sendTransacEmail({
        sender,
        to: receivers,
        subject: options.subject,
        replyTo: { email: options.reply_to },
        htmlContent: htmlContent,
    });
};

// --- Service 2: Nodemailer (SMTP-based) ---
const sendEmailWithNodemailer = async (options) => {
    const transporter = nodemailer.createTransport({
        host: process.env.AWASTREAM_EMAIL_HOST,
        port: process.env.AWASTREAM_EMAIL_PORT,
        secure: true, // true for 465
        auth: {
            user: process.env.AWASTREAM_EMAIL_USER,
            pass: process.env.AWASTREAM_EMAIL_PASS,
        },
    });

    const htmlContent = renderTemplate(options.template, {
        name: options.name,
        link: options.link,
    });

    console.log("📧 Sending email via Nodemailer SMTP to:", options.send_to);
    await transporter.sendMail({
        from: options.sent_from,
        to: options.send_to,
        replyTo: options.reply_to,
        subject: options.subject,
        html: htmlContent,
    });
};

// --- Main Exported Function ---
const sendEmail = async (options) => {
    // 1. Fetch the current settings from the database
    const currentSettings = await Settings.findOne({ singleton: 'main_settings' });

    // 2. Use the database setting to decide which service to use
    //    Default to 'brevo' if settings don't exist or aren't set.
    const provider = currentSettings?.emailProvider || 'brevo';

    if (provider === 'brevo') {
        return sendEmailWithBrevo(options);
    } else {
        return sendEmailWithNodemailer(options);
    }
};

module.exports = { sendEmail };