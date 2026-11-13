import { baseApi, unwrap } from "./baseApi";
import type { PageResponse } from "./types";

/// A single API slice for all contact messages, with a query for the paginated list and a mutation to update a message's status. It uses the same `baseApi` as the other slices, so it shares the same auth headers and error handling.
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
