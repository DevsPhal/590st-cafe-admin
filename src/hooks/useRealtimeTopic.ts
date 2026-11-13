"use client";

import { useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import { getAccessToken, isAuthenticated } from "@/lib/authStorage";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "wss://api.590stcafe.shop/ws";

// A hook that subscribes to a websocket topic and calls the provided callback whenever a new message is received. The message is parsed as JSON and passed to the callback. The subscription is only active while the user is authenticated, and is cleaned up when the component unmounts or the topic changes.
export function useRealtimeTopic<T>(
  topic: string,
  onMessage: (message: T) => void,
) {
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!isAuthenticated()) return;

    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: { Authorization: `Bearer ${getAccessToken()}` },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    });

    client.onConnect = () => {
      client.subscribe(topic, (frame) => {
        try {
          const message = JSON.parse(frame.body) as T;
          onMessageRef.current(message);
        } catch {
          // Malformed push — ignore rather than take the subscription down.
        }
      });
    };

    client.activate();
    return () => {
      client.deactivate();
    };
  }, [topic]);
}
