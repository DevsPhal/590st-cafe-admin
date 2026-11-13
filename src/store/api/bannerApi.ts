import { baseApi, unwrap } from "./baseApi";
import type {
  BannerResponse,
  CreateBannerRequest,
  PageQuery,
  PageResponse,
  UpdateBannerRequest,
  UUID,
} from "./types";

export const bannerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listBanners: builder.query<PageResponse<BannerResponse>, PageQuery | void>({
      query: (params) => ({ url: "/api/admin/banners", params: params ?? undefined }),
      transformResponse: unwrap<PageResponse<BannerResponse>>,
      providesTags: (result) =>
        result
          ? [
              ...result.content.map(({ id }) => ({ type: "Banner" as const, id })),
              { type: "Banner" as const, id: "LIST" },
            ]
          : [{ type: "Banner" as const, id: "LIST" }],
    }),

    createBanner: builder.mutation<BannerResponse, CreateBannerRequest>({
      query: (body) => ({ url: "/api/admin/banners", method: "POST", body }),
      transformResponse: unwrap<BannerResponse>,
      invalidatesTags: [{ type: "Banner", id: "LIST" }],
    }),

    updateBanner: builder.mutation<BannerResponse, { id: UUID; body: UpdateBannerRequest }>({
      query: ({ id, body }) => ({ url: `/api/admin/banners/${id}`, method: "PATCH", body }),
      transformResponse: unwrap<BannerResponse>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Banner", id },
        { type: "Banner", id: "LIST" },
      ],
    }),

    deleteBanner: builder.mutation<void, UUID>({
      query: (id) => ({ url: `/api/admin/banners/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Banner", id },
        { type: "Banner", id: "LIST" },
      ],
    }),

    uploadBannerImage: builder.mutation<BannerResponse, { id: UUID; file: File }>({
      query: ({ id, file }) => {
        const formData = new FormData();
        formData.append("file", file);
        return { url: `/api/admin/banners/${id}/image`, method: "POST", body: formData };
      },
      transformResponse: unwrap<BannerResponse>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Banner", id },
        { type: "Banner", id: "LIST" },
      ],
    }),

    removeBannerImage: builder.mutation<BannerResponse, UUID>({
      query: (id) => ({ url: `/api/admin/banners/${id}/image`, method: "DELETE" }),
      transformResponse: unwrap<BannerResponse>,
      invalidatesTags: (_r, _e, id) => [
        { type: "Banner", id },
        { type: "Banner", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useListBannersQuery,
  useCreateBannerMutation,
  useUpdateBannerMutation,
  useDeleteBannerMutation,
  useUploadBannerImageMutation,
  useRemoveBannerImageMutation,
} = bannerApi;
