import { baseApi, unwrap } from "./baseApi";
import { trailingDates } from "@/lib/shopDate";
import type {
  ApiEnvelope,
  AdminDailyReportResponse,
  DailyReportResponse,
  BakongExchangeRateResponse,
  FinanceSummaryResponse,
  UpdateBakongExchangeRateRequest,
} from "./types";

/// A single API slice for all reporting endpoints, including daily and weekly reports, finance summaries, and exchange rates. It uses the same `baseApi` as the other slices, so it shares the same auth headers and error handling.
export const reportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOwnDailyReport: builder.query<
      DailyReportResponse,
      { date?: string } | void
    >({
      query: (params) => ({
        url: "/api/barista/reports/daily",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<DailyReportResponse>,
      providesTags: [{ type: "Report", id: "DAILY" }],
    }),
    getWeeklyReports: builder.query<AdminDailyReportResponse[], string>({
      async queryFn(endDate, _api, _options, baseQuery) {
        const results = await Promise.all(
          trailingDates(endDate, 7).map((date) =>
            baseQuery({ url: "/api/admin/reports/daily", params: { date } }),
          ),
        );
        const failed = results.find((result) => result.error);
        if (failed?.error) return { error: failed.error };
        return {
          data: results.map(
            (result) =>
              (result.data as ApiEnvelope<AdminDailyReportResponse>).data,
          ),
        };
      },
      providesTags: [{ type: "Report", id: "DAILY" }],
    }),
    /** Shop-wide daily takings, broken down per barista. */
    getDailyReport: builder.query<
      AdminDailyReportResponse,
      { date?: string } | void
    >({
      query: (params) => ({
        url: "/api/admin/reports/daily",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<AdminDailyReportResponse>,
      providesTags: [{ type: "Report", id: "DAILY" }],
    }),

    getDailyFinance: builder.query<
      FinanceSummaryResponse,
      { date?: string } | void
    >({
      query: (params) => ({
        url: "/api/admin/finance/daily",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<FinanceSummaryResponse>,
      providesTags: [{ type: "Finance", id: "SUMMARY" }],
    }),

    getMonthlyFinance: builder.query<
      FinanceSummaryResponse,
      { year?: number; month?: number } | void
    >({
      query: (params) => ({
        url: "/api/admin/finance/monthly",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<FinanceSummaryResponse>,
      providesTags: [{ type: "Finance", id: "SUMMARY" }],
    }),

    getYearlyFinance: builder.query<
      FinanceSummaryResponse,
      { year?: number } | void
    >({
      query: (params) => ({
        url: "/api/admin/finance/yearly",
        params: params ?? undefined,
      }),
      transformResponse: unwrap<FinanceSummaryResponse>,
      providesTags: [{ type: "Finance", id: "SUMMARY" }],
    }),

    getExchangeRate: builder.query<BakongExchangeRateResponse, void>({
      query: () => "/api/admin/bakong/exchange-rate",
      transformResponse: unwrap<BakongExchangeRateResponse>,
      providesTags: ["ExchangeRate"],
    }),

    updateExchangeRate: builder.mutation<
      BakongExchangeRateResponse,
      UpdateBakongExchangeRateRequest
    >({
      query: (body) => ({
        url: "/api/admin/bakong/exchange-rate",
        method: "PUT",
        body,
      }),
      transformResponse: unwrap<BakongExchangeRateResponse>,
      invalidatesTags: ["ExchangeRate"],
    }),
  }),
});

export const {
  useGetOwnDailyReportQuery,
  useGetWeeklyReportsQuery,
  useGetDailyReportQuery,
  useGetDailyFinanceQuery,
  useGetMonthlyFinanceQuery,
  useGetYearlyFinanceQuery,
  useGetExchangeRateQuery,
  useUpdateExchangeRateMutation,
} = reportApi;
