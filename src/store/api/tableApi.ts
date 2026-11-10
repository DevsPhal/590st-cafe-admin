import { baseApi, unwrap } from "./baseApi";
import type {
  CheckInReservationRequest,
  CloseReservationRequest,
  CreateTableRequest,
  OrderResponse,
  PageQuery,
  PageResponse,
  ReservationRequest,
  ReservationResponse,
  TableActivityResponse,
  TableAuditLogResponse,
  TableResponse,
  TableStatus,
  UpdateTableRequest,
  UpdateTableStatusRequest,
  UUID,
} from "./types";

/** Admins and baristas share the reservation endpoints under their own API area. */
export type StaffScope = "admin" | "barista";

// A table change can complete a seated booking, and a booking change can hold or free a table.
const FLOOR_TAGS = [
  { type: "Table" as const, id: "LIST" },
  { type: "Reservation" as const, id: "LIST" },
  { type: "Table" as const, id: "HISTORY" },
];

export const tableApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listTables: builder.query<PageResponse<TableResponse>, (PageQuery & { status?: TableStatus }) | void>({
      query: (params) => ({ url: "/api/admin/tables", params: params ?? undefined }),
      transformResponse: unwrap<PageResponse<TableResponse>>,
      providesTags: (result) =>
        result
          ? [
              ...result.content.map(({ id }) => ({ type: "Table" as const, id })),
              { type: "Table" as const, id: "LIST" },
            ]
          : [{ type: "Table" as const, id: "LIST" }],
    }),

    // Every table with its open orders, staff calls and bookings in one request (admin and barista areas).
    listTableActivity: builder.query<TableActivityResponse[], StaffScope>({
      query: (scope) => (scope === "admin" ? "/api/admin/tables/activity" : "/api/barista/tables"),
      transformResponse: unwrap<TableActivityResponse[]>,
      providesTags: [{ type: "Table", id: "LIST" }, { type: "Order", id: "LIST" }, { type: "Reservation", id: "LIST" }],
    }),

    updateBaristaTableStatus: builder.mutation<TableResponse, { id: UUID; body: UpdateTableStatusRequest }>({
      query: ({ id, body }) => ({ url: `/api/barista/tables/${id}/status`, method: "PATCH", body }),
      transformResponse: unwrap<TableResponse>,
      invalidatesTags: (_r, _e, { id }) => [{ type: "Table", id }, ...FLOOR_TAGS],
    }),

    // Public list (no admin role needed), so baristas can pick a table in POS.
    listPublicTables: builder.query<TableResponse[], void>({
      query: () => "/api/tables",
      transformResponse: unwrap<TableResponse[]>,
      providesTags: [{ type: "Table", id: "LIST" }],
    }),

    getMenuLink: builder.query<{ url: string }, void>({
      query: () => "/api/admin/tables/menu-link",
      transformResponse: unwrap<{ url: string }>,
    }),

    listTableOrders: builder.query<OrderResponse[], UUID>({
      query: (id) => `/api/admin/tables/${id}/orders`,
      transformResponse: unwrap<OrderResponse[]>,
      providesTags: (_r, _e, id) => [{ type: "Table", id: `ORDERS-${id}` }, { type: "Order", id: "LIST" }],
    }),

    // Admin only: every status change on the table, who made it, and override reasons.
    getTableHistory: builder.query<TableAuditLogResponse[], UUID>({
      query: (id) => `/api/admin/tables/${id}/history`,
      transformResponse: unwrap<TableAuditLogResponse[]>,
      providesTags: [{ type: "Table", id: "HISTORY" }],
    }),

    createTable: builder.mutation<TableResponse, CreateTableRequest>({
      query: (body) => ({ url: "/api/admin/tables", method: "POST", body }),
      transformResponse: unwrap<TableResponse>,
      invalidatesTags: [{ type: "Table", id: "LIST" }],
    }),

    updateTable: builder.mutation<TableResponse, { id: UUID; body: UpdateTableRequest }>({
      query: ({ id, body }) => ({ url: `/api/admin/tables/${id}`, method: "PATCH", body }),
      transformResponse: unwrap<TableResponse>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Table", id },
        { type: "Table", id: "LIST" },
      ],
    }),

    updateTableStatus: builder.mutation<TableResponse, { id: UUID; body: UpdateTableStatusRequest }>({
      query: ({ id, body }) => ({ url: `/api/admin/tables/${id}/status`, method: "PATCH", body }),
      transformResponse: unwrap<TableResponse>,
      invalidatesTags: (_r, _e, { id }) => [{ type: "Table", id }, ...FLOOR_TAGS],
    }),

    deleteTable: builder.mutation<void, UUID>({
      query: (id) => ({ url: `/api/admin/tables/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Table", id },
        { type: "Table", id: "LIST" },
      ],
    }),

    // Bookings starting on the given day (yyyy-MM-dd, shop time); today when left out.
    listReservations: builder.query<ReservationResponse[], { scope: StaffScope; date?: string }>({
      query: ({ scope, date }) => ({ url: `/api/${scope}/reservations`, params: date ? { date } : undefined }),
      transformResponse: unwrap<ReservationResponse[]>,
      providesTags: [{ type: "Reservation", id: "LIST" }],
    }),

    createReservation: builder.mutation<ReservationResponse, { scope: StaffScope; body: ReservationRequest }>({
      query: ({ scope, body }) => ({ url: `/api/${scope}/reservations`, method: "POST", body }),
      transformResponse: unwrap<ReservationResponse>,
      invalidatesTags: FLOOR_TAGS,
    }),

    updateReservation: builder.mutation<ReservationResponse, { scope: StaffScope; id: UUID; body: ReservationRequest }>({
      query: ({ scope, id, body }) => ({ url: `/api/${scope}/reservations/${id}`, method: "PUT", body }),
      transformResponse: unwrap<ReservationResponse>,
      invalidatesTags: FLOOR_TAGS,
    }),

    checkInReservation: builder.mutation<
      ReservationResponse,
      { scope: StaffScope; id: UUID; body?: CheckInReservationRequest }
    >({
      query: ({ scope, id, body }) => ({ url: `/api/${scope}/reservations/${id}/check-in`, method: "POST", body: body ?? {} }),
      transformResponse: unwrap<ReservationResponse>,
      invalidatesTags: FLOOR_TAGS,
    }),

    cancelReservation: builder.mutation<ReservationResponse, { scope: StaffScope; id: UUID; body?: CloseReservationRequest }>({
      query: ({ scope, id, body }) => ({ url: `/api/${scope}/reservations/${id}/cancel`, method: "POST", body: body ?? {} }),
      transformResponse: unwrap<ReservationResponse>,
      invalidatesTags: FLOOR_TAGS,
    }),

    markReservationNoShow: builder.mutation<
      ReservationResponse,
      { scope: StaffScope; id: UUID; body?: CloseReservationRequest }
    >({
      query: ({ scope, id, body }) => ({ url: `/api/${scope}/reservations/${id}/no-show`, method: "POST", body: body ?? {} }),
      transformResponse: unwrap<ReservationResponse>,
      invalidatesTags: FLOOR_TAGS,
    }),
  }),
});

export const {
  useListTablesQuery,
  useListTableActivityQuery,
  useGetMenuLinkQuery,
  useListPublicTablesQuery,
  useUpdateBaristaTableStatusMutation,
  useListTableOrdersQuery,
  useGetTableHistoryQuery,
  useCreateTableMutation,
  useUpdateTableMutation,
  useUpdateTableStatusMutation,
  useDeleteTableMutation,
  useListReservationsQuery,
  useCreateReservationMutation,
  useUpdateReservationMutation,
  useCheckInReservationMutation,
  useCancelReservationMutation,
  useMarkReservationNoShowMutation,
} = tableApi;
