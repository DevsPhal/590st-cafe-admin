import { baseApi, unwrap } from "./baseApi";
import type { RecipeResponse, SetRecipeRequest, UUID } from "./types";

export const recipeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // One entry per size of the product, with no items where no recipe is set.
    listRecipes: builder.query<RecipeResponse[], UUID>({
      query: (productId) => `/api/admin/products/${productId}/recipes`,
      transformResponse: unwrap<RecipeResponse[]>,
      providesTags: (_r, _e, productId) => [
        { type: "Recipe", id: productId },
        { type: "Recipe", id: "LIST" },
      ],
    }),

    setRecipe: builder.mutation<RecipeResponse, { productId: UUID; variantId: UUID; body: SetRecipeRequest }>({
      query: ({ productId, variantId, body }) => ({
        url: `/api/admin/products/${productId}/variants/${variantId}/recipe`,
        method: "PUT",
        body,
      }),
      transformResponse: unwrap<RecipeResponse>,
      // A recipe changes how many of the drink can be made, which the product list and POS show.
      invalidatesTags: (_r, _e, { productId }) => [
        { type: "Recipe", id: productId },
        { type: "Product", id: productId },
        { type: "Product", id: "LIST" },
      ],
    }),
  }),
});

export const { useListRecipesQuery, useSetRecipeMutation } = recipeApi;
