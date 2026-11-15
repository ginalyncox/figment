"use client";

import MuxPlayer from "@mux/mux-player-react";
import { useEffect, useRef } from "react";

const BEAT_SECONDS = 15;

/**
 * Plays one video. While it is actually playing, it tells the server every
 * 15 seconds. The server uses those "heartbeats" (from paying subscribers only)
 * to work out each creator's share of the month's subscription money.
 */
export default function Player(props: {
  videoId: string;
  playbackId: string;
  playbackToken: string;
  thumbnailToken: string;
  title: string;
  countWatchTime: boolean;
}) {
  const playing = useRef(false);

  useEffect(() => {
    if (!props.countWatchTime) return;
    const timer = setInterval(() => {
      if (!playing.current || document.visibilityState !== "visible") return;
      fetch("/api/watch/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId: props.videoId }),
        keepalive: true,
      }).catch(() => {});
    }, BEAT_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [props.videoId, props.countWatchTime]);

  return (
    <div className="player">
      <MuxPlayer
        playbackId={props.playbackId}
        tokens={{ playback: props.playbackToken, thumbnail: props.thumbnailToken }}
        metadata={{ video_id: props.videoId, video_title: props.title }}
        streamType="on-demand"
        accentColor="#ffcf5c"
        style={{ width: "100%", height: "100%" }}
        onPlaying={() => { playing.current = true; }}
        onPause={() => { playing.current = false; }}
        onEnded={() => { playing.current = false; }}
        onWaiting={() => { playing.current = false; }}
      />
    </div>
  );
}
