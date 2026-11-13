// Riel rounding in the admin must match the API (KhrConversionTest uses the same cases). Run with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { amountDue, changeDue, rielTotalLabel, roundKhrToNearest100, usdToKhr } from "./khr.ts";

describe("roundKhrToNearest100", () => {
  it("rounds 00–50 down and 51–99 up (the examples from the rounding rule)", () => {
    for (const [raw, expected] of [[1250, 1200], [1251, 1300], [1249, 1200], [1299, 1300], [1350, 1300], [1351, 1400]]) {
      assert.equal(roundKhrToNearest100(raw), expected, `${raw}`);
    }
  });

  it("handles the edges of each band", () => {
    for (const [raw, expected] of [[0, 0], [50, 0], [51, 100], [99, 100], [100, 100], [1200, 1200], [1201, 1200],
                                   [41000, 41000], [999950, 999900], [999951, 1000000]]) {
      assert.equal(roundKhrToNearest100(raw), expected, `${raw}`);
    }
  });

  it("makes a whole riel first, then applies the rule", () => {
    assert.equal(roundKhrToNearest100(1250.4), 1200);
    assert.equal(roundKhrToNearest100(1250.5), 1300);
    assert.equal(roundKhrToNearest100(1349.99), 1300);
  });

  it("mirrors negative amounts", () => {
    assert.equal(roundKhrToNearest100(-1250), -1200);
    assert.equal(roundKhrToNearest100(-1251), -1300);
  });
});

describe("usdToKhr", () => {
  it("converts and rounds only the final riel amount", () => {
    for (const [usd, rate, expected] of [[0.3, 4100, 1200], [1.19, 4100, 4900], [10, 4100, 41000], [0.05, 4100, 200],
                                         [3.81, 4100, 15600], [14.5, 4100, 59400], [10.19, 4100, 41800], [10.5, 4100, 43000]]) {
      assert.equal(usdToKhr(usd, rate), expected, `$${usd} at ${rate}`);
    }
  });

  it("lands exactly on the rule's boundaries at rates where whole cents make them", () => {
    assert.equal(usdToKhr(0.25, 5000), 1200); // 1,250
    assert.equal(usdToKhr(0.3, 4170), 1300); // 1,251
    assert.equal(usdToKhr(0.27, 5000), 1300); // 1,350
    assert.equal(usdToKhr(0.35, 3860), 1400); // 1,351
  });

  it("keeps fractional rates exact and avoids floating-point drift", () => {
    assert.equal(usdToKhr(1.25, 4050.5), 5100); // 5,063.125 -> 5,063 -> 5,100
    assert.equal(usdToKhr(12345.67, 4100), 50617200); // 50,617,247 -> 50,617,200
    assert.equal(usdToKhr(0.01, 4100), 0);
  });
});

describe("cash screens", () => {
  it("asks for rounded riel and leaves dollars alone", () => {
    assert.equal(amountDue(1.19, "KHR", 4100), 4900);
    assert.equal(amountDue(1.19, "USD", 4100), 1.19);
    assert.equal(amountDue(1.19, "KHR", null), 1.19);
  });

  it("shows change the way the API stores it", () => {
    assert.equal(changeDue(10000, 4900, "KHR"), 5100);
    assert.equal(changeDue(45000, 41000, "KHR"), 4000);
    assert.equal(changeDue(4950, 4900, "KHR"), 0);
    assert.equal(changeDue(2, 1.19, "USD"), 0.81);
  });

  it("labels the riel total of a cash order that recorded a rate", () => {
    assert.equal(rielTotalLabel({ totalAmount: "10.19", paymentMethod: "CASH", exchangeRate: "4100.0000" }),
      "41,800 ៛ · 1 USD = 4,100 ៛");
    assert.equal(rielTotalLabel({ totalAmount: 5, paymentMethod: "BAKONG", exchangeRate: 4100 }), null);
    assert.equal(rielTotalLabel({ totalAmount: 5, paymentMethod: "CASH", exchangeRate: null }), null);
  });
});
