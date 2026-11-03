import { baseApi, unwrap } from "./baseApi";
import type {
  InventoryReportQuery,
  InventoryReportResponse,
  InventoryResponse,
  MovementSearchQuery,
  PageQuery,
  PageResponse,
  StockCountRequest,
  StockCutRequest,
  StockCutResponse,
  StockInImportResponse,
  StockInRequest,
  StockMovementResponse,
  StockReturnRequest,
  UUID,
  WasteRequest,
} from "./types";

// Any stock change also changes what drinks can be made, so recipes, history and reports are refreshed too.
const STOCK_MOVEMENT_TAGS = (productId: UUID) => [
  { type: "Inventory" as const, id: productId },
  { type: "Inventory" as const, id: "LIST" },
  { type: "Inventory" as const, id: "LOW_STOCK" },
  { type: "StockMovement" as const, id: productId },
  { type: "StockMovement" as const, id: "LIST" },
  { type: "Product" as const, id: productId },
  { type: "Product" as const, id: "LIST" },
  { type: "Recipe" as const, id: "LIST" },
  { type: "InventoryReport" as const, id: "LIST" },
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

    searchStockMovements: builder.query<PageResponse<StockMovementResponse>, MovementSearchQuery>({
      query: (params) => ({ url: "/api/admin/inventory/movements", params }),
      transformResponse: unwrap<PageResponse<StockMovementResponse>>,
      providesTags: [{ type: "StockMovement", id: "LIST" }],
    }),

    getInventoryReport: builder.query<InventoryReportResponse, InventoryReportQuery>({
      query: (params) => ({ url: "/api/admin/inventory/reports/summary", params }),
      transformResponse: unwrap<InventoryReportResponse>,
      providesTags: [{ type: "InventoryReport", id: "LIST" }],
    }),

    downloadInventoryReport: builder.mutation<Blob, InventoryReportQuery>({
      query: (params) => ({
        url: "/api/admin/inventory/reports/summary/export",
        params,
        responseHandler: (response: Response) => (response.ok ? response.blob() : response.json()),
      }),
    }),

    recordWaste: builder.mutation<StockCutResponse, WasteRequest>({
      query: (body) => ({ url: "/api/admin/inventory/waste", method: "POST", body }),
      transformResponse: unwrap<StockCutResponse>,
      invalidatesTags: (_r, _e, { productId }) => STOCK_MOVEMENT_TAGS(productId),
    }),

    returnToStock: builder.mutation<StockMovementResponse, StockReturnRequest>({
      query: (body) => ({ url: "/api/admin/inventory/returns", method: "POST", body }),
      transformResponse: unwrap<StockMovementResponse>,
      invalidatesTags: (_r, _e, { productId }) => STOCK_MOVEMENT_TAGS(productId),
    }),

    countStock: builder.mutation<StockMovementResponse, StockCountRequest>({
      query: (body) => ({ url: "/api/admin/inventory/count", method: "POST", body }),
      transformResponse: unwrap<StockMovementResponse>,
      invalidatesTags: (_r, _e, { productId }) => STOCK_MOVEMENT_TAGS(productId),
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

    downloadStockInImportTemplate: builder.mutation<Blob, void>({
      query: () => ({
        url: "/api/admin/inventory/stock-in/import/template",
        responseHandler: (response: Response) =>
          response.ok ? response.blob() : response.json(),
      }),
    }),

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
        { type: "StockMovement", id: "LIST" },
        { type: "Recipe", id: "LIST" },
        { type: "InventoryReport", id: "LIST" },
      ],
    }),

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
  useSearchStockMovementsQuery,
  useGetInventoryReportQuery,
  useDownloadInventoryReportMutation,
  useRecordWasteMutation,
  useReturnToStockMutation,
  useCountStockMutation,
  useStockInMutation,
  useStockCutMutation,
  useDownloadStockInImportTemplateMutation,
  useStockInFromExcelMutation,
  useDownloadMonthlyStockExpenseReportMutation,
} = inventoryApi;
