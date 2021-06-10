import express from "express";
import cors from "cors";
import dayjs from "dayjs";
import { stripHtml } from "string-strip-html";
import fs from "fs";
import Joi from "joi";

//  server config
const server = express();
server.use(cors());
server.use(express.json());
server.listen(4000, () => console.log("Running server..."));

// data persistence
if (!fs.existsSync("./back-bate-papo-uol/src/messages.json")) {
    fs.writeFileSync("./back-bate-papo-uol/src/messages.json", JSON.stringify([]));
}

if (!fs.existsSync("./back-bate-papo-uol/src/participants.json")) {
    fs.writeFileSync("./back-bate-papo-uol/src/participants.json", JSON.stringify([]));
}

function updateParticipantsJson() {
    fs.writeFileSync("./back-bate-papo-uol/src/participants.json", JSON.stringify(participants, null, 2));
}

function updateMessagesJson() {
    fs.writeFileSync("./back-bate-papo-uol/src/messages.json", JSON.stringify(messages, null, 2));
}

let participants = JSON.parse(fs.readFileSync("./back-bate-papo-uol/src/participants.json"));
let messages = JSON.parse(fs.readFileSync("./back-bate-papo-uol/src/messages.json"));

// remove inative users
const interval = setInterval(clearInactiveParticipants, 15000);

// routes
server.post("/participants", (req, res) => {
    const newParticipant = req.body;

    newParticipant.name = stripHtml(newParticipant.name).result.trim();

    if (
        validateUserPost.validate(newParticipant).error !== undefined ||
        participants.find((p) => p.name === newParticipant.name)
    ) {
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
    updateParticipantsJson();
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
    updateMessagesJson();
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
    updateParticipantsJson();
});

function userMessagesFilter(user) {
    return messages.filter(
        (message) =>
            message.type === "message" ||
            message.type === "status" ||
            message.from === user ||
            message.to === user ||
            message.to === "Todos"
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

    updateParticipantsJson();
    console.log("InactiveParticipants removed...");
}

// sanitize with strip-html library
function sanitizeMessage(message) {
    message.to = stripHtml(message.to).result.trim();
    message.from = stripHtml(message.to).result.trim();
    message.type = stripHtml(message.type).result.trim();
    message.text = stripHtml(message.text).result.trim();
    return message;
}

// validate with Joi library
const validateUserPost = Joi.object({
    name: Joi.string().alphanum().min(3).required(),
});

const validateNewMessage = Joi.object({
    to: Joi.string().alphanum().required(),
    from: Joi.string().alphanum().required(),
    text: Joi.string().alphanum().min(1).required(),
    type: Joi.string().alphanum().required(),
});

function validNewMessage(message) {
    if (validateNewMessage.validate(message).error !== undefined) {
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
