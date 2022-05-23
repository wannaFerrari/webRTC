const socket = io();

const returnSomething = document.querySelector("#returnSomething");
returnSomething.addEventListener("click", handleCopyCode);

const myFace = document.querySelector("#myFace");
const muteBtn = document.querySelector("#mute");
const headTitle = document.getElementById("headTitle");
const call = document.querySelector("#call");
const copyCode = document.getElementById("copyCode");
const HIDDEN_CN = "hidden";

let myStream;
let muted = true;
let cameraOff = false;
let screenOff = true;
let roomName = "";
let nickname = "";
let peopleInRoom = 1;
let peerC;
let myPeerConnection;
var pcObj = {};
let creator = true;
let creatorStream;


async function getMedia(deviceId) {

    try {
        myStream = await navigator.mediaDevices.getDisplayMedia();
   
        if (creator) {
            myFace.srcObject = myStream;
            myFace.muted = true;
        }

        if (!creator) {
            myStream.getTracks().forEach((track) => track.stop());
        }

    } catch (error) {
        console.log(error);
    }
}


// Screen Sharing

let captureStream = null;

async function startCapture() {
    let localStream;
    try {
        captureStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: true,
        });
        localStream = captureStream;
        myFace.srcObject = captureStream;
        const videoSender = myPeerConnection
            .getSenders()
            .find((sender) => sender.track.kind === "video");
        videoSender.replaceTrack(localStream.getVideoTracks()[0]);

    } catch (error) {
        console.error(error);
    }
}

function stopCapture(evt) {
    let tracks = myFace.srcObject.getTracks();
    tracks.forEach((track) => track.stop());
    myFace.srcObject = null;
}


//page controll

async function initCall() {
    returnSomething.style.display="";
    await getMedia();
}

let code = Math.random().toString(36).substr(2, 11);
roomName = code;
nickname = "Sender";
socket.emit("create_room", code, nickname);
headTitle.innerText = "Room ID: "+code;

function handleCopyCode(){
    let codeValue = code;
    copyCode.style.display="";
    copyCode.value=codeValue;
    copyCode.select();
    document.execCommand('copy');
    copyCode.style.display = "none";
    alert("Copy completed!");
}


// Chat Form

const chatForm = document.querySelector("#chatForm");
const chatBox = document.querySelector("#chatBox");
const MYCHAT_CN = "myChat";
const NOTICE_CN = "noticeChat";

chatForm.addEventListener("submit", handleChatSubmit);

function handleChatSubmit(event) {
    event.preventDefault();
    const chatInput = chatForm.querySelector("input");
    const message = chatInput.value;
    chatInput.value = "";
    socket.emit("chat", `${nickname}: ${message}`, roomName);
    writeChat(`You: ${message}`, MYCHAT_CN);
}

function writeChat(message, className = null) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.innerText = message;
    li.appendChild(span);
    li.classList.add(className);
    chatBox.prepend(li);
}

// Leave Room

const leaveBtn = document.querySelector("#leave");

function leaveRoom() {
    socket.disconnect();
    call.classList.add(HIDDEN_CN);
    welcome.hidden = false;
    peerConnectionObjArr = [];
    peopleInRoom = 1;
    nickname = "";
    myStream.getTracks().forEach((track) => track.stop());
    myFace.srcObject = null;
    clearAllVideos();
    clearAllChat();
}

function removeVideo(leavedSocketId) {
    const streams = document.querySelector("#streams");
    const streamArr = streams.querySelectorAll("div");
    streamArr.forEach((streamElement) => {
        if (streamElement.id === leavedSocketId) {
            streams.removeChild(streamElement);
        }
    });
}

function clearAllVideos() {
    const streams = document.querySelector("#streams");
    const streamArr = streams.querySelectorAll("div");
    streamArr.forEach((streamElement) => {
        if (streamElement.id != "myStream") {
            streams.removeChild(streamElement);
        }
    });
}

function clearAllChat() {
    const chatArr = chatBox.querySelectorAll("li");
    chatArr.forEach((chat) => chatBox.removeChild(chat));
}

leaveBtn.addEventListener("click", leaveRoom);

// Modal code

const modal = document.querySelector(".modal");
const modalText = modal.querySelector(".modal__text");
const modalBtn = modal.querySelector(".modal__btn");

