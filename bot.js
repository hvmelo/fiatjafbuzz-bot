import { finalizeEvent, verifyEvent, getPublicKey } from "nostr-tools/pure";
import { Relay } from "nostr-tools/relay";
import schedule from "node-schedule";
import { useWebSocketImplementation } from "nostr-tools/relay";
import { WebSocket } from "ws";
import dotenv from "dotenv";
import * as nip19 from "nostr-tools/nip19";
import http from "http";
const PORT = process.env.PORT || 8080;

dotenv.config();

// Use a third party implementation of WebSocket
useWebSocketImplementation(WebSocket);

// Bot keys
const pkNsec = process.env.PRIVATE_KEY_NSEC;
const { type, data: pk } = nip19.decode(pkNsec);
const publicKey = getPublicKey(pk);
const publicKeyNpub = nip19.npubEncode(publicKey);

console.log(`Bot npub: ${publicKeyNpub}`);
console.log(`Bot pubkey (hex): ${publicKey}`);

// Connecting to a Nostr relay
const relay = await Relay.connect("wss://relay.damus.io");
console.log(`connected to ${relay.url}`);

// Function to post a message
const postMessage = async (message) => {
  const event = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: message,
  };

  // this assigns the pubkey, calculates the event id and signs the event in a single step
  const signedEvent = finalizeEvent(event, pk);

  let isGood = verifyEvent(signedEvent);

  if (isGood) {
    try {
      await relay.publish(signedEvent);
      console.log(`Posted: ${message}`);
    } catch (error) {
      console.error("Error publishing message:", error);
    }
  } else {
    console.log("Event is not good");
  }
};

// Schedule tasks
let lastPostDate = null;

const rule = new schedule.RecurrenceRule();
rule.hour = 12;
rule.minute = 0;

const isWeekend = (date) => {
  return date.getDay() === 0 || date.getDay() === 6;
};

// Post the first message immediately
const today = new Date();
postMessage(isWeekend(today) ? "gfy fiatjaf" : "GM fiatjaf");
lastPostDate = today;

// Post the message every 2 days from the last post
schedule.scheduleJob(rule, () => {
  const today = new Date();
  if (today.getDate() - lastPostDate.getDate() >= 2) {
    postMessage(isWeekend(today) ? "gfy fiatjaf" : "GM fiatjaf");
    lastPostDate = today;
  }
});

// Create a simple HTTP server
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is running!\n");
  })
  .listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
