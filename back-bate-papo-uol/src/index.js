import express from "express";
import cors from "cors";
import dayjs from "dayjs";

const server = express();
server.use(cors());
server.use(express.json());
server.listen(4000, () => console.log("Running server..."));

let participants = [];
const messages = [];

const interval = setInterval(clearInactiveParticipants, 15000);

server.post("/participants", (req, res) => {
    const newParticipant = req.body;

    if (newParticipant.name === "" || participants.find((p) => p.name === newParticipant.name)) {
        res.status(400);
        return;
    }

    newParticipant.lastStatus = Date.now();
    participants.push(newParticipant);

    const newMessage = {
        from: newParticipant.name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs(Date.now()).format("HH:mm:ss"),
    };
    messages.push(newMessage);

    res.status(200);
    console.log("New participant add...");
});

server.get("/participants", (req, res) => {
    res.send(participants);
    console.log("Send participants list...");
});

server.get("/messages", (req, res) => {
    const limitMessages = req.query.limit || messages.length;
    const thisUser = req.headers.user;
    const messagesFiltered = userMessagesFilter(thisUser).slice(-limitMessages);

    res.send(messagesFiltered);
    res.status(200);
    console.log("Send messages to front...");
});

server.post("/messages", (req, res) => {
    const newMessage = req.body;
    newMessage.from = req.headers.user;

    if (!validNewMessage(newMessage)) {
        res.status(400);
        return;
    }

    newMessage.time = dayjs(Date.now()).format("HH:mm:ss");
    messages.push(newMessage);

    console.log("New message received");
    res.status(200);
});

server.post("/status", (req, res) => {
    const thisUser = req.headers.user;
    const thisParticipant = participants.find((p) => p.name === thisUser);
    const index = participants.indexOf(thisParticipant);

    if (!thisParticipant) {
        console.log("Usuário não encontrado");
        res.status(400);
        return;
    }

    thisParticipant.lastStatus = Date.now();
    participants.splice(index, 1, thisParticipant);
    console.log("Participant timestamp att");

    res.status(200);
});

function validNewMessage(message) {
    if (message.to === "" || message.text === "") {
        return false;
    }
    if (!["message", "private_message"].includes(message.type)) {
        return false;
    }
    if (!participants.find((p) => p.name === message.from)) {
        return false;
    }
    return true;
}

function userMessagesFilter(user) {
    return messages.filter(
        (message) => message.type === "message" || message.type === "status" || message.from === user || message.to === user
    );
}

function clearInactiveParticipants() {
    const now = Date.now();
    const nowHour = dayjs(now).format("HH:mm:ss");
    const removedParticipants = participants.filter((p) => now - p.lastStatus >= 10000);

    removedParticipants.forEach((rp) =>
        messages.push({ from: rp.name, to: "Todos", text: "sai da sala...", type: "status", time: nowHour })
    );

    participants = participants.filter((p) => now - p.lastStatus <= 10000);

    console.log("InactiveParticipants removed...");
}
