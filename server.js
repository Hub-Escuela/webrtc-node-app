const express = require("express");
const app = express();
const server = require("http").createServer(app);
//const io = require('socket.io')(server)
const io = require("socket.io")(server, { transports: ["polling"] });
let rooms = {};

app.use("/", express.static("public"));

io.on("connection", (socket) => {
  socket.on("join", (roomId) => {
    const roomClients = io.sockets.adapter.rooms[roomId] || { length: 0 };
    const numberOfClients = roomClients.length;
    socket.join(roomId);
    rooms = { ...rooms, roomId };

    // These events are emitted only to the sender socket.
    if (numberOfClients == 0) {
      console.log(`Creating room ${roomId} and emitting room_created socket event`);
      socket.emit("room_created", roomId);
    } else {
      console.log(`Joining room ${roomId} and emitting room_joined socket event`);
      socket.emit("room_joined", roomId);
    }
  });

  // These events are emitted to all the sockets connected to the same room except the sender.
  socket.on("start_call", (roomId) => {
    console.log(`Broadcasting start_call event to peers in room ${roomId}`);
    socket.broadcast.to(roomId).emit("start_call", socket.id);
  });
  socket.on("webrtc_offer", (event) => {
    console.log(`Broadcasting webrtc_offer event to peers in room ${event.roomId}`);
    socket.to(event.peerSocketId).emit("webrtc_offer", event.sdp, socket.id);
  });
  socket.on("webrtc_answer", (event) => {
    console.log(`Broadcasting webrtc_answer event to peers in room ${event.roomId}`);
    socket.to(event.peerSocketId).emit("webrtc_answer", event.sdp, socket.id);
  });
  socket.on("webrtc_ice_candidate", (event) => {
    console.log(`Broadcasting webrtc_ice_candidate event to peers in room ${event.roomId}`);
    socket.to(event.peerSocketId).emit("webrtc_ice_candidate", event, socket.id);
  });

  socket.on("get_rooms", (callback) => {
    callback(rooms);
  });

  socket.on("disconnect", function (e) {
    console.log({ e }, socket.id);
    socket.broadcast.emit("peer_disconnected", socket.id);
  });
});

// START THE SERVER =================================================================
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
