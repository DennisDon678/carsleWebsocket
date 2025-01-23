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

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Add user to online users when they join
    socket.on('userConnected', (username) => {
        onlineUsers[socket.id] = username;
        console.log(`User added: ${username} (ID: ${socket.id})`);

        // Broadcast updated online users list
        io.emit('updateOnlineUsers', onlineUsers);
    });

    // Join a specific chat room
    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
    });

    // Handle chat messages
    socket.on('sendMessage', ({ room, message, username }) => {
        socket.to(room).emit('receiveMessage', { message, username });
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        delete onlineUsers[socket.id];

        // Broadcast updated online users list
        io.emit('updateOnlineUsers', onlineUsers);
    });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});