import { baseApi, unwrap } from "./baseApi";
import type {
  BakongQrResponse,
  CashPaymentRequest,
  CreateOrderRequest,
  Currency,
  DeliveryFeeRequest,
  OrderAuditLogResponse,
  OrderResponse,
  OrderStatus,
  PageQuery,
  PageResponse,
  StaffCallResponse,
  UUID,
} from "./types";

interface OrderListQuery extends PageQuery {
  baristaId?: UUID;
  customerId?: UUID;
  status?: OrderStatus;
}

/** Every mutation below moves an order between queues, so they all share this invalidation. */
const ORDER_QUEUE_TAGS = [
  { type: "Order" as const, id: "LIST" },
  { type: "Order" as const, id: "AWAITING_PICKUP" },
  { type: "Order" as const, id: "AWAITING_BAKONG" },
  { type: "Order" as const, id: "AWAITING_DELIVERY_FEE" },
  { type: "Order" as const, id: "DELIVERY_BOARD" },
  { type: "Report" as const, id: "DAILY" },
  { type: "Finance" as const, id: "SUMMARY" },
];

export const orderApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /// Admins can create an order on behalf of a customer, e.g. a walk-in sale rung up at the till.
    createAdminOrder: builder.mutation<OrderResponse, CreateOrderRequest>({
      query: (body) => ({ url: "/api/admin/orders", method: "POST", body }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: [...ORDER_QUEUE_TAGS, { type: "Inventory", id: "LIST" }],
    }),

    payAdminOrderCash: builder.mutation<
      OrderResponse,
      { id: UUID; body: CashPaymentRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/admin/orders/${id}/pay/cash`,
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
        ...ORDER_QUEUE_TAGS,
      ],
    }),

    /// Admins can generate a Bakong QR code for a pending order, which the customer can scan to pay. The optional `currency` parameter lets staff choose whether the QR is in USD or KHR; if omitted, the API uses the order's own currency.
    generateAdminBakongQr: builder.mutation<
      BakongQrResponse,
      { id: UUID; currency?: Currency }
    >({
      query: ({ id, currency }) => ({
        url: `/api/admin/orders/${id}/pay/bakong/qr`,
        method: "POST",
        params: currency ? { currency } : undefined,
      }),
      transformResponse: unwrap<BakongQrResponse>,
    }),

    confirmAdminBakongPayment: builder.mutation<OrderResponse, UUID>({
      query: (id) => ({
        url: `/api/admin/orders/${id}/pay/bakong/confirm`,
        method: "POST",
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        "Inventory",
        "StockMovement",
        "Product",
        ...ORDER_QUEUE_TAGS,
      ],
    }),

    listOrders: builder.query<
      PageResponse<OrderResponse>,
      OrderListQuery | void
    >({
      query: (params) => ({
        url: "/api/admin/orders",
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
              { type: "Order" as const, id: "LIST" },
            ]
          : [{ type: "Order" as const, id: "LIST" }],
    }),

    getOrder: builder.query<OrderResponse, UUID>({
      query: (id) => `/api/admin/orders/${id}`,
      transformResponse: unwrap<OrderResponse>,
      providesTags: (_r, _e, id) => [{ type: "Order", id }],
    }),

    getOrderHistory: builder.query<OrderAuditLogResponse[], UUID>({
      query: (id) => `/api/admin/orders/${id}/history`,
      transformResponse: unwrap<OrderAuditLogResponse[]>,
      providesTags: (_r, _e, id) => [{ type: "OrderHistory", id }],
    }),

    /** Cash-on-pickup orders waiting for staff to take the money. */
    listAwaitingPickup: builder.query<
      PageResponse<OrderResponse>,
      PageQuery | void
    >({
      query: (params) => ({
        url: "/api/admin/orders/awaiting-pickup",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<PageResponse<OrderResponse>>,
      providesTags: [{ type: "Order", id: "AWAITING_PICKUP" }],
    }),

    /** Bakong payments the customer claims to have sent, pending staff confirmation. */
    listAwaitingBakongConfirmation: builder.query<
      PageResponse<OrderResponse>,
      PageQuery | void
    >({
      query: (params) => ({
        url: "/api/admin/orders/awaiting-bakong-confirmation",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<PageResponse<OrderResponse>>,
      providesTags: [{ type: "Order", id: "AWAITING_BAKONG" }],
    }),

    collectCash: builder.mutation<
      OrderResponse,
      { id: UUID; body: CashPaymentRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/admin/orders/${id}/collect-cash`,
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
        ...ORDER_QUEUE_TAGS,
      ],
    }),

    acceptBakongPayment: builder.mutation<OrderResponse, UUID>({
      query: (id) => ({
        url: `/api/admin/orders/${id}/accept-bakong`,
        method: "POST",
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        "Inventory",
        "StockMovement",
        "Product",
        ...ORDER_QUEUE_TAGS,
      ],
    }),

    cancelOrder: builder.mutation<OrderResponse, UUID>({
      query: (id) => ({
        url: `/api/admin/orders/${id}/cancel`,
        method: "POST",
      }),
      transformResponse: unwrap<OrderResponse>,
      // Only unpaid orders can be cancelled; the backend cuts stock upon payment.
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        { type: "Inventory", id: "LIST" },
        ...ORDER_QUEUE_TAGS,
      ],
    }),

    /**
     * Delivery orders still waiting on a fee quote — a dedicated queue distinct from
     * listAwaitingPickup/listAwaitingBakongConfirmation, since a fresh delivery order has no
     * paymentMethod chosen yet (the customer picks Cash/Bakong only after the fee lands) and so
     * shows up in neither of those.
     */
    listAwaitingDeliveryFee: builder.query<
      PageResponse<OrderResponse>,
      PageQuery | void
    >({
      query: (params) => ({
        url: "/api/admin/orders/awaiting-delivery-fee",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<PageResponse<OrderResponse>>,
      providesTags: [{ type: "Order", id: "AWAITING_DELIVERY_FEE" }],
    }),

    /** Sets or revises the delivery fee on a pending delivery order, once staff know the distance. */
    setOrderDeliveryFee: builder.mutation<
      OrderResponse,
      { id: UUID; body: DeliveryFeeRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/admin/orders/${id}/delivery-fee`,
        method: "POST",
        body,
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        ...ORDER_QUEUE_TAGS,
      ],
    }),

    /** Every order currently out with a courier, oldest dispatch first. */
    listDeliveryBoard: builder.query<
      PageResponse<OrderResponse>,
      PageQuery | void
    >({
      query: (params) => ({
        url: "/api/admin/orders/delivery-board",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<PageResponse<OrderResponse>>,
      providesTags: [{ type: "Order", id: "DELIVERY_BOARD" }],
    }),

    /**
     * The admin mirror of the barista's queue actions, so a manager covering the bar can move
     * orders along on their own account. Money and stock both moved at payment, so these only
     * invalidate the board.
     */
    startPreparingOrder: builder.mutation<OrderResponse, UUID>({
      query: (id) => ({
        url: `/api/admin/orders/${id}/prepare`,
        method: "POST",
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        ...ORDER_QUEUE_TAGS,
      ],
    }),

    dispatchAdminOrder: builder.mutation<OrderResponse, UUID>({
      query: (id) => ({
        url: `/api/admin/orders/${id}/dispatch`,
        method: "POST",
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        ...ORDER_QUEUE_TAGS,
      ],
    }),

    markDeliveredAdminOrder: builder.mutation<OrderResponse, UUID>({
      query: (id) => ({
        url: `/api/admin/orders/${id}/deliver`,
        method: "POST",
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        ...ORDER_QUEUE_TAGS,
      ],
    }),

    completeOrder: builder.mutation<OrderResponse, UUID>({
      query: (id) => ({
        url: `/api/admin/orders/${id}/complete`,
        method: "POST",
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        ...ORDER_QUEUE_TAGS,
      ],
    }),

    // A PDF, not the usual ApiResponse<T> JSON envelope — the API marks it `inline` so staff can
    // preview/print it on the spot, hence the custom responseHandler: an error still comes back
    // as JSON (e.g. "This order hasn't been paid yet"), so only a 2xx is read as a blob.
    downloadOrderInvoice: builder.mutation<Blob, UUID>({
      query: (id) => ({
        url: `/api/admin/orders/${id}/invoice`,
        responseHandler: (response: Response) =>
          response.ok ? response.blob() : response.json(),
      }),
    }),

    // Unanswered "call staff" presses, oldest first — paired with useStaffCallAlerts for the
    // instant a customer presses the button, rather than waiting on the 30s alerts poll.
    listStaffCalls: builder.query<StaffCallResponse[], void>({
      query: () => "/api/admin/orders/staff-calls",
      transformResponse: unwrap<StaffCallResponse[]>,
      providesTags: [{ type: "StaffCall", id: "LIST" }],
    }),

    // Takes the call: clears the alert on every staff screen and tells the customer.
    answerStaffCall: builder.mutation<void, UUID>({
      query: (id) => ({
        url: `/api/admin/orders/${id}/staff-call/answer`,
        method: "POST",
      }),
      invalidatesTags: [{ type: "StaffCall", id: "LIST" }],
    }),
  }),
});

export const {
  useCreateAdminOrderMutation,
  usePayAdminOrderCashMutation,
  useGenerateAdminBakongQrMutation,
  useConfirmAdminBakongPaymentMutation,
  useListOrdersQuery,
  useGetOrderQuery,
  useGetOrderHistoryQuery,
  useListAwaitingPickupQuery,
  useListAwaitingBakongConfirmationQuery,
  useListAwaitingDeliveryFeeQuery,
  useListDeliveryBoardQuery,
  useSetOrderDeliveryFeeMutation,
  useCollectCashMutation,
  useAcceptBakongPaymentMutation,
  useCancelOrderMutation,
  useStartPreparingOrderMutation,
  useCompleteOrderMutation,
  useDispatchAdminOrderMutation,
  useMarkDeliveredAdminOrderMutation,
  useDownloadOrderInvoiceMutation,
  useListStaffCallsQuery,
  useAnswerStaffCallMutation,
} = orderApi;
