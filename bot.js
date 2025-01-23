import { finalizeEvent, verifyEvent, getPublicKey } from "nostr-tools/pure";
import { SimplePool } from "nostr-tools/pool";

import schedule from "node-schedule";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { WebSocket } from "ws";
import dotenv from "dotenv";
import * as nip19 from "nostr-tools/nip19";
import http from "http";
const PORT = process.env.PORT || 8080;

dotenv.config();

console.log("Starting Nostr bot...");

// Use a third party implementation of WebSocket
useWebSocketImplementation(WebSocket);

const kDebug = process.env.DEBUG === "true";

// Bot keys
const pkNsec = process.env.PRIVATE_KEY_NSEC;
const { type, data: pk } = nip19.decode(pkNsec);
const publicKey = getPublicKey(pk);
const publicKeyNpub = nip19.npubEncode(publicKey);

console.log(`Bot npub: ${publicKeyNpub}`);
console.log(`Bot pubkey (hex): ${publicKey}`);

// Author npub
const authorNpub = process.env.AUTHOR_NPUB;

// Obter relays da variável de ambiente e converter em array
const relayString = process.env.RELAYS;
const relays = relayString
  ? relayString.split(",")
  : [
      "wss://relay.damus.io",
      "wss://relay.snort.social",
      "wss://nos.lol",
      "wss://eden.nostr.land",
    ];

// Array para armazenar as impressões (posts)
const impressions = [];

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
    let pool;
    try {
      // Nostr relay pool
      pool = new SimplePool();
      await Promise.any(pool.publish(relays, signedEvent));
      console.log(`Posted (to at least one relay): ${message}`);

      // Adicionar a impressão ao array
      impressions.push({
        timestamp: new Date(),
        message: message,
      });
    } catch (error) {
      console.error("Error publishing message:", error);
    } finally {
      // Close the pool
      if (pool) {
        pool.close(relays);
        pool.destroy();
      }
    }
  } else {
    console.log("Event is not good");
  }
};

// Schedule tasks
let lastPostDate = null;

// Check if LAST_POST environment variable is set
const lastPostEnv = process.env.LAST_POST;
if (lastPostEnv) {
  lastPostDate = new Date(lastPostEnv);
  console.log(`Using LAST_POST date: ${lastPostDate}`);
} else {
  console.log("LAST_POST not set");
}

const isWeekend = (date) => {
  return date.getDay() === 0 || date.getDay() === 6;
};

const postAtStartUp = process.env.POST_AT_START_UP === "true";

// Post the first message immediately, only if LAST_POST is not set
if (!lastPostEnv && postAtStartUp) {
  const today = new Date();
  postMessage(isWeekend(today) ? "gfy fiatjaf" : "GM fiatjaf");
  lastPostDate = today;
}

const rule = new schedule.RecurrenceRule();
rule.minute = 0; // Check every hour

// Post the message if 2 days have passed since the last post
schedule.scheduleJob(rule, () => {
  const today = new Date();
  // Use lastPostDate if available, otherwise use current date
  const referenceDate = lastPostDate || today;
  // Calculate the difference in milliseconds between today and the reference date
  const diffInMilliseconds = Math.abs(today - referenceDate);
  // Convert 2 days to milliseconds
  const twoDaysInMilliseconds = 2 * 24 * 60 * 60 * 1000;

  console.log(
    `Time passed since last post: ${formatTimePassed(diffInMilliseconds)}`
  );
  if (diffInMilliseconds >= twoDaysInMilliseconds) {
    postMessage(isWeekend(today) ? "gfy fiatjaf" : "GM fiatjaf");
    lastPostDate = today;
    console.log(`New last post date: ${new Date().toString()}`);
  }
});

if (kDebug) {
  console.log("Debug mode is enabled");
  // Schedule a task to execute every 30 seconds, for debugging purposes
  const thirtySecondRule = new schedule.RecurrenceRule();
  thirtySecondRule.second = new schedule.Range(0, 59, 30);

  schedule.scheduleJob(thirtySecondRule, () => {
    postMessage("Test");
  });
}

// Function to format the execution time
function formatTimePassed(timeInMilliseconds) {
  const days = Math.floor(timeInMilliseconds / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (timeInMilliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor(
    (timeInMilliseconds % (1000 * 60 * 60)) / (1000 * 60)
  );
  const seconds = Math.floor((timeInMilliseconds % (1000 * 60)) / 1000);

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Start time of the bot
const startTime = new Date();

// Create a simple HTTP server
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.write("<h1>Bot is running!</h1>");
    res.write(
      `<p>Author: <a href="https://primal.net/p/${authorNpub}" target="_blank">${authorNpub}</a></p>`
    );
    res.write(
      `<p>Bot: <a href="https://primal.net/p/${publicKeyNpub}" target="_blank">${publicKeyNpub}</a></p>`
    );
    res.write(`<p>Uptime: ${formatTimePassed(new Date() - startTime)}</p>`);
    res.write("<h2>Relays:</h2>");
    res.write("<ul>");
    relays.forEach((relay) => {
      res.write(`<li>${relay}</li>`);
    });
    res.write("</ul>");
    res.write("<h2>Impressions:</h2>");
    res.write("<ul>");
    impressions.forEach((impression) => {
      res.write(
        `<li>${impression.timestamp.toLocaleString()} - ${
          impression.message
        }</li>`
      );
    });
    res.write("</ul>");

    res.end();
  })
  .listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
