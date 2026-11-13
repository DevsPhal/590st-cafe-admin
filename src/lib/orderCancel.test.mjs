// Who may cancel an order must match the API (OrderCancellationIntegrationTest). Run with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cancelPolicy } from "./orderCancel.ts";

const admin = { role: "ADMIN", userId: "a1" };
const me = { role: "BARISTA", userId: "b1" };
const order = (extra) => ({ status: "PENDING", paymentMethod: "CASH", paidAt: null, handledById: null, totalAmount: "5.00", ...extra });

describe("cancelPolicy", () => {
  it("lets staff cancel an unpaid cash order at every step until it is finished", () => {
    for (const status of ["PENDING", "PREPARING", "OUT_FOR_DELIVERY"]) {
      const result = cancelPolicy(order({ status, handledById: "b1" }), me);
      assert.equal(result.allowed, true, status);
      assert.equal(result.refund, null);
      assert.equal(result.stockTaken, status !== "PENDING");
    }
  });

  it("keeps baristas off orders another staff member is handling, but not off untaken ones", () => {
    assert.deepEqual(cancelPolicy(order({ status: "PREPARING", handledById: "b2" }), me), { allowed: false, why: "OTHER_HANDLER" });
    assert.equal(cancelPolicy(order({ handledById: null }), me).allowed, true);
    assert.equal(cancelPolicy(order({ status: "PREPARING", handledById: "b2" }), admin).allowed, true);
  });

  it("makes a paid cash order a refund only an admin can give, in the currency paid", () => {
    const paidUsd = order({ status: "PREPARING", paidAt: "2026-11-10T10:00:00", handledById: "b1" });
    assert.deepEqual(cancelPolicy(paidUsd, me), { allowed: false, why: "ADMIN_ONLY" });
    assert.deepEqual(cancelPolicy(paidUsd, admin), { allowed: true, refund: { amount: 5, currency: "USD" }, stockTaken: true });
    const paidRiel = { ...paidUsd, amountTenderedCurrency: "KHR", exchangeRate: "4100.0000" };
    assert.deepEqual(cancelPolicy(paidRiel, admin).refund, { amount: 20500, currency: "KHR" });
    assert.deepEqual(cancelPolicy({ ...paidRiel, totalAmount: "10.15" }, admin).refund, { amount: 41600, currency: "KHR" });
  });

  it("never cancels a Bakong-paid or finished order", () => {
    assert.deepEqual(cancelPolicy(order({ paymentMethod: "BAKONG", status: "PAID", paidAt: "x" }), admin), { allowed: false, why: "BAKONG_PAID" });
    for (const status of ["COMPLETED", "DELIVERED", "CANCELLED"]) {
      assert.deepEqual(cancelPolicy(order({ status }), admin), { allowed: false, why: "FINISHED" });
    }
  });
});
