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

    downloadReport: builder.mutation<
      Blob,
      { date: string; period: "DAY" | "MONTH" | "YEAR"; year: number; month: number }
    >({
      query: (params) => ({
        url: "/api/admin/reports/export",
        params,
        responseHandler: (response: Response) =>
          response.ok ? response.blob() : response.json(),
      }),
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

    // Read-only copy for baristas, so they can take payments in riel.
    getBaristaExchangeRate: builder.query<BakongExchangeRateResponse, void>({
      query: () => "/api/barista/bakong/exchange-rate",
      transformResponse: unwrap<BakongExchangeRateResponse>,
      providesTags: ["ExchangeRate"],
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
  useDownloadReportMutation,
  useGetDailyFinanceQuery,
  useGetMonthlyFinanceQuery,
  useGetYearlyFinanceQuery,
  useGetExchangeRateQuery,
  useGetBaristaExchangeRateQuery,
  useUpdateExchangeRateMutation,
} = reportApi;
