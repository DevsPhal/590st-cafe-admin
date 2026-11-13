"use client";

import { useSyncExternalStore } from "react";
import { translate } from "@/contexts/translate";
import { SHOP_LOCATION } from "@/constants/shop";
import { humanise, titleCase } from "@/lib/utils";
import type { ContactMessage, ContactTopic } from "@/store/api/contactApi";

const TOPIC_LABELS: Record<ContactTopic, [key: string, fallback: string]> = {
  GENERAL_INQUIRY: ["notifications.contact.topics.general_inquiry", "General inquiry"],
  CATERING_EVENTS: ["notifications.contact.topics.catering_events", "Catering & events"],
  FEEDBACK_SUGGESTIONS: ["notifications.contact.topics.feedback_suggestions", "Feedback & suggestions"],
  PARTNERSHIP: ["notifications.contact.topics.partnership", "Partnership"],
  ORDER_SUPPORT: ["notifications.contact.topics.order_support", "Order support"],
};

export function contactTopicLabel(topic: ContactTopic): string {
  const label = TOPIC_LABELS[topic];
  return label ? translate(label[0], label[1]) : humanise(topic);
}

// The message squeezed onto one line, for toasts and the alerts panel.
export function messagePreview(text: string, max = 90): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

export const contactMessageToastId = (id: string) => `feedback-${id}`;
export const contactMessageAnchor = (id: string) => `contact-message-${id}`;

// Opens the admin's mail app with the subject filled in and the customer's message quoted below the reply.
export function replyMailto(message: ContactMessage): string {
  const firstName = titleCase(message.fullName.trim().split(/\s+/)[0] ?? "");
  const quoted = message.message.length > 600 ? `${message.message.slice(0, 600).trimEnd()}…` : message.message;
  const subject = `Re: ${contactTopicLabel(message.topic)} — ${SHOP_LOCATION.name}`;
  const body = [
    `Hi ${firstName},`,
    "",
    "",
    "",
    `${titleCase(message.fullName)} wrote:`,
    ...quoted.split("\n").map((line) => `> ${line}`),
  ].join("\n");
  return `mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Which message the inbox should scroll to next. Toasts and the alerts panel set it right before they navigate.
let focusedId: string | null = null;
const focusListeners = new Set<() => void>();

function publishFocus(next: string | null) {
  if (focusedId === next) return;
  focusedId = next;
  focusListeners.forEach((listener) => listener());
}

export function focusContactMessage(id: string) {
  publishFocus(id);
}

export function clearContactMessageFocus() {
  publishFocus(null);
}

function subscribeFocus(listener: () => void) {
  focusListeners.add(listener);
  return () => {
    focusListeners.delete(listener);
  };
}

export function useContactMessageFocus(): string | null {
  return useSyncExternalStore(subscribeFocus, () => focusedId, () => null);
}
