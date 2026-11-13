import { baseApi, unwrap } from "./baseApi";
import type {
  InventoryResponse,
  PageQuery,
  PageResponse,
  StockCutRequest,
  StockCutResponse,
  StockInImportResponse,
  StockInRequest,
  StockMovementResponse,
  UUID,
} from "./types";

/// A single API slice for all inventory-related endpoints, including stock movements and low-stock alerts. It uses the same `baseApi` as the other slices, so it shares the same auth headers and error handling.
const STOCK_MOVEMENT_TAGS = (productId: UUID) => [
  { type: "Inventory" as const, id: productId },
  { type: "Inventory" as const, id: "LIST" },
  { type: "Inventory" as const, id: "LOW_STOCK" },
  { type: "StockMovement" as const, id: productId },
  { type: "Product" as const, id: productId },
  { type: "Product" as const, id: "LIST" },
];

export const inventoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listInventory: builder.query<
      PageResponse<InventoryResponse>,
      PageQuery | void
    >({
      query: (params) => ({
        url: "/api/admin/inventory",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<PageResponse<InventoryResponse>>,
      providesTags: (result) =>
        result
          ? [
              ...result.content.map(({ productId }) => ({
                type: "Inventory" as const,
                id: productId,
              })),
              { type: "Inventory" as const, id: "LIST" },
            ]
          : [{ type: "Inventory" as const, id: "LIST" }],
    }),

    /** Backs the stock-alerts screen: everything at or below its reorder level. */
    listLowStock: builder.query<
      PageResponse<InventoryResponse>,
      PageQuery | void
    >({
      query: (params) => ({
        url: "/api/admin/inventory/low-stock",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<PageResponse<InventoryResponse>>,
      providesTags: [{ type: "Inventory", id: "LOW_STOCK" }],
    }),

    getInventoryByProduct: builder.query<InventoryResponse, UUID>({
      query: (productId) => `/api/admin/inventory/${productId}`,
      transformResponse: unwrap<InventoryResponse>,
      providesTags: (_r, _e, productId) => [
        { type: "Inventory", id: productId },
      ],
    }),

    listStockMovements: builder.query<
      PageResponse<StockMovementResponse>,
      { productId: UUID } & PageQuery
    >({
      query: ({ productId, ...params }) => ({
        url: `/api/admin/inventory/${productId}/movements`,
        params,
      }),
      transformResponse: unwrap<PageResponse<StockMovementResponse>>,
      providesTags: (_r, _e, { productId }) => [
        { type: "StockMovement", id: productId },
      ],
    }),

    stockIn: builder.mutation<StockMovementResponse, StockInRequest>({
      query: (body) => ({
        url: "/api/admin/inventory/stock-in",
        method: "POST",
        body,
      }),
      transformResponse: unwrap<StockMovementResponse>,
      invalidatesTags: (_r, _e, { productId }) =>
        STOCK_MOVEMENT_TAGS(productId),
    }),

    stockCut: builder.mutation<StockCutResponse, StockCutRequest>({
      query: (body) => ({
        url: "/api/admin/inventory/stock-cut",
        method: "POST",
        body,
      }),
      transformResponse: unwrap<StockCutResponse>,
      invalidatesTags: (_r, _e, { productId }) =>
        STOCK_MOVEMENT_TAGS(productId),
    }),

    // Bulk receiving — one row per SKU (sku, quantity, unitCost, note). Which products it
    // touched isn't known client-side, so this invalidates every list-level tag rather than
    // per-product ones.
    stockInFromExcel: builder.mutation<StockInImportResponse, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append("file", file);
        return {
          url: "/api/admin/inventory/stock-in/import",
          method: "POST",
          body: formData,
        };
      },
      transformResponse: unwrap<StockInImportResponse>,
      invalidatesTags: [
        { type: "Inventory", id: "LIST" },
        { type: "Inventory", id: "LOW_STOCK" },
        { type: "Product", id: "LIST" },
      ],
    }),

    // Every stock-purchase expense for one calendar month, as an .xlsx workbook — a report, not
    // the usual ApiResponse<T> JSON. The API marks it `attachment` (forces Save As, unlike an
    // inline receipt/invoice PDF), so an error still comes back as JSON and only a 2xx is read
    // as a blob.
    downloadMonthlyStockExpenseReport: builder.mutation<
      Blob,
      { month: string } | void
    >({
      query: (args) => ({
        url: "/api/admin/inventory/expenses/report/monthly",
        params: args?.month ? { month: args.month } : undefined,
        responseHandler: (response: Response) =>
          response.ok ? response.blob() : response.json(),
      }),
    }),
  }),
});

export const {
  useListInventoryQuery,
  useListLowStockQuery,
  useGetInventoryByProductQuery,
  useListStockMovementsQuery,
  useStockInMutation,
  useStockCutMutation,
  useStockInFromExcelMutation,
  useDownloadMonthlyStockExpenseReportMutation,
} = inventoryApi;
