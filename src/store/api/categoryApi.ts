import { baseApi, unwrap } from "./baseApi";
import type {
  CategoryResponse,
  CreateCategoryRequest,
  PageQuery,
  PageResponse,
  UpdateCategoryRequest,
  UUID,
} from "./types";

export const categoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listCategories: builder.query<PageResponse<CategoryResponse>, PageQuery | void>({
      query: (params) => ({ url: "/api/admin/categories", params: params ?? undefined }),
      transformResponse: unwrap<PageResponse<CategoryResponse>>,
      providesTags: (result) =>
        result
          ? [
              ...result.content.map(({ id }) => ({ type: "Category" as const, id })),
              { type: "Category" as const, id: "LIST" },
            ]
          : [{ type: "Category" as const, id: "LIST" }],
    }),

    getCategory: builder.query<CategoryResponse, UUID>({
      query: (id) => `/api/admin/categories/${id}`,
      transformResponse: unwrap<CategoryResponse>,
      providesTags: (_r, _e, id) => [{ type: "Category", id }],
    }),

    createCategory: builder.mutation<CategoryResponse, CreateCategoryRequest>({
      query: (body) => ({ url: "/api/admin/categories", method: "POST", body }),
      transformResponse: unwrap<CategoryResponse>,
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),

    updateCategory: builder.mutation<
      CategoryResponse,
      { id: UUID; body: UpdateCategoryRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/admin/categories/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: unwrap<CategoryResponse>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Category", id },
        { type: "Category", id: "LIST" },
        { type: "Product", id: "LIST" },
      ],
    }),

    deleteCategory: builder.mutation<void, UUID>({
      query: (id) => ({ url: `/api/admin/categories/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Category", id },
        { type: "Category", id: "LIST" },
        { type: "Product", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListCategoriesQuery,
  useGetCategoryQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} = categoryApi;
