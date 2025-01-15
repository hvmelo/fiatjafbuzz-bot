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

if (kDebug) {
  // Schedule a task to execute every 30 seconds, for debugging purposes
  const thirtySecondRule = new schedule.RecurrenceRule();
  thirtySecondRule.second = new schedule.Range(0, 59, 30);

  schedule.scheduleJob(thirtySecondRule, () => {
    postMessage("Test");
  });
}

// Tempo de início do bot
const startTime = new Date();

// Função para formatar o tempo de execução
function formatUptime(startTime) {
  const now = new Date();
  const diff = now - startTime;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Create a simple HTTP server
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.write("<h1>Bot is running!</h1>");

    // Adicionar link para o npub do autor
    res.write(
      `<p>Author: <a href="https://primal.net/p/${authorNpub}" target="_blank">${authorNpub}</a></p>`
    );

    // Adicionar link para o npub do bot
    res.write(
      `<p>Bot: <a href="https://primal.net/p/${publicKeyNpub}" target="_blank">${publicKeyNpub}</a></p>`
    );

    // Adicionar tempo de execução
    res.write(`<p>Uptime: ${formatUptime(startTime)}</p>`);

    // Adicionar lista de relays
    res.write("<h2>Relays:</h2>");
    res.write("<ul>");
    relays.forEach((relay) => {
      res.write(`<li>${relay}</li>`);
    });
    res.write("</ul>");

    // Adicionar impressões
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
