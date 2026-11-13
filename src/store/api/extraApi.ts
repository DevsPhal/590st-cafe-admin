import { baseApi, unwrap } from "./baseApi";
import type {
  CreateExtraRequest,
  ExtraResponse,
  UpdateExtraRequest,
  UUID,
} from "./types";

/// A single API slice for the shop-wide add-on catalog (e.g. Pearl) — a flat list, not paginated. Attaching one of these to a specific product is a separate step (productApi's *ProductExtra endpoints). It uses the same `baseApi` as the other slices, so it shares the same auth headers and error handling.
const CATALOG_CHANGE_TAGS = [
  { type: "Extra" as const, id: "LIST" },
  { type: "ProductExtra" as const, id: "LIST" },
];

/**
 * The shop-wide add-on catalog (e.g. Pearl) — a flat list, not paginated. Attaching one of
 * these to a specific product is a separate step (productApi's *ProductExtra endpoints).
 */
export const extraApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listExtras: builder.query<ExtraResponse[], void>({
      query: () => "/api/admin/extras",
      transformResponse: unwrap<ExtraResponse[]>,
      providesTags: [{ type: "Extra", id: "LIST" }],
    }),

    createExtra: builder.mutation<ExtraResponse, CreateExtraRequest>({
      query: (body) => ({ url: "/api/admin/extras", method: "POST", body }),
      transformResponse: unwrap<ExtraResponse>,
      // A brand-new extra can't be attached to a product yet, so no ProductExtra list is stale.
      invalidatesTags: [{ type: "Extra", id: "LIST" }],
    }),

    updateExtra: builder.mutation<
      ExtraResponse,
      { id: UUID; body: UpdateExtraRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/admin/extras/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: unwrap<ExtraResponse>,
      invalidatesTags: CATALOG_CHANGE_TAGS,
    }),

    deleteExtra: builder.mutation<void, UUID>({
      query: (id) => ({ url: `/api/admin/extras/${id}`, method: "DELETE" }),
      invalidatesTags: CATALOG_CHANGE_TAGS,
    }),

    // Photo shown to customers next to the add-on choice (e.g. a picture of Pearl).
    uploadExtraImage: builder.mutation<ExtraResponse, { id: UUID; file: File }>(
      {
        query: ({ id, file }) => {
          const formData = new FormData();
          formData.append("file", file);
          return {
            url: `/api/admin/extras/${id}/image`,
            method: "POST",
            body: formData,
          };
        },
        transformResponse: unwrap<ExtraResponse>,
        invalidatesTags: CATALOG_CHANGE_TAGS,
      },
    ),

    removeExtraImage: builder.mutation<ExtraResponse, UUID>({
      query: (id) => ({
        url: `/api/admin/extras/${id}/image`,
        method: "DELETE",
      }),
      transformResponse: unwrap<ExtraResponse>,
      invalidatesTags: CATALOG_CHANGE_TAGS,
    }),
  }),
});

export const {
  useListExtrasQuery,
  useCreateExtraMutation,
  useUpdateExtraMutation,
  useDeleteExtraMutation,
  useUploadExtraImageMutation,
  useRemoveExtraImageMutation,
} = extraApi;
