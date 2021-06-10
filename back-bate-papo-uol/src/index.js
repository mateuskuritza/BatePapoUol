import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import { stripHtml } from "string-strip-html";
import { strict as assert } from "assert";

const server = express();
server.use(cors());
server.use(express.json());
server.listen(4000, () => console.log("Running server..."));

let participants = [];
const messages = [];

const interval = setInterval(clearInactiveParticipants, 15000);

server.post("/participants", (req, res) => {
    const newParticipant = req.body;

    newParticipant.name = stripHtml(newParticipant.name).result.trim();

    if (newParticipant.name === "" || participants.find((p) => p.name === newParticipant.name)) {
        res.sendStatus(400);
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
    console.log("New participant add...");
    res.sendStatus(200);
});

server.get("/participants", (req, res) => {
    console.log("Send participants list...");
    res.send(participants);
});

server.get("/messages", (req, res) => {
    const limitMessages = req.query.limit || messages.length;
    const thisUser = stripHtml(req.headers.user).result.trim();
    const messagesFiltered = userMessagesFilter(thisUser).slice(-limitMessages);

    res.status(200).send(messagesFiltered);
    console.log("Send messages to front...");
});

server.post("/messages", (req, res) => {
    const newMessage = sanitizeMessage(req.body);
    newMessage.from = stripHtml(req.headers.user).result.trim();


    if (!validNewMessage(newMessage)) {
        res.sendStatus(400);
        return;
    }

    newMessage.time = dayjs(Date.now()).format("HH:mm:ss");
    messages.push(newMessage);

    console.log("New message received");
    console.log(newMessage);
    res.sendStatus(200);
});

server.post("/status", (req, res) => {
    const thisUser = stripHtml(req.headers.user).result.trim(); 
    const thisParticipant = participants.find((p) => p.name === thisUser);
    const index = participants.indexOf(thisParticipant);

    if (!thisParticipant) {
        res.sendStatus(400);
        return;
    }

    thisParticipant.lastStatus = Date.now();
    participants.splice(index, 1, thisParticipant);
    console.log("Participant timestamp att");

    res.sendStatus(200);
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

function sanitizeMessage(message) {
    message.to = stripHtml(message.to).result.trim();
    message.from = stripHtml(message.to).result.trim();
    message.type = stripHtml(message.type).result.trim();
    message.text = stripHtml(message.text).result.trim();
    return message;
}
