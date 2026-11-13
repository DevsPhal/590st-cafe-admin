// The table rules in the admin must match the API (TableRulesTest.java uses the same matrix). Run with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addMinutesToShopTime,
  canMarkNoShow,
  heldByOther,
  manualChange,
  manualChangeAt,
  posBlocker,
  posRequirement,
  posSeatingFields,
} from "./tableTransitions.ts";

const MATRIX = [
  ["AVAILABLE", "AVAILABLE", "ALLOWED"],
  ["AVAILABLE", "OCCUPIED", "ALLOWED"],
  ["AVAILABLE", "RESERVED", "NEVER"],
  ["AVAILABLE", "CLEANING", "ALLOWED"],
  ["OCCUPIED", "AVAILABLE", "ADMIN_OVERRIDE"],
  ["OCCUPIED", "OCCUPIED", "ALLOWED"],
  ["OCCUPIED", "RESERVED", "NEVER"],
  ["OCCUPIED", "CLEANING", "ALLOWED"],
  ["RESERVED", "AVAILABLE", "ALLOWED"],
  ["RESERVED", "OCCUPIED", "ADMIN_OVERRIDE"],
  ["RESERVED", "RESERVED", "ALLOWED"],
  ["RESERVED", "CLEANING", "ALLOWED"],
  ["CLEANING", "AVAILABLE", "ALLOWED"],
  ["CLEANING", "OCCUPIED", "ALLOWED"],
  ["CLEANING", "RESERVED", "NEVER"],
  ["CLEANING", "CLEANING", "ALLOWED"],
];

const quiet = { activeOrders: 0, heldByBooking: false };

describe("manualChange", () => {
  it("matches the API matrix for every pair of statuses", () => {
    for (const [from, to, verdict] of MATRIX) {
      assert.equal(manualChange(from, to), verdict, `${from} -> ${to}`);
    }
  });
});

describe("manualChangeAt", () => {
  it("never clears a party that still has active orders, even for an admin", () => {
    assert.equal(manualChangeAt("OCCUPIED", "CLEANING", { ...quiet, activeOrders: 1 }), "NEVER");
    assert.equal(manualChangeAt("OCCUPIED", "AVAILABLE", { ...quiet, activeOrders: 2 }), "NEVER");
    assert.equal(manualChangeAt("OCCUPIED", "CLEANING", quiet), "ALLOWED");
    // Changing the guest count is not clearing the table.
    assert.equal(manualChangeAt("OCCUPIED", "OCCUPIED", { ...quiet, activeOrders: 3 }), "ALLOWED");
  });

  it("frees a reserved table only once no booking holds it", () => {
    assert.equal(manualChangeAt("RESERVED", "AVAILABLE", { ...quiet, heldByBooking: true }), "NEVER");
    assert.equal(manualChangeAt("RESERVED", "AVAILABLE", quiet), "ALLOWED");
  });

  it("needs an admin to seat anyone at a table a booking is holding", () => {
    const held = { ...quiet, heldByBooking: true };
    assert.equal(manualChangeAt("AVAILABLE", "OCCUPIED", held), "ADMIN_OVERRIDE");
    assert.equal(manualChangeAt("CLEANING", "OCCUPIED", held), "ADMIN_OVERRIDE");
    assert.equal(manualChangeAt("RESERVED", "OCCUPIED", held), "ADMIN_OVERRIDE");
    assert.equal(manualChangeAt("CLEANING", "OCCUPIED", quiet), "ALLOWED");
    assert.equal(manualChangeAt("CLEANING", "AVAILABLE", held), "ALLOWED");
  });
});

