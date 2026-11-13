import { baseApi, unwrap } from "./baseApi";
import type {
  BakongQrResponse,
  CancelOrderRequest,
  CashPaymentRequest,
  CreateOrderRequest,
  Currency,
  DeliveryFeeRequest,
  EstimatedTimeRequest,
  InvoiceLanguage,
  OrderAuditLogResponse,
  OrderResponse,
  OrderSearchParams,
  OrderStatus,
  OrderStatusSummary,
  PageQuery,
  PageResponse,
  SortDirection,
  StaffCallResponse,
  UUID,
} from "./types";

interface OrderSummaryQuery extends OrderSearchParams {
  baristaId?: UUID;
  customerId?: UUID;
}

interface OrderListQuery extends PageQuery, OrderSummaryQuery {
  status?: OrderStatus | OrderStatus[];
  direction?: SortDirection;
}

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

    getOrderStatusSummary: builder.query<
      OrderStatusSummary[],
      OrderSummaryQuery | void
    >({
      query: (params) => ({
        url: "/api/admin/orders/status-summary",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<OrderStatusSummary[]>,
      providesTags: [{ type: "Order", id: "LIST" }],
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

    cancelOrder: builder.mutation<OrderResponse, { id: UUID; body: CancelOrderRequest }>({
      query: ({ id, body }) => ({
        url: `/api/admin/orders/${id}/cancel`,
        method: "POST",
        body,
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Order", id },
        { type: "OrderHistory", id },
        { type: "Inventory", id: "LIST" },
        ...ORDER_QUEUE_TAGS,
      ],
    }),

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

    setOrderEstimatedTime: builder.mutation<
      OrderResponse,
      { id: UUID; body: EstimatedTimeRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/admin/orders/${id}/estimated-time`,
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

    downloadOrderInvoice: builder.mutation<Blob, { id: UUID; language?: InvoiceLanguage }>({
      query: ({ id, language }) => ({
        url: `/api/admin/orders/${id}/invoice`,
        params: language ? { language } : undefined,
        responseHandler: (response: Response) =>
          response.ok ? response.blob() : response.json(),
      }),
    }),

    listStaffCalls: builder.query<StaffCallResponse[], void>({
      query: () => "/api/admin/orders/staff-calls",
      transformResponse: unwrap<StaffCallResponse[]>,
      providesTags: [{ type: "StaffCall", id: "LIST" }],
    }),

    answerStaffCall: builder.mutation<StaffCallResponse, { id: UUID; reply?: string }>({
      query: ({ id, reply }) => ({
        url: `/api/admin/orders/${id}/staff-call/answer`,
        method: "POST",
        body: { reply },
      }),
      transformResponse: unwrap<StaffCallResponse>,
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
  useGetOrderStatusSummaryQuery,
  useGetOrderQuery,
  useGetOrderHistoryQuery,
  useListAwaitingPickupQuery,
  useListAwaitingBakongConfirmationQuery,
  useListAwaitingDeliveryFeeQuery,
  useListDeliveryBoardQuery,
  useSetOrderDeliveryFeeMutation,
  useSetOrderEstimatedTimeMutation,
  useCollectCashMutation,
  useCancelOrderMutation,
  useStartPreparingOrderMutation,
  useCompleteOrderMutation,
  useDispatchAdminOrderMutation,
  useMarkDeliveredAdminOrderMutation,
  useDownloadOrderInvoiceMutation,
  useListStaffCallsQuery,
  useAnswerStaffCallMutation,
} = orderApi;
