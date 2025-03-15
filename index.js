const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const http = require('http'); // Added missing http import
require('dotenv').config();
const { Server } = require('socket.io');

const port = 8080;
const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

if (!APP_ID || !APP_CERTIFICATE) {
    console.error("APP_ID or APP_CERTIFICATE is missing. Check your .env file.");
    process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Adjust this in production for security
    }
});

const nocache = (req, res, next) => {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
};

// Track online users: { socketId: { uid, username } }
let onlineUsers = {};

// Socket IO event handlers
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join', (data) => {
        console.log('User joined:', data);
        onlineUsers[socket.id] = data;
        io.emit('onlineUsers', onlineUsers);
    });

    socket.on('initiateCall', (data) => {
        console.log('Initiating call to:', data);
        const { targetUid, channelName, callerUsername, token } = data;

        // Find the target user by UID
        const targetSocketId = Object.keys(onlineUsers).find(
            socketId => onlineUsers[socketId].uid === targetUid
        );

        if (targetSocketId) {
            // User is online, notify them
            io.to(targetSocketId).emit('incoming-call', {
                callerUsername,
                channelName,
                token,
                callerSocketId: socket.id // Send caller's socket ID for response
            });
            socket.emit('call-status', { 
                success: true, 
                message: `Calling user ${targetUid}`,
                targetUid
            });
        } else {
            // User is offline
            socket.emit('call-status', { 
                success: false, 
                message: `User ${targetUid} is offline`,
                targetUid
            });
        }
    });

    // Handle call acceptance
    socket.on('accept-call', (data) => {
        const { callerSocketId, channelName, token } = data;
        // Notify caller that call was accepted
        io.to(callerSocketId).emit('call-accepted', {
            channelName,
            token,
            targetUid: onlineUsers[socket.id].uid
        });
    });

    // Handle call rejection
    socket.on('reject-call', (data) => {
        const { callerSocketId } = data;
        // Notify caller that call was rejected
        io.to(callerSocketId).emit('call-rejected', {
            targetUid: onlineUsers[socket.id].uid,
            message: 'Call was rejected by the user'
        });
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        delete onlineUsers[socket.id];
        io.emit('onlineUsers', onlineUsers);
    });
});

// Generate an Agora RTC Token
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

server.listen(port, () => {  // Changed from app.listen to server.listen
    console.log(`Agora Token Server listening at http://localhost:${port}`);
});