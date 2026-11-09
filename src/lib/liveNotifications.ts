import type { NotifyOptions } from "@/components/common/AppToast";
import { staffCallReasonLabel } from "@/lib/staffCall";
import { fulfillmentLabel, titleCase } from "@/lib/utils";
import type { OrderResponse, OrderUpdateMessage, StaffCallMessage } from "@/store/api/types";
import type { ContactMessage } from "@/store/api/contactApi";
import { translate } from "@/contexts/translate";
import { contactMessageToastId, contactTopicLabel, messagePreview } from "@/lib/contactMessages";

type Notice = Omit<NotifyOptions, "icon">;

const shortId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;
const customerOf = (name: string | null | undefined) => (name ? titleCase(name) : translate("notices.a_customer", "A customer"));
const money = (value: number | string) => `$${Number(value).toFixed(2)}`;

function orderSummary(order: OrderResponse): string {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const method =
    order.fulfillmentMethod === "DELIVERY" ? " · Delivery"
    : order.fulfillmentMethod === "DINE_IN" || order.orderType === "TAKE_AWAY" ? ` · ${fulfillmentLabel(order)}`
    : "";
  const items = count === 1 ? translate("notices.items_one", "{count} item", { count }) : translate("notices.items_other", "{count} items", { count });
  return `${shortId(order.id)} · ${items} · ${money(order.totalAmount)}${method}`;
}

export function orderNotice(
  { action, order }: OrderUpdateMessage,
  links: { orders: string; deliveryFee: string }
): Notice | null {
  if (order.customerId == null) return null;
  const id = `order-${action}-${order.id}`;
  const customer = customerOf(order.customerName);

  switch (action) {
    case "CREATED":
      return { id, title: translate("notices.new_order", "New order from {customer}", { customer }), description: orderSummary(order), href: links.orders };
    case "LOCATION_PINNED":
      return {
        id,
        title: translate("notices.fee_needed", "Delivery fee needed"),
        description: translate("notices.location_pinned", "{customer} pinned a location for {order}.", { customer, order: shortId(order.id) }),
        href: links.deliveryFee,
        actionLabel: translate("fulfillment.set_fee", "Set fee"),
      };
    case "BAKONG_CONFIRMED":
    case "BAKONG_BY_RECEIPT":
      return {
        id,
        tone: "success",
        title: translate("notices.qr_received", "QR payment received"),
        description: translate("notices.ready_to_prepare", "{order} · {amount} — ready to prepare.", { order: shortId(order.id), amount: money(order.totalAmount) }),
        href: links.orders,
      };
    case "CASH_SELECTED":
      return {
        id,
        title: translate("notices.pay_cash", "{customer} will pay cash", { customer }),
        description: translate("notices.can_start", "{order} can be started now.", { order: shortId(order.id) }),
        href: links.orders,
      };
    default:
      return null;
  }
}

export const staffCallToastId = (orderId: string) => `staff-call-${orderId}`;

export function staffCallNotice(message: StaffCallMessage, href: string): Notice | null {
  if (message.type !== "CALLED") return null;
  const reason = staffCallReasonLabel(message.reason);
  return {
    id: staffCallToastId(message.orderId),
    tone: "urgent",
    title: translate("notices.calling_staff", "{customer} is calling staff", { customer: customerOf(message.customerName) }),
    description: message.note ? `${reason} — “${message.note}”` : `${reason} · ${shortId(message.orderId)}`,
    href,
    actionLabel: translate("alerts.respond", "Respond"),
    duration: 12000,
  };
}

export function lowStockNotice(total: number, href: string): Notice {
  return {
    id: `low-stock-${total}`,
    tone: "urgent",
    title: translate("notices.low_stock", "Low stock alert"),
    description: total === 1
      ? translate("notices.running_low_one", "{count} item is running low.", { count: total })
      : translate("notices.running_low_other", "{count} items are running low.", { count: total }),
    href,
  };
}

// `message` is missing only when its details couldn't be loaded in time; the notice then stays generic.
export function newMessageNotice(id: string, message: ContactMessage | undefined, href: string): Notice {
  return {
    id: contactMessageToastId(id),
    title: message
      ? translate("notices.new_message_from", "New message from {customer}", { customer: customerOf(message.fullName) })
      : translate("notices.new_message", "New customer message"),
    description: message
      ? `${contactTopicLabel(message.topic)} · “${messagePreview(message.message)}”`
      : translate("notices.new_message_description", "Someone sent a message from the contact page."),
    href,
    actionLabel: translate("notices.read_message", "Read message"),
    duration: 12000,
  };
}