function paintModal(text) {
    modalText.innerText = text;
    modal.classList.remove(HIDDEN_CN);

    modal.addEventListener("click", removeModal);
    modalBtn.addEventListener("click", removeModal);
    document.addEventListener("keydown", handleKeydown);
}

function removeModal() {
    modal.classList.add(HIDDEN_CN);
    modalText.innerText = "";
}

function handleKeydown(event) {
    if (event.code === "Escape" || event.code === "Enter") {
        removeModal();
    }
}

// Socket code

socket.on("reject_join", () => {
    paintModal("The number of people has been exceeded.");
    roomName = "";
    nickname = "";
});

socket.on("room_notExists", () => {
    paintModal("The room does not exist.");
    roomName = "";
    nickname = "";
    headTitle.innerText = "Conference";
});

socket.on("same_RoomName", () => {
    paintModal("The room already exists.");
    roomName = "";
    nickname = "";
    headTitle.innerText = "Conference";
});

socket.on("no_nickName", () => {
    paintModal("Enter your Nickname!");
    const rCode = document.getElementById("roomCode");
    rCode.value = roomName;
    nickname = "";
    headTitle.innerText = "Conference";
});

socket.on("accept_join", async (userObjArr) => {
    await initCall();
    const length = userObjArr.length;
    if (length === 1) {
        return;
    }

    writeChat("---[ List of participants ]---", NOTICE_CN);
    for (let i = 0; i < length - 1; ++i) {
        try {
            const newPC = createConnection(
                userObjArr[i].socketId,
                userObjArr[i].nickname
            );
            const offer = await newPC.createOffer();
            await newPC.setLocalDescription(offer);
            socket.emit("offer", offer, userObjArr[i].socketId, nickname);
            writeChat(`' ${userObjArr[i].nickname} '`, NOTICE_CN);
        } catch (err) {
            console.error(err);
        }
    }
    writeChat("-----------------------------", NOTICE_CN);
});

socket.on("offer", async (offer, remoteSocketId, remoteNickname) => {
    try {
        const newPC = createConnection(remoteSocketId, remoteNickname);
        await newPC.setRemoteDescription(offer);
        const answer = await newPC.createAnswer();
        await newPC.setLocalDescription(answer);
        socket.emit("answer", answer, remoteSocketId);
        writeChat(` ' ${remoteNickname} ' joined the room`, NOTICE_CN);
    } catch (err) {
        console.error(err);
    }
});

socket.on("answer", async (answer, remoteSocketId) => {
    await pcObj[remoteSocketId].setRemoteDescription(answer);
});

socket.on("ice", async (ice, remoteSocketId) => {
    await pcObj[remoteSocketId].addIceCandidate(ice);
});

socket.on("chat", (message) => {
    writeChat(message);
});

socket.on("leave_room", (leavedSocketId, nickname) => {
    removeVideo(leavedSocketId);
    writeChat(`[!] user [ ${nickname} ] has left.`, NOTICE_CN);
    --peopleInRoom;
    sortStreams();
});

// RTC code

function createConnection(remoteSocketId, remoteNickname) {

    myPeerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302",
                ],
            },
        ],
    });
        
    myPeerConnection.addEventListener("icecandidate", (event) => {
        handleIce(event, remoteSocketId);
    });

    myPeerConnection.addEventListener("addstream", (event) => {
        handleAddStream(event, remoteSocketId, remoteNickname);
    });

    myStream.getTracks().forEach((track) => myPeerConnection.addTrack(track, myStream));

    pcObj[remoteSocketId] = myPeerConnection;

    ++peopleInRoom;
    sortStreams();
    return myPeerConnection;
}

function handleIce(event, remoteSocketId) {
    if (event.candidate) {
        socket.emit("ice", event.candidate, remoteSocketId);
    }
}

let onlyOnce = false;

function handleAddStream(event, remoteSocketId, remoteNickname) {
    if (onlyOnce == false) {
        creatorStream = event.stream;
        onlyOnce = true;
    }
        
    if (!creator) 
        myFace.srcObject = creatorStream;
    myFace.muted = true;
}


function sortStreams() {
    const streams = document.querySelector("#streams");
    const streamArr = streams.querySelectorAll("div");
    streamArr.forEach((stream) => (stream.className = `people${peopleInRoom}`));
}

async function addLocalStreamToPeerConnection(localStream) {
    localStream
        .getTracks()
        .forEach((track) => myPeerConnection.addTrack(track, localStream));
}
