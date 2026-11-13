import { baseApi, unwrap } from "./baseApi";
import type {
  BakongQrResponse,
  CashPaymentRequest,
  CreateOrderRequest,
  Currency,
  DeliveryFeeRequest,
  OrderResponse,
  OrderStatus,
  PageQuery,
  PageResponse,
  StaffCallResponse,
  UUID,
} from "./types";

/// Barista-facing order API, for the POS and queue board. The admin-facing orderApi is in src/store/api/orderApi.ts.

interface BaristaOrderListQuery extends PageQuery {
  status?: OrderStatus;
}

const QUEUE_TAGS = [
  { type: "Order" as const, id: "BARISTA_LIST" },
  { type: "Order" as const, id: "BARISTA_ALL" },
  { type: "Order" as const, id: "AWAITING_PICKUP" },
  { type: "Order" as const, id: "AWAITING_BAKONG" },
  { type: "Order" as const, id: "DELIVERY_BOARD" },
  { type: "Order" as const, id: "LIST" },
  { type: "Report" as const, id: "DAILY" },
  { type: "Finance" as const, id: "SUMMARY" },
];

export const baristaOrderApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /** POS checkout — creates a PENDING order that then needs a payment call. */
    createBaristaOrder: builder.mutation<OrderResponse, CreateOrderRequest>({
      query: (body) => ({ url: "/api/barista/orders", method: "POST", body }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: [...QUEUE_TAGS, { type: "Inventory", id: "LIST" }],
    }),

    /** Orders rung up by the signed-in barista. */
    listBaristaOrders: builder.query<
      PageResponse<OrderResponse>,
      BaristaOrderListQuery | void
    >({
      query: (params) => ({
        url: "/api/barista/orders",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<PageResponse<OrderResponse>>,
      providesTags: [{ type: "Order", id: "BARISTA_LIST" }],
    }),

    /** Every order in the shop — what the barista queue board shows. */
    listAllBaristaOrders: builder.query<
      PageResponse<OrderResponse>,
      BaristaOrderListQuery | void
    >({
      query: (params) => ({
        url: "/api/barista/orders/all",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<PageResponse<OrderResponse>>,
      providesTags: (result) =>
        result
          ? [
              ...result.content.map(({ id }) => ({
                type: "Order" as const,
                id,
              })),
              { type: "Order" as const, id: "BARISTA_ALL" },
            ]
          : [{ type: "Order" as const, id: "BARISTA_ALL" }],
    }),

    getBaristaOrder: builder.query<OrderResponse, UUID>({
      query: (id) => `/api/barista/orders/all/${id}`,
      transformResponse: unwrap<OrderResponse>,
      providesTags: (_r, _e, id) => [{ type: "Order", id }],
    }),

    payOrderCash: builder.mutation<
      OrderResponse,
      { id: UUID; body: CashPaymentRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/barista/orders/${id}/pay/cash`,
        method: "POST",
        body,
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        "Inventory",
        "StockMovement",
        "Product",
        ...QUEUE_TAGS,
      ],
    }),

    generateBakongQr: builder.mutation<
      BakongQrResponse,
      { id: UUID; currency?: Currency }
    >({
      query: ({ id, currency }) => ({
        url: `/api/barista/orders/${id}/pay/bakong/qr`,
        method: "POST",
        params: currency ? { currency } : undefined,
      }),
      transformResponse: unwrap<BakongQrResponse>,
    }),

    confirmBakongPayment: builder.mutation<OrderResponse, UUID>({
      query: (id) => ({
        url: `/api/barista/orders/${id}/pay/bakong/confirm`,
        method: "POST",
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        "Inventory",
        "StockMovement",
        "Product",
        ...QUEUE_TAGS,
      ],
    }),

    /**
     * Takes the cash for a customer's online order that chose "pay cash" (pickup at the counter,
     * or on delivery). Unlike `payOrderCash`, which only reaches walk-ins this barista rang up,
     * this works on any order — it is how a barista serves online orders.
     */
    collectBaristaCash: builder.mutation<
      OrderResponse,
      { id: UUID; body: CashPaymentRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/barista/orders/${id}/collect-cash`,
        method: "POST",
        body,
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        "Inventory",
        "StockMovement",
        "Product",
        ...QUEUE_TAGS,
      ],
    }),

    /**
     * Checks Bakong for a customer's QR transfer on any order and records it once it has landed.
     * `confirmBakongPayment` is the own-walk-in-only variant; the queue uses this one.
     */
    acceptBaristaBakong: builder.mutation<OrderResponse, UUID>({
      query: (id) => ({
        url: `/api/barista/orders/${id}/accept-bakong`,
        method: "POST",
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        "Inventory",
        "StockMovement",
        "Product",
        ...QUEUE_TAGS,
      ],
    }),

    /**
     * Only an unpaid order can be cancelled; the API rejects it once payment has cleared. A
     * barista can only cancel walk-ins they rang up themselves — a customer's order is theirs.
     */
    cancelBaristaOrder: builder.mutation<OrderResponse, UUID>({
      query: (id) => ({
        url: `/api/barista/orders/${id}/cancel`,
        method: "POST",
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "Inventory", id: "LIST" },
        ...QUEUE_TAGS,
      ],
    }),

    /** Sets or revises the delivery fee on a pending delivery order, once staff know the distance. */
    setBaristaOrderDeliveryFee: builder.mutation<
      OrderResponse,
      { id: UUID; body: DeliveryFeeRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/barista/orders/${id}/delivery-fee`,
        method: "POST",
        body,
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        ...QUEUE_TAGS,
      ],
    }),

    /** Every order currently out with a courier, oldest dispatch first. */
    listBaristaDeliveryBoard: builder.query<
      PageResponse<OrderResponse>,
      PageQuery | void
    >({
      query: (params) => ({
        url: "/api/barista/orders/delivery-board",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<PageResponse<OrderResponse>>,
      providesTags: [{ type: "Order", id: "DELIVERY_BOARD" }],
    }),

    /**
     * Moving a paid order along the queue. Neither touches money or stock — that all happened
     * at payment — so they only need to invalidate the board, not the finance tags.
     */
    startPreparingBaristaOrder: builder.mutation<OrderResponse, UUID>({
      query: (id) => ({
        url: `/api/barista/orders/${id}/prepare`,
        method: "POST",
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        ...QUEUE_TAGS,
      ],
    }),

    dispatchBaristaOrder: builder.mutation<OrderResponse, UUID>({
      query: (id) => ({
        url: `/api/barista/orders/${id}/dispatch`,
        method: "POST",
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        ...QUEUE_TAGS,
      ],
    }),

    markDeliveredBaristaOrder: builder.mutation<OrderResponse, UUID>({
      query: (id) => ({
        url: `/api/barista/orders/${id}/deliver`,
        method: "POST",
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        ...QUEUE_TAGS,
      ],
    }),

    completeBaristaOrder: builder.mutation<OrderResponse, UUID>({
      query: (id) => ({
        url: `/api/barista/orders/${id}/complete`,
        method: "POST",
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        ...QUEUE_TAGS,
      ],
    }),

    // A PDF, not the usual ApiResponse<T> JSON envelope — see orderApi's admin equivalent for
    // why the responseHandler branches on response.ok.
    downloadBaristaOrderInvoice: builder.mutation<Blob, UUID>({
      query: (id) => ({
        url: `/api/barista/orders/${id}/invoice`,
        responseHandler: (response: Response) =>
          response.ok ? response.blob() : response.json(),
      }),
    }),

    // Unanswered "call staff" presses, oldest first — see orderApi's admin equivalent, which
    // this exactly mirrors on the barista-scoped route.
    listBaristaStaffCalls: builder.query<StaffCallResponse[], void>({
      query: () => "/api/barista/orders/staff-calls",
      transformResponse: unwrap<StaffCallResponse[]>,
      providesTags: [{ type: "StaffCall", id: "LIST" }],
    }),

    answerBaristaStaffCall: builder.mutation<void, UUID>({
      query: (id) => ({
        url: `/api/barista/orders/${id}/staff-call/answer`,
        method: "POST",
      }),
      invalidatesTags: [{ type: "StaffCall", id: "LIST" }],
    }),
  }),
});

export const {
  useCreateBaristaOrderMutation,
  useListBaristaOrdersQuery,
  useListAllBaristaOrdersQuery,
  useListBaristaDeliveryBoardQuery,
  useSetBaristaOrderDeliveryFeeMutation,
  useGetBaristaOrderQuery,
  usePayOrderCashMutation,
  useGenerateBakongQrMutation,
  useConfirmBakongPaymentMutation,
  useCollectBaristaCashMutation,
  useAcceptBaristaBakongMutation,
  useCancelBaristaOrderMutation,
  useStartPreparingBaristaOrderMutation,
  useCompleteBaristaOrderMutation,
  useDispatchBaristaOrderMutation,
  useMarkDeliveredBaristaOrderMutation,
  useDownloadBaristaOrderInvoiceMutation,
  useListBaristaStaffCallsQuery,
  useAnswerBaristaStaffCallMutation,
} = baristaOrderApi;
