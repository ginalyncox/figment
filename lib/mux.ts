import Mux from "@mux/mux-node";
import { requireEnv } from "./config";

// Mux stores and streams the videos. Playback is "signed": a video only plays
// with a short-lived token that this server hands out after checking access.

let client: Mux | null = null;

export function mux(): Mux {
  if (!client) {
    client = new Mux({
      tokenId: requireEnv("MUX_TOKEN_ID"),
      tokenSecret: requireEnv("MUX_TOKEN_SECRET"),
      webhookSecret: process.env.MUX_WEBHOOK_SECRET,
      jwtSigningKey: process.env.MUX_SIGNING_KEY_ID,
      jwtPrivateKey: process.env.MUX_SIGNING_PRIVATE_KEY,
    });
  }
  return client;
}

export async function playbackTokens(playbackId: string) {
  const [playback, thumbnail] = await Promise.all([
    mux().jwt.signPlaybackId(playbackId, { type: "video", expiration: "6h" }),
    mux().jwt.signPlaybackId(playbackId, { type: "thumbnail", expiration: "6h" }),
  ]);
  return { playback, thumbnail };
}
