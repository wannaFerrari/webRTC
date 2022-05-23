
const socket = io();

const returnSomething = document.querySelector("#returnSomething");
returnSomething.addEventListener("click", handleCopyCode);

const myFace = document.querySelector("#myFace");
const muteBtn = document.querySelector("#mute");
const headTitle = document.getElementById("headTitle");
const call = document.querySelector("#call");
const welcome = document.querySelector("#welcome");
const createUI = document.querySelector("#createUI");
const joinUI = document.querySelector("#joinUI");
const createRoom = document.getElementById("create");
const createDiv = document.querySelector("#createUI");
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
let creator = false;
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

const welcomeForm = welcome.querySelector("form");
const joinRoomBtn = document.getElementById("joinRoomBtn");

async function initCall() {
    welcome.hidden = true;
    returnSomething.style.display="";
    call.classList.remove(HIDDEN_CN);
    await getMedia();
}

call.classList.add(HIDDEN_CN);

if (joinRoomBtn) {
    joinRoomBtn.addEventListener("click", handleJoinRoomBtnSubmit);
}

function handleJoinRoomBtnSubmit(event) {
    event.preventDefault();
    if (socket.disconnected) {
        socket.connect();
    }
    const createRoomName = document.getElementById("roomName");
    const createNickname = document.getElementById("nickname");
    roomName = createRoomName.value;
    createRoomName.value = "";
    nickname = createNickname.value;
    createNickname.value = "";
    headTitle.innerText = "Room ID: " + roomName;
    socket.emit("join_room", roomName, nickname);
}

const joinBack = document.getElementById("joinBack");

if (joinBack) {
    joinBack.addEventListener("click", handleJoinBack);
}

function handleJoinBack() {
    joinUI.hidden = true;
    initialUI.hidden = false;
    const createRoomName = document.getElementById("roomName");
    const createNickname = document.getElementById("nickname");
    createRoomName.value = "";
    createNickname.value = "";
}

function handleCopyCode(){
    let codeValue = roomName;
    copyCode.style.display="";
    copyCode.value=codeValue;
    copyCode.select();
    document.execCommand('copy');
    copyCode.style.display = "none";
    alert("Copy completed!");
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
    returnSomething.style.display="none";
    headTitle.innerText = "Conference";
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

    for (let i = 0; i < length - 1; ++i) {
        try {
            const newPC = createConnection(
                userObjArr[i].socketId,
                userObjArr[i].nickname
            );
            const offer = await newPC.createOffer();
            await newPC.setLocalDescription(offer);
            socket.emit("offer", offer, userObjArr[i].socketId, nickname);
        } catch (err) {
        }
    }
});

socket.on("offer", async (offer, remoteSocketId, remoteNickname) => {
    try {
        const newPC = createConnection(remoteSocketId, remoteNickname);
        await newPC.setRemoteDescription(offer);
        const answer = await newPC.createAnswer();
        await newPC.setLocalDescription(answer);
        socket.emit("answer", answer, remoteSocketId);
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

socket.on("leave_room", (leavedSocketId, nickname) => {
    removeVideo(leavedSocketId);
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
