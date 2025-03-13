const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
require('dotenv').config();

const port = 8080;
const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

if (!APP_ID || !APP_CERTIFICATE) {
    console.error("APP_ID or APP_CERTIFICATE is missing. Check your .env file.");
    process.exit(1);
}

const app = express();

const nocache = (req, res, next) => {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
};

const generateAccessToken = (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');

    console.log("Received request:", req.query);

    const channelName = req.query.channelName;
    if (!channelName) {
        console.log("Error: Channel name is required.");
        return res.status(400).json({ error: 'channel name is required' });
    }

    let uid = req.query.uid || 0;
    let role = req.query.role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    let expireTime = parseInt(req.query.expireTime, 10) || 3600;
    const privilegeExpireTime = Math.floor(Date.now() / 1000) + expireTime;

    console.log("Params - Channel:", channelName, "UID:", uid, "Role:", role === RtcRole.PUBLISHER ? "Publisher" : "Subscriber", "Expires:", privilegeExpireTime);
    console.log("App Config - APP_ID:", APP_ID, "APP_CERTIFICATE:", APP_CERTIFICATE);

    try {
        const token = RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERTIFICATE,
            channelName,
            uid,
            role,
            privilegeExpireTime
        );

        console.log("Generated Token:", token);
        res.json({ token });
    } catch (error) {
        console.error("Error generating token:", error);
        res.status(500).json({ error: 'Failed to generate token' });
    }
};

app.get('/api/access_token', nocache, generateAccessToken);

app.listen(port, () => {
    console.log(`Agora Token Server listening at http://localhost:${port}`);
});
