import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import * as nip19 from "nostr-tools/nip19";

// Generate Noster private and public keys
const sk = generateSecretKey(); // Generate a new private key
let nsec = nip19.nsecEncode(sk); // Encode the private key to nsec

const pk = getPublicKey(sk); // Derive the public key
let npub = nip19.npubEncode(pk); // Encode the public key to npub

console.log("Private Key (nsec):", nsec);
console.log("Public Key (npub):", npub);
