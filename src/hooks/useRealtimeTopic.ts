"use client";

import { useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import { getAccessToken, isAuthenticated } from "@/lib/authStorage";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "wss://api.590stcafe.shop/ws";

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
        }
      });
    };

    client.activate();
    return () => {
      client.deactivate();
    };
  }, [topic]);
}
