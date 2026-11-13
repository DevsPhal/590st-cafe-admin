import { baseApi, unwrap } from "./baseApi";
import type {
  AttachProductExtraRequest,
  CreateProductRequest,
  CreateProductVariantRequest,
  PageQuery,
  PageResponse,
  ProductExtraResponse,
  ProductImportResponse,
  ProductResponse,
  ProductVariantResponse,
  SetProductDiscountRequest,
  UpdateProductExtraRequest,
  UpdateProductRequest,
  UpdateProductVariantRequest,
  UUID,
} from "./types";

interface ProductListQuery extends PageQuery {
  categoryId?: UUID;
}

export const productApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listProducts: builder.query<PageResponse<ProductResponse>, ProductListQuery | void>({
      query: (params) => ({ url: "/api/admin/products", params: params ?? undefined }),
      transformResponse: unwrap<PageResponse<ProductResponse>>,
      providesTags: (result) =>
        result
          ? [
              ...result.content.map(({ id }) => ({ type: "Product" as const, id })),
              { type: "Product" as const, id: "LIST" },
            ]
          : [{ type: "Product" as const, id: "LIST" }],
    }),

    getProduct: builder.query<ProductResponse, UUID>({
      query: (id) => `/api/admin/products/${id}`,
      transformResponse: unwrap<ProductResponse>,
      providesTags: (_r, _e, id) => [{ type: "Product", id }],
    }),

    createProduct: builder.mutation<ProductResponse, CreateProductRequest>({
      query: (body) => ({ url: "/api/admin/products", method: "POST", body }),
      transformResponse: unwrap<ProductResponse>,
      // A new product also creates its inventory row, so the stock screens are stale too.
      invalidatesTags: [
        { type: "Product", id: "LIST" },
        { type: "Inventory", id: "LIST" },
        { type: "Inventory", id: "LOW_STOCK" },
      ],
    }),

    updateProduct: builder.mutation<
      ProductResponse,
      { id: UUID; body: UpdateProductRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/admin/products/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: unwrap<ProductResponse>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
        { type: "Inventory", id: "LIST" },
        { type: "Inventory", id: "LOW_STOCK" },
      ],
    }),

    deleteProduct: builder.mutation<void, UUID>({
      query: (id) => ({ url: `/api/admin/products/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
        { type: "Inventory", id: "LIST" },
        { type: "Inventory", id: "LOW_STOCK" },
      ],
    }),

    setProductDiscount: builder.mutation<
      ProductResponse,
      { id: UUID; body: SetProductDiscountRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/admin/products/${id}/discount`,
        method: "PUT",
        body,
      }),
      transformResponse: unwrap<ProductResponse>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),

    clearProductDiscount: builder.mutation<ProductResponse, UUID>({
      query: (id) => ({ url: `/api/admin/products/${id}/discount`, method: "DELETE" }),
      transformResponse: unwrap<ProductResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),

    uploadProductImage: builder.mutation<ProductResponse, { id: UUID; file: File }>({
      query: ({ id, file }) => {
        const formData = new FormData();
        formData.append("file", file);
        // No explicit Content-Type: the browser must set the multipart boundary itself.
        return { url: `/api/admin/products/${id}/image`, method: "POST", body: formData };
      },
      transformResponse: unwrap<ProductResponse>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),

    removeProductImage: builder.mutation<ProductResponse, UUID>({
      query: (id) => ({ url: `/api/admin/products/${id}/image`, method: "DELETE" }),
      transformResponse: unwrap<ProductResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),

    importProducts: builder.mutation<ProductImportResponse, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append("file", file);
        return { url: "/api/admin/products/import", method: "POST", body: formData };
      },
      transformResponse: unwrap<ProductImportResponse>,
      invalidatesTags: [
        { type: "Product", id: "LIST" },
        { type: "Inventory", id: "LIST" },
        { type: "Inventory", id: "LOW_STOCK" },
      ],
    }),

    // ---- variants (each carries its own absolute price) ----

    listVariants: builder.query<ProductVariantResponse[], UUID>({
      query: (productId) => `/api/admin/products/${productId}/variants`,
      transformResponse: unwrap<ProductVariantResponse[]>,
      providesTags: (_r, _e, productId) => [{ type: "Variant", id: productId }],
    }),

    createVariant: builder.mutation<
      ProductVariantResponse,
      { productId: UUID; body: CreateProductVariantRequest }
    >({
      query: ({ productId, body }) => ({
        url: `/api/admin/products/${productId}/variants`,
        method: "POST",
        body,
      }),
      transformResponse: unwrap<ProductVariantResponse>,
      invalidatesTags: (_r, _e, { productId }) => [
        { type: "Variant", id: productId },
        { type: "Product", id: productId },
        { type: "Product", id: "LIST" },
      ],
    }),

    updateVariant: builder.mutation<
      ProductVariantResponse,
      { productId: UUID; id: UUID; body: UpdateProductVariantRequest }
    >({
      query: ({ productId, id, body }) => ({
        url: `/api/admin/products/${productId}/variants/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: unwrap<ProductVariantResponse>,
      invalidatesTags: (_r, _e, { productId }) => [
        { type: "Variant", id: productId },
        { type: "Product", id: productId },
        { type: "Product", id: "LIST" },
      ],
    }),

    deleteVariant: builder.mutation<void, { productId: UUID; id: UUID }>({
      query: ({ productId, id }) => ({
        url: `/api/admin/products/${productId}/variants/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { productId }) => [
        { type: "Variant", id: productId },
        { type: "Product", id: productId },
        { type: "Product", id: "LIST" },
      ],
    }),

    // ---- extras offered on a product (see extraApi for the global add-on catalog) ----

    listProductExtras: builder.query<ProductExtraResponse[], UUID>({
      query: (productId) => `/api/admin/products/${productId}/extras`,
      transformResponse: unwrap<ProductExtraResponse[]>,
      // Also tagged with the catalog-wide LIST id: name/price/image all live on the underlying
      // Extra, not this attachment, so a catalog edit (extraApi) must refetch this too or an
      // already-open product page keeps showing the old photo/price for an extra it offers.
      providesTags: (_r, _e, productId) => [
        { type: "ProductExtra", id: productId },
        { type: "ProductExtra", id: "LIST" },
      ],
    }),

    attachProductExtra: builder.mutation<
      ProductExtraResponse,
      { productId: UUID; body: AttachProductExtraRequest }
    >({
      query: ({ productId, body }) => ({
        url: `/api/admin/products/${productId}/extras`,
        method: "POST",
        body,
      }),
      transformResponse: unwrap<ProductExtraResponse>,
      invalidatesTags: (_r, _e, { productId }) => [{ type: "ProductExtra", id: productId }],
    }),

    updateProductExtra: builder.mutation<
      ProductExtraResponse,
      { productId: UUID; id: UUID; body: UpdateProductExtraRequest }
    >({
      query: ({ productId, id, body }) => ({
        url: `/api/admin/products/${productId}/extras/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: unwrap<ProductExtraResponse>,
      invalidatesTags: (_r, _e, { productId }) => [{ type: "ProductExtra", id: productId }],
    }),

    detachProductExtra: builder.mutation<void, { productId: UUID; id: UUID }>({
      query: ({ productId, id }) => ({
        url: `/api/admin/products/${productId}/extras/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { productId }) => [{ type: "ProductExtra", id: productId }],
    }),
  }),
});

export const {
  useListProductsQuery,
  useGetProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useSetProductDiscountMutation,
  useClearProductDiscountMutation,
  useUploadProductImageMutation,
  useRemoveProductImageMutation,
  useImportProductsMutation,
  useListVariantsQuery,
  useCreateVariantMutation,
  useUpdateVariantMutation,
  useDeleteVariantMutation,
  useListProductExtrasQuery,
  useAttachProductExtraMutation,
  useUpdateProductExtraMutation,
  useDetachProductExtraMutation,
} = productApi;