describe("POS seating", () => {
  const none = { forSeatedParty: false, override: false, overrideReason: "" };

  it("lets walk-ins take free tables only", () => {
    assert.equal(posRequirement("AVAILABLE"), "WALK_IN");
    assert.equal(posRequirement("OCCUPIED"), "SEATED_PARTY");
    assert.equal(posRequirement("CLEANING"), "SEATED_PARTY");
    assert.equal(posRequirement("RESERVED"), "OVERRIDE");
    assert.equal(posBlocker("AVAILABLE", none, false), null);
    assert.equal(posBlocker(undefined, none, false), null);
  });

  it("asks staff to confirm another round for the party at an occupied or uncleaned table", () => {
    assert.equal(posBlocker("OCCUPIED", none, false), "CONFIRM_SEATED_PARTY");
    assert.equal(posBlocker("CLEANING", none, false), "CONFIRM_SEATED_PARTY");
    assert.equal(posBlocker("OCCUPIED", { ...none, forSeatedParty: true }, false), null);
    assert.deepEqual(posSeatingFields("OCCUPIED", { ...none, forSeatedParty: true }, false), { forSeatedParty: true });
  });

  it("keeps reserved tables for their booking unless an admin overrides with a reason", () => {
    assert.equal(posBlocker("RESERVED", { ...none, forSeatedParty: true }, false), "RESERVED");
    assert.equal(posBlocker("RESERVED", { ...none, override: true, overrideReason: "late" }, false), "RESERVED");
    assert.equal(posBlocker("RESERVED", { ...none, override: true, overrideReason: "  " }, true), "OVERRIDE_REASON");
    assert.equal(posBlocker("RESERVED", { ...none, override: true, overrideReason: "Party is late" }, true), null);
    assert.deepEqual(posSeatingFields("RESERVED", { ...none, override: true, overrideReason: " Party is late " }, true),
      { override: true, overrideReason: "Party is late" });
  });

  it("never sends choices that do not apply to the table", () => {
    assert.deepEqual(posSeatingFields("AVAILABLE", { forSeatedParty: true, override: true, overrideReason: "x" }, true), {});
    assert.deepEqual(posSeatingFields("RESERVED", { ...none, forSeatedParty: true }, false), {});
  });
});

describe("heldByOther", () => {
  const booking = (id, reservedFor, extra = {}) => ({ id, tableId: "t1", status: "BOOKED", reservedFor, customerName: id, ...extra });
  const now = "2026-11-10T18:00";

  it("finds an earlier booking on the same table whose hold has started", () => {
    const sokha = booking("sokha", "2026-11-10T18:30:00");
    const dara = booking("dara", "2026-11-10T19:45:00");
    assert.equal(heldByOther(dara, [sokha, dara], now), sokha);
    assert.equal(heldByOther(sokha, [sokha, dara], now), null);
  });

  it("ignores bookings that are later, not yet held, closed or on another table", () => {
    const dara = booking("dara", "2026-11-10T21:00:00");
    assert.equal(heldByOther(dara, [booking("later", "2026-11-10T21:30:00")], now), null);
    assert.equal(heldByOther(dara, [booking("notHeld", "2026-11-10T19:30:00")], now), null);
    assert.equal(heldByOther(dara, [booking("seated", "2026-11-10T17:30:00", { status: "SEATED" })], now), null);
    assert.equal(heldByOther(dara, [booking("other", "2026-11-10T17:30:00", { tableId: "t2" })], now), null);
  });

  it("adds minutes across midnight without touching time zones", () => {
    assert.equal(addMinutesToShopTime("2026-11-10T23:30", 60), "2026-11-11T00:30");
    assert.equal(addMinutesToShopTime("2026-12-31T23:59:00", 1), "2027-01-01T00:00");
  });
});

describe("canMarkNoShow", () => {
  it("waits until the booked time", () => {
    assert.equal(canMarkNoShow("2026-11-10T19:00:00", "2026-11-10T18:59"), false);
    assert.equal(canMarkNoShow("2026-11-10T19:00:00", "2026-11-10T19:00"), true);
    assert.equal(canMarkNoShow("2026-11-10T19:00", "2026-11-11T08:00"), true);
  });
});
