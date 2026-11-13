import { z } from "zod";

// A Zod schema for validating a currency selection, allowing only "USD" or "KHR" and providing a custom error message if the input is invalid.

export const currencySchema = z.enum(["USD", "KHR"], {
  message: "Select a currency.",
});

// A function that builds a Zod schema for validating cash payment form values, ensuring that the amount tendered is a positive number and meets a specified minimum amount. It also includes a currency selection validated by the `currencySchema`.
export function buildCashPaymentSchema(minAmount: number) {
  return z.object({
    currency: currencySchema,
    amountTendered: z.coerce
      .number({ message: "Enter the amount handed over." })
      .positive({ message: "Enter the amount handed over." })
      .min(minAmount, {
        message: "Amount tendered is less than the total due.",
      }),
  });
}

export type CashPaymentFormValues = z.infer<
  ReturnType<typeof buildCashPaymentSchema>
>;

/** Mirrors `DeliveryFeeRequest` (fee, @NotNull @DecimalMin("0.0")). */
export const deliveryFeeSchema = z.object({
  fee: z.coerce
    .number({ message: "Enter the delivery fee." })
    .min(0, { message: "Delivery fee cannot be negative." }),
});

/** The first issue's message, for a single-line toast — forms surface one problem at a time. */
export function firstIssueMessage(
  error: z.ZodError,
  fallback = "Check the form and try again.",
): string {
  return error.issues[0]?.message ?? fallback;
}
