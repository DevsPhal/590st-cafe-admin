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

interface BaristaOrderListQuery extends PageQuery {
  status?: OrderStatus;
}

interface BaristaOrderSearchQuery extends PageQuery, OrderSearchParams {
  status?: OrderStatus | OrderStatus[];
  direction?: SortDirection;
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
    createBaristaOrder: builder.mutation<OrderResponse, CreateOrderRequest>({
      query: (body) => ({ url: "/api/barista/orders", method: "POST", body }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: [...QUEUE_TAGS, { type: "Inventory", id: "LIST" }],
    }),

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

    listAllBaristaOrders: builder.query<
      PageResponse<OrderResponse>,
      BaristaOrderSearchQuery | void
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

    getBaristaOrderStatusSummary: builder.query<
      OrderStatusSummary[],
      OrderSearchParams | void
    >({
      query: (params) => ({
        url: "/api/barista/orders/all/status-summary",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<OrderStatusSummary[]>,
      providesTags: [{ type: "Order", id: "BARISTA_ALL" }],
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

    cancelBaristaOrder: builder.mutation<OrderResponse, { id: UUID; body: CancelOrderRequest }>({
      query: ({ id, body }) => ({
        url: `/api/barista/orders/${id}/cancel`,
        method: "POST",
        body,
      }),
      transformResponse: unwrap<OrderResponse>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Order", id },
        { type: "Inventory", id: "LIST" },
        ...QUEUE_TAGS,
      ],
    }),

    setBaristaOrderEstimatedTime: builder.mutation<
      OrderResponse,
      { id: UUID; body: EstimatedTimeRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/barista/orders/${id}/estimated-time`,
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

    listBaristaAwaitingPickup: builder.query<
      PageResponse<OrderResponse>,
      PageQuery | void
    >({
      query: (params) => ({
        url: "/api/barista/orders/awaiting-pickup",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<PageResponse<OrderResponse>>,
      providesTags: [{ type: "Order", id: "AWAITING_PICKUP" }],
    }),

    listBaristaAwaitingBakongConfirmation: builder.query<
      PageResponse<OrderResponse>,
      PageQuery | void
    >({
      query: (params) => ({
        url: "/api/barista/orders/awaiting-bakong-confirmation",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<PageResponse<OrderResponse>>,
      providesTags: [{ type: "Order", id: "AWAITING_BAKONG" }],
    }),

    listBaristaAwaitingDeliveryFee: builder.query<
      PageResponse<OrderResponse>,
      PageQuery | void
    >({
      query: (params) => ({
        url: "/api/barista/orders/awaiting-delivery-fee",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<PageResponse<OrderResponse>>,
      providesTags: [{ type: "Order", id: "AWAITING_DELIVERY_FEE" }],
    }),

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

    downloadBaristaOrderInvoice: builder.mutation<Blob, { id: UUID; language?: InvoiceLanguage }>({
      query: ({ id, language }) => ({
        url: `/api/barista/orders/${id}/invoice`,
        params: language ? { language } : undefined,
        responseHandler: (response: Response) =>
          response.ok ? response.blob() : response.json(),
      }),
    }),

    listBaristaStaffCalls: builder.query<StaffCallResponse[], void>({
      query: () => "/api/barista/orders/staff-calls",
      transformResponse: unwrap<StaffCallResponse[]>,
      providesTags: [{ type: "StaffCall", id: "LIST" }],
    }),

    answerBaristaStaffCall: builder.mutation<StaffCallResponse, { id: UUID; reply?: string }>({
      query: ({ id, reply }) => ({
        url: `/api/barista/orders/${id}/staff-call/answer`,
        method: "POST",
        body: { reply },
      }),
      transformResponse: unwrap<StaffCallResponse>,
      invalidatesTags: [{ type: "StaffCall", id: "LIST" }],
    }),
  }),
});

export const {
  useCreateBaristaOrderMutation,
  useListBaristaOrdersQuery,
  useListAllBaristaOrdersQuery,
  useGetBaristaOrderStatusSummaryQuery,
  useListBaristaDeliveryBoardQuery,
  useListBaristaAwaitingPickupQuery,
  useListBaristaAwaitingBakongConfirmationQuery,
  useListBaristaAwaitingDeliveryFeeQuery,
  useSetBaristaOrderDeliveryFeeMutation,
  useSetBaristaOrderEstimatedTimeMutation,
  useGetBaristaOrderQuery,
  usePayOrderCashMutation,
  useGenerateBakongQrMutation,
  useConfirmBakongPaymentMutation,
  useCollectBaristaCashMutation,
  useCancelBaristaOrderMutation,
  useStartPreparingBaristaOrderMutation,
  useCompleteBaristaOrderMutation,
  useDispatchBaristaOrderMutation,
  useMarkDeliveredBaristaOrderMutation,
  useDownloadBaristaOrderInvoiceMutation,
  useListBaristaStaffCallsQuery,
  useAnswerBaristaStaffCallMutation,
} = baristaOrderApi;
