// DOM elements.
const roomSelectionContainer = document.getElementById("room-selection-container");
const roomInput = document.getElementById("room-input");
const connectButton = document.getElementById("connect-button");

const videoChatContainer = document.getElementById("video-chat-container");
const localVideoComponent = document.getElementById("local-video");
const remoteVideoComponent = document.getElementById("remote-video");

// Variables.
const socket = io();
const mediaConstraints = {
  audio: true,
  video: { width: 720, height: 720 },
};
let localStream;
let remoteStream;
let rtcPeerConnection; // Connection between the local device and the remote peer.
let roomId;
let connections = {};
let videos = {};

// Free public STUN servers provided by Google.
const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

// BUTTON LISTENER ============================================================
connectButton.addEventListener("click", () => {
  roomId = 1;
  socket.emit("join", roomId);
  roomSelectionContainer.classList.toggle("hidden");
  videoChatContainer.classList.toggle("hidden");
});

// SOCKET EVENT CALLBACKS =====================================================
socket.on("room_created", async () => {
  console.log("Socket event callback: room_created");

  await setLocalStream(mediaConstraints);
});

socket.on("room_joined", async () => {
  console.log("Socket event callback: room_joined");

  await setLocalStream(mediaConstraints);
  socket.emit("start_call", roomId);
});

socket.on("start_call", async (peerSocketId) => {
  console.log("Socket event callback: start_call");

  connections[peerSocketId] = new RTCPeerConnection(iceServers);
  rtcPeerConnection = connections[peerSocketId];
  addLocalTracks(rtcPeerConnection);
  rtcPeerConnection.ontrack = setRemoteStream(peerSocketId);
  rtcPeerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("webrtc_ice_candidate", {
        roomId,
        candidate: event.candidate,
        peerSocketId,
      });
    }
  };
  let sessionDescription;
  try {
    sessionDescription = await rtcPeerConnection.createOffer();
    rtcPeerConnection.setLocalDescription(sessionDescription);
  } catch (error) {
    console.error(error);
  }

  socket.emit("webrtc_offer", {
    type: "webrtc_offer",
    sdp: sessionDescription,
    roomId,
    peerSocketId,
  });
});

socket.on("webrtc_offer", async (event, peerSocketId) => {
  console.log("Socket event callback: webrtc_offer");

  connections[peerSocketId] = new RTCPeerConnection(iceServers);
  rtcPeerConnection = connections[peerSocketId];
  addLocalTracks(rtcPeerConnection);
  rtcPeerConnection.ontrack = setRemoteStream(peerSocketId);
  rtcPeerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("webrtc_ice_candidate", {
        roomId,
        candidate: event.candidate,
        peerSocketId,
      });
    }
  };
  rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
  let sessionDescription;
  try {
    sessionDescription = await rtcPeerConnection.createAnswer();
    rtcPeerConnection.setLocalDescription(sessionDescription);
  } catch (error) {
    console.error(error);
  }

  socket.emit("webrtc_answer", {
    type: "webrtc_answer",
    sdp: sessionDescription,
    roomId,
    peerSocketId,
  });
});

socket.on("webrtc_answer", (event, peerSocketId) => {
  console.log("Socket event callback: webrtc_answer");
  connections[peerSocketId].setRemoteDescription(new RTCSessionDescription(event));
});

socket.on("webrtc_ice_candidate", (event, peerSocketId) => {
  console.log("Socket event callback: webrtc_ice_candidate");
  connections[peerSocketId].addIceCandidate(event.candidate);
});

socket.on("peer_disconnected", (peerSocketId) => {
  if (connections[peerSocketId]) {
    console.log(`Peer with socket id ${peerSocketId} disconnected`);
    connections[peerSocketId].close();
    document.getElementById(peerSocketId).remove();
    delete connections[peerSocketId];
    delete videos[peerSocketId];
  }
});

// FUNCTIONS ==================================================================

async function setLocalStream(mediaConstraints) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
  } catch (error) {
    console.error("Could not get user media", error);
  }

  localStream = stream;
  localVideoComponent.srcObject = stream;
  localVideoComponent.classList.toggle("active");
}

function addLocalTracks(rtcPeerConnection) {
  localStream.getTracks().forEach((track) => {
    rtcPeerConnection.addTrack(track, localStream);
  });
}

function setRemoteStream(peerSocketId) {
  const video = document.createElement("video");
  video.setAttribute("id", peerSocketId);
  video.setAttribute("autoplay", "autoplay");
  videoChatContainer.appendChild(video);
  videos[peerSocketId] = { remoteVideoComponent: video, remoteStream: null };
  return (event) => {
    videos[peerSocketId].remoteVideoComponent.srcObject = event.streams[0];
    videos[peerSocketId].remoteStream = event.stream;
  };
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    // Load rooms in select
    socket.emit("get_rooms", (response) => {
      console.log(response);
    });
  },
  false
);
