import { baseApi, unwrap } from "./baseApi";
import type { PageResponse } from "./types";

export type ContactTopic =
  | "GENERAL_INQUIRY"
  | "CATERING_EVENTS"
  | "FEEDBACK_SUGGESTIONS"
  | "PARTNERSHIP"
  | "ORDER_SUPPORT";

export interface ContactMessage {
  id: string;
  customerId: string;
  customerName: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  topic: ContactTopic;
  message: string;
  status: "NEW" | "RESOLVED";
  createdAt: string;
  updatedAt: string;
}

// The newest unanswered messages: the alerts panel lists these and the bell/inbox count their total.
// Kept as one constant so every caller shares the same cached request.
export const NEW_MESSAGES_PREVIEW = { status: "NEW", page: 1, size: 5 } as const;

export const contactApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listContactMessages: builder.query<
      PageResponse<ContactMessage>,
      { page: number; size: number; status?: ContactMessage["status"] }
    >({
      query: (params) => ({ url: "/api/admin/feedback", params }),
      transformResponse: unwrap<PageResponse<ContactMessage>>,
      providesTags: ["ContactMessage"],
    }),
    updateContactStatus: builder.mutation<
      ContactMessage,
      { id: string; status: ContactMessage["status"] }
    >({
      query: ({ id, status }) => ({
        url: `/api/admin/feedback/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      transformResponse: unwrap<ContactMessage>,
      invalidatesTags: ["ContactMessage"],
    }),
  }),
});

export const { useListContactMessagesQuery, useUpdateContactStatusMutation } =
  contactApi;
