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
if (!fs.existsSync("./src/messages.json")) {
	fs.writeFileSync("./src/messages.json", JSON.stringify([]));
}

if (!fs.existsSync("./src/participants.json")) {
	fs.writeFileSync("./src/participants.json", JSON.stringify([]));
}

function updateParticipantsJson() {
	fs.writeFileSync("./src/participants.json", JSON.stringify(participants, null, 2));
}

function updateMessagesJson() {
	fs.writeFileSync("./src/messages.json", JSON.stringify(messages, null, 2));
}

let participants = JSON.parse(fs.readFileSync("./src/participants.json"));
let messages = JSON.parse(fs.readFileSync("./src/messages.json"));

// remove inactive users
const interval = setInterval(clearInactiveParticipants, 15000);

// routes
server.post("/participants", (req, res) => {
	const newParticipant = req.body;
    console.log(newParticipant.name);
	newParticipant.name = stripHtmlAndTrim(newParticipant.name);
	if (validWithJOI(validateUserSchema, newParticipant) || availableUsername(newParticipant)) {
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

	res.sendStatus(200);
	updateParticipantsJson();
	console.log("New participant add...");
});

server.get("/participants", (req, res) => {
	res.send(participants);
	console.log("Send participants list...");
});

server.get("/messages", (req, res) => {
	const limitMessages = req.query.limit || messages.length;
	const thisUser = stripHtmlAndTrim(req.headers.user);
	const messagesFiltered = userMessagesFilter(thisUser).slice(-limitMessages);

	res.status(200).send(messagesFiltered);
	console.log("Send messages to front...");
});

server.post("/messages", (req, res) => {
	const newMessage = sanitizeMessage(req.body);
	newMessage.from = stripHtmlAndTrim(req.headers.user);

	if (!validNewMessage(newMessage)) {
		res.sendStatus(400);
		return;
	}

	newMessage.time = dayjs(Date.now()).format("HH:mm:ss");
	messages.push(newMessage);

	res.sendStatus(200);
	updateMessagesJson();
	console.log("New message received");
});

server.post("/status", (req, res) => {
	const thisUser = stripHtmlAndTrim(req.headers.user);
	const thisParticipant = participants.find((p) => p.name === thisUser);
	const index = participants.indexOf(thisParticipant);

	if (!thisParticipant) {
		res.sendStatus(400);
		return;
	}

	thisParticipant.lastStatus = Date.now();
	participants.splice(index, 1, thisParticipant);

	res.sendStatus(200);
	updateParticipantsJson();
	console.log("Participant timestamp att");
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
	message.to = stripHtmlAndTrim(message.to);
	message.from = stripHtmlAndTrim(message.to);
	message.type = stripHtmlAndTrim(message.type);
	message.text = stripHtmlAndTrim(message.text);
	return message;
}

// validate with Joi library schemas
const validateUserSchema = Joi.object({
	name: Joi.string().alphanum().min(3).required(),
});

const validateNewMessageSchema = Joi.object({
	to: Joi.string().alphanum().required(),
	from: Joi.string().alphanum().required(),
	text: Joi.string().alphanum().min(1).required(),
	type: Joi.string().alphanum().required(),
});

function validNewMessage(message) {
	if (validWithJOI(validateNewMessageSchema, message)) {
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

function stripHtmlAndTrim(text) {
	return stripHtml(text).result.trim();
}

function validWithJOI(schema, value) {
	return !!schema.validate(value).error;
}

function availableUsername(participant) {
	return participants.find((p) => p.name === participant.name);
}
