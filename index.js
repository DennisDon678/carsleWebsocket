const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");


// Create an express app
const app = express();

app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Create a server
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});


// Track online users
let onlineUsers = {};

// Track active calls
let activeCalls = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Add user to online users when they join
    socket.on('userConnected', ({ userId, username }) => {
        onlineUsers[userId] = { socketId: socket.id, username };
        console.log(`User added: ${username} (ID: ${userId}, Socket: ${socket.id})`);

        // Broadcast updated online users list
        io.emit('updateOnlineUsers', onlineUsers);
    });

    // // Join a specific chat room
    // socket.on('joinRoom', (room) => {
    //     socket.join(room);
    //     console.log(`User ${socket.id} joined room: ${room}`);
    // });

    // Handle chat messages
    socket.on('sendMessage', ({ room, message, username }) => {
        socket.to(room).emit('receiveMessage', { message, username });
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);

        // Find the user by their socketId
        const userId = Object.keys(onlineUsers).find(
            (key) => onlineUsers[key].socketId === socket.id
        );

        if (userId) {
            console.log(`Removing user: ${onlineUsers[userId].username} (ID: ${userId})`);
            delete onlineUsers[userId]; // Remove user from the list
        }

        // Broadcast updated online users list
        io.emit('updateOnlineUsers', onlineUsers);
    });

    // Notify others in the room when a user is typing
    socket.on('typing', (room) => {
        socket.to(room).emit('userTyping', { username: onlineUsers[socket.id] });
    });

    // Notify others in the room when a user stops typing
    socket.on('stopTyping', (room) => {
        socket.to(room).emit('userStoppedTyping', { username: onlineUsers[socket.id] });
    });

    // Notify room members when a user joins
    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
        socket.to(room).emit('roomNotification', {
            message: `${onlineUsers[socket.id]} has joined the room.`,
        });
    });

    // Notify room members when a user leaves
    socket.on('leaveRoom', (room) => {
        socket.leave(room);
        console.log(`User ${socket.id} left room: ${room}`);
        socket.to(room).emit('roomNotification', {
            message: `${onlineUsers[socket.id]} has left the room.`,
        });
    });


    // Call initiation
    socket.on('startCall', ({ room, callerId, callerName, callerProfileImage, receiverName, receiverId, duration }) => {
        // Check if receiver is online
        if (onlineUsers[receiverId]) {
            console.log(`Call initiated by ${callerName} (${callerId}) to ${receiverName} (${receiverId}) in room ${room}`);

            // Save the active call
            activeCalls[room] = { callerId, receiverId, duration };

            // Notify the receiver
            socket.to(onlineUsers[receiverId].socketId).emit('callNotification', {
                room,
                callerId,
                callerName,
                callerProfileImage,
                receiverName,
                duration,
            });

            // Auto end the call after the specified duration
            setTimeout(() => {
                if (activeCalls[room]) {
                    console.log(`Call duration expired for room ${room}`);
                    io.to(room).emit('callEnded', {
                        room,
                        callerId,
                        receiverId,
                    });
                    delete activeCalls[room]; // Remove the call from active calls
                }
            }, duration * 1000);
        } else {
            console.log(`User ${receiverId} is not online. Unable to send call notification.`);
            // Notify the caller that the receiver is offline
            socket.emit('receiverOffline', { receiverName });
        }
    });

    // Handle call end
    socket.on('endCall', ({ room, callerId, receiverId }) => {
        console.log(`Call ended by ${callerId} in room ${room}`);

        // Check if the call exists
        if (activeCalls[room]) {
            // Notify participants that the call has ended
            io.to(room).emit('callEnded', { room, callerId, receiverId });
            delete activeCalls[room]; // Remove the call from active calls
        } else {
            console.log(`No active call found for room ${room}`);
        }
    });

    // handle reject call
    socket.on('rejectCall', ({ room, callerId, receiverId }) => {
        console.log(`Call rejected by ${callerId} in room ${room}`);
        // Notify participants that the call has ended
        io.to(room).emit('rejectCall', { room, callerId, receiverId });
        delete activeCalls[room]; // Remove the call from active calls
    });

    // handle not answered
    socket.on('notAnswered', ({ room, callerId, receiverId }) => {
        console.log(`Call not answered by ${callerId} in room ${room}`);
        // Notify participants that the call has ended
        io.to(room).emit('notAnswered', { room, callerId, receiverId });
        delete activeCalls[room]; // Remove the call from active calls
    });

    // // Handle user disconnection and clean up active calls
    // socket.on('disconnect', () => {
    //     console.log(`User disconnected: ${socket.id}`);

    //     // Remove user from online users
    //     const userId = Object.keys(onlineUsers).find(
    //         (key) => onlineUsers[key].socketId === socket.id
    //     );
    //     if (userId) {
    //         console.log(`Removing user: ${onlineUsers[userId].username} (ID: ${userId})`);
    //         delete onlineUsers[userId];

    //         // Remove any active calls involving the disconnected user
    //         for (const room in activeCalls) {
    //             const call = activeCalls[room];
    //             if (call.callerId === userId || call.receiverId === userId) {
    //                 io.to(room).emit('callEnded', {
    //                     room,
    //                     callerId: call.callerId,
    //                     receiverId: call.receiverId,
    //                 });
    //                 delete activeCalls[room];
    //             }
    //         }
    //     }
    // });

});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});