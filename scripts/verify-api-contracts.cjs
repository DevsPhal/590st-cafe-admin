/* Offline contract checks. Fetch is intercepted; no accounts, orders, or emails are created. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(this, name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : name, ...args);
};
require.extensions[".ts"] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, file);

process.env.NEXT_PUBLIC_API_URL = "https://admin-contract.invalid";
const storage = new Map([["authToken", "fixture-access"]]);
global.window = { localStorage: {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
}, location: { pathname: "/" } };

const calls = [];
let failDate;
let failUsers = false;
const page = (content, pageNumber = 1) => ({ content, page: pageNumber, size: 10, totalElements: 11, totalPages: 2, first: pageNumber === 1, last: pageNumber === 2 });
const orderId = "00000000-0000-0000-0000-000000000001";
const productId = "00000000-0000-0000-0000-000000000002";
const attendanceId = "00000000-0000-0000-0000-000000000003";
const order = { id: orderId, status: "PENDING", totalAmount: 8, items: [{ id: "item", productId, quantity: 2, subtotal: 8 }] };
const user = { id: "customer", role: "CUSTOMER", fullName: "Contract customer", email: "customer@example.test", status: "ACTIVE" };
const barista = { id: "barista", role: "BARISTA", fullName: "Contract barista", email: "barista@example.test", status: "ACTIVE", avatarUrl: null };
const admin = { id: "admin", role: "ADMIN", fullName: "Contract admin", email: "admin@example.test", status: "ACTIVE", avatarUrl: null };
const history = [{ id: "history", orderId, action: "CASH_PAID", actorName: "Contract staff", actorRole: "ADMIN", createdAt: "2026-09-09T12:00:00", note: "Paid" }];
const finance = { periodStart: "2026-09-09", periodEnd: "2026-09-09", cashIn: 8, bakongIn: 0, totalIn: 8, totalOut: 2, profit: 6 };
let feedback = { id: "feedback", customerId: "customer", customerName: "Contract customer", fullName: "Contract customer", email: "customer@example.test", phoneNumber: null, topic: "GENERAL_INQUIRY", message: "Hello", status: "NEW", createdAt: "2026-09-09T08:00:00", updatedAt: "2026-09-09T08:00:00" };
// A product carries no price of its own — every price lives on one of its variants, and a
// discount on the product applies on top of each variant's own price to produce its finalPrice.
let product = { id: productId, stockUnit: "CARTON", sellUnit: "CARTON", unitsPerStock: 1, quantityOnHand: 2, reorderLevel: 1, discountType: null, discountValue: null, discountActive: false, extras: [] };
let variants = [{ id: "variant0", productId, name: "MEDIUM", price: 4, finalPrice: 4, sortOrder: 0, status: "ACTIVE" }];
function applyDiscount() {
  variants = variants.map((v) => ({
    ...v,
    finalPrice:
      product.discountType === "FIXED" ? v.price - product.discountValue
      : product.discountType === "PERCENTAGE" ? v.price * (1 - product.discountValue / 100)
      : v.price,
  }));
}
global.fetch = async (request) => {
  const url = new URL(request.url);
  assert.equal(url.origin, "https://admin-contract.invalid");
  assert.equal(request.headers.get("Authorization"), "Bearer fixture-access");
  let body;
  if (request.headers.get("Content-Type")?.startsWith("multipart/form-data")) {
    assert.match(request.headers.get("Content-Type"), /boundary=/);
    const form = await request.clone().formData();
    assert.deepEqual([...form.keys()], ["file"]);
    const file = form.get("file");
    body = { file: { name: file.name, type: file.type, bytes: Array.from(new Uint8Array(await file.arrayBuffer())) } };
  } else if (request.method !== "GET") body = await request.clone().json().catch(() => undefined);
  calls.push({ path: url.pathname, params: Object.fromEntries(url.searchParams), method: request.method, body });
  let data;
  if (url.pathname === "/api/users/me") data = barista;
  else if (url.pathname === "/api/users/me/avatar") {
    barista.avatarUrl = request.method === "DELETE" ? null : "https://images.example.test/avatars/self.png";
    data = barista;
  } else if (url.pathname === "/api/admin/admins") data = request.method === "POST" ? { ...admin, ...body } : page([admin]);
  else if (url.pathname === "/api/admin/baristas") data = request.method === "POST" ? { ...barista, ...body } : page([barista]);
  else if (url.pathname === `/api/admin/admins/${admin.id}/avatar` || url.pathname === `/api/admin/baristas/${barista.id}/avatar`) {
    const member = url.pathname.includes("/admins/") ? admin : barista;
    member.avatarUrl = `https://images.example.test/avatars/${member.id}.png`;
    data = member;
  } else if (url.pathname === "/api/admin/reports/daily") {
    const date = url.searchParams.get("date");
    if (date === failDate) return Response.json({ message: "Report unavailable" }, { status: 503 });
    data = { date, totalOrders: 300, cashTotal: 900, bakongTotal: 100, grandTotal: 1000, baristas: [] };
  } else if (url.pathname === "/api/barista/reports/daily") {
    data = { baristaId: "barista", baristaName: "Contract barista", date: url.searchParams.get("date"), totalOrders: 2, cashTotal: 8, bakongTotal: 4, grandTotal: 12 };
  } else if (url.pathname.startsWith("/api/admin/finance/")) data = finance;
  else if (url.pathname === "/api/admin/users") {
    if (failUsers) return Response.json({ message: "Directory unavailable" }, { status: 503 });
    data = page([user], Number(url.searchParams.get("page") ?? 1));
  } else if (url.pathname === `/api/admin/users/${user.id}`) {
    if (request.method === "PATCH") { Object.assign(user, body); data = user; }
    else if (request.method === "DELETE") { user.status = "DELETED"; data = null; }
    else data = user;
  } else if (url.pathname === `/api/admin/orders/${orderId}/history`) data = history;
  else if (url.pathname === `/api/admin/attendance/${attendanceId}/history`) data = [{ ...history[0], attendanceId, action: "CHECK_IN" }];
  else if (url.pathname === "/api/admin/attendance") data = page([{ id: attendanceId, baristaName: "Contract staff", open: true, checkInAt: "2026-09-09T08:00:00" }]);
  else if (url.pathname === "/api/admin/inventory/low-stock" || url.pathname === "/api/admin/inventory") data = page([{ productId, quantityOnHand: 2, reorderLevel: 5 }]);
  else if (url.pathname === `/api/admin/inventory/${productId}/movements`) data = page([{ id: "movement", productId }]);
  else if (url.pathname === "/api/admin/products") data = page([{ ...product, variants }]);
  else if (url.pathname === `/api/admin/products/${productId}`) data = { ...product, variants };
  else if (url.pathname === `/api/admin/products/${productId}/discount`) {
    if (request.method === "DELETE") { product.discountType = null; product.discountValue = null; }
    else { product.discountType = body.discountType; product.discountValue = body.discountValue; }
    applyDiscount();
    data = { ...product, variants };
  } else if (url.pathname === `/api/admin/products/${productId}/variants`) {
    if (request.method === "POST") { const variant = { id: "variant1", productId, status: "ACTIVE", finalPrice: body.price, ...body }; variants.push(variant); data = variant; }
    else data = variants;
  } else if (url.pathname === `/api/admin/products/${productId}/variants/variant1`) {
    if (request.method === "DELETE") { variants = variants.filter((v) => v.id !== "variant1"); data = null; }
    else { variants[1] = { ...variants[1], ...body }; data = variants[1]; }
  }
  else if (url.pathname === `/api/admin/orders/${orderId}/collect-cash` || url.pathname === `/api/barista/orders/${orderId}/pay/cash`) {
    // Mirrors the real API's @NotNull on CashPaymentRequest.currency — a regression guard
    // against the "Currency is required" bug (currency silently missing from the request body).
    if (!body.currency) throw new Error(`${url.pathname}: currency is required`);
    data = { ...order, status: "COMPLETED" };
  }
  else if (["/api/admin/orders", "/api/admin/orders/awaiting-pickup", "/api/admin/orders/awaiting-bakong-confirmation", "/api/admin/orders/awaiting-delivery-fee"].includes(url.pathname)) data = page([order]);
  else if (url.pathname === "/api/admin/feedback") data = page([feedback]);
  else if (url.pathname === `/api/admin/feedback/${feedback.id}/status`) { feedback = { ...feedback, status: body.status }; data = feedback; }
  else if (url.pathname === "/api/auth/resend-otp") data = null;
  else throw new Error(`Unexpected contract request: ${request.method} ${url.pathname}`);
  return Response.json({ status: 200, message: "Success", data });
};

const { makeStore } = require("../src/store/index.ts");
const { baseApi } = require("../src/store/api/baseApi.ts");
const { reportApi } = require("../src/store/api/reportApi.ts");
const { orderApi } = require("../src/store/api/orderApi.ts");
const { baristaOrderApi } = require("../src/store/api/baristaOrderApi.ts");
const { inventoryApi } = require("../src/store/api/inventoryApi.ts");
const { productApi } = require("../src/store/api/productApi.ts");
const { userApi } = require("../src/store/api/userApi.ts");
const { attendanceApi } = require("../src/store/api/attendanceApi.ts");
const { authApi } = require("../src/store/api/authApi.ts");
const { contactApi } = require("../src/store/api/contactApi.ts");
const { shopDate, trailingDates } = require("../src/lib/shopDate.ts");
const { canAccessAdminPage, adminHome } = require("../src/lib/adminAccess.ts");
const store = makeStore();
const query = (endpoint, args) => store.dispatch(endpoint.initiate(args));

function verifyRuntimeImports() {
  const visited = new Set();
  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    assert.ok(!file.endsWith(".mock.ts"), `Runtime still imports sample data: ${file}`);
    for (const entry of ts.preProcessFile(fs.readFileSync(file, "utf8"), true).importedFiles) {
      const name = entry.fileName;
      if (!name.startsWith("@/") && !name.startsWith(".")) continue;
      const candidate = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(file), name);
      const resolved = [candidate, ...[".ts", ".tsx", ".js", "/index.ts", "/index.tsx"].map((suffix) => candidate + suffix)].find((target) => fs.existsSync(target) && fs.statSync(target).isFile());
      if (resolved && /\.[jt]sx?$/.test(resolved)) visit(resolved);
    }
  }
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/^(page|layout)\.tsx$/.test(entry.name)) visit(file);
    }
  }
  walk(path.join(root, "src", "app"));
}

async function verify() {
  verifyRuntimeImports();
  const newStaff = { fullName: "New staff", email: "new-staff@example.test", password: "StaffTest!234" };
  for (const [endpoint, resource, expectedRole] of [
    [userApi.endpoints.createAdmin, "admins", "ADMIN"],
    [userApi.endpoints.createBarista, "baristas", "BARISTA"],
  ]) {
    const created = await query(endpoint, newStaff).unwrap();
    assert.equal(created.role, expectedRole);
    assert.deepEqual(calls.find((call) => call.path === `/api/admin/${resource}` && call.method === "POST").body, newStaff);
  }
  const staffSubscriptions = [query(userApi.endpoints.listAdmins), query(userApi.endpoints.listBaristas), query(authApi.endpoints.getCurrentUser)];
  await Promise.all(staffSubscriptions.map((subscription) => subscription.unwrap()));
  const photo = new File([new Uint8Array([137, 80, 78, 71])], "profile.png", { type: "image/png" });
  for (const member of [admin, barista]) {
    const uploaded = await query(userApi.endpoints.uploadStaffAvatar, { id: member.id, role: member.role, file: photo }).unwrap();
    await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));
    const path = `/api/admin/${member.role === "ADMIN" ? "admins" : "baristas"}/${member.id}/avatar`;
    const sent = calls.find((call) => call.path === path);
    assert.equal(sent.method, "POST");
    assert.deepEqual(sent.body.file, { name: "profile.png", type: "image/png", bytes: [137, 80, 78, 71] });
    const endpoint = member.role === "ADMIN" ? userApi.endpoints.listAdmins : userApi.endpoints.listBaristas;
    assert.equal(endpoint.select()(store.getState()).data.content[0].avatarUrl, uploaded.avatarUrl);
  }
  for (const [endpoint, arg, expectedPhoto] of [
    [authApi.endpoints.uploadAvatar, photo, "https://images.example.test/avatars/self.png"],
    [authApi.endpoints.removeAvatar, undefined, null],
  ]) {
    await query(endpoint, arg).unwrap();
    await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));
    assert.equal(userApi.endpoints.listBaristas.select()(store.getState()).data.content[0].avatarUrl, expectedPhoto);
    assert.equal(authApi.endpoints.getCurrentUser.select()(store.getState()).data.avatarUrl, expectedPhoto);
  }
  assert.equal(shopDate(new Date("2026-09-08T18:00:00Z")), "2026-09-09");
  assert.deepEqual(trailingDates("2026-01-02", 3), ["2025-12-31", "2026-01-01", "2026-01-02"]);
  const weekly = await query(reportApi.endpoints.getWeeklyReports, "2026-09-09").unwrap();
  assert.equal(weekly.length, 7);
  assert.equal(weekly.reduce((total, day) => total + day.grandTotal, 0), 7000);
  assert.deepEqual(weekly.map((day) => day.date), ["2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09"]);
  failDate = "2026-09-10";
  const failedWeek = await query(reportApi.endpoints.getWeeklyReports, failDate);
  assert.equal(failedWeek.error.status, 503);
  assert.equal(failedWeek.data, undefined, "A missing day must not produce a partial sales total");
  failDate = undefined;

  const customers = await query(userApi.endpoints.listUsers, { role: "CUSTOMER", page: 2, size: 10 }).unwrap();
  assert.equal(customers.page, 2);
  assert.equal(customers.totalElements, 11);
  assert.equal(customers.content[0].email, user.email);
  assert.deepEqual(calls.find((call) => call.path === "/api/admin/users").params, { role: "CUSTOMER", page: "2", size: "10" });
  failUsers = true;
  const failedDirectory = await query(userApi.endpoints.listUsers, { role: "CUSTOMER", page: 1, size: 10 });
  assert.equal(failedDirectory.error.status, 503);
  assert.equal(failedDirectory.data, undefined);
  failUsers = false;

  await query(userApi.endpoints.updateUser, { id: user.id, body: { fullName: "Updated customer", phoneNumber: "" } }).unwrap();
  await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));
  assert.deepEqual(calls.find((call) => call.path === `/api/admin/users/${user.id}` && call.method === "PATCH").body, { fullName: "Updated customer", phoneNumber: "" });
  assert.equal(userApi.endpoints.listUsers.select({ role: "CUSTOMER", page: 2, size: 10 })(store.getState()).data.content[0].fullName, "Updated customer");
  await query(userApi.endpoints.deleteUser, user.id).unwrap();
  await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));
  assert.ok(calls.some((call) => call.path === `/api/admin/users/${user.id}` && call.method === "DELETE"));
  assert.equal(userApi.endpoints.listUsers.select({ role: "CUSTOMER", page: 2, size: 10 })(store.getState()).data.content[0].status, "DELETED");

  const ownReport = await query(reportApi.endpoints.getOwnDailyReport, { date: "2026-09-09" }).unwrap();
  assert.equal(ownReport.grandTotal, 12);
  assert.deepEqual(calls.find((call) => call.path === "/api/barista/reports/daily").params, { date: "2026-09-09" });

  assert.equal((await query(orderApi.endpoints.getOrderHistory, orderId).unwrap())[0].actorName, "Contract staff");
  assert.equal((await query(attendanceApi.endpoints.listAttendance, { page: 1, size: 10 }).unwrap()).content[0].id, attendanceId);
  assert.equal((await query(attendanceApi.endpoints.getAttendanceHistory, attendanceId).unwrap())[0].action, "CHECK_IN");
  await query(authApi.endpoints.resendOtp, { purpose: "LOGIN", loginTicket: "fixture-ticket" }).unwrap();
  assert.deepEqual(calls.find((call) => call.path === "/api/auth/resend-otp").body, { purpose: "LOGIN", loginTicket: "fixture-ticket" });

  const subscriptions = [
    query(orderApi.endpoints.listOrders, { status: "PENDING", page: 1, size: 5 }),
    query(orderApi.endpoints.listAwaitingPickup, { page: 1, size: 10 }),
    query(orderApi.endpoints.listAwaitingBakongConfirmation, { page: 1, size: 10 }),
    query(orderApi.endpoints.listAwaitingDeliveryFee, { page: 1, size: 10 }),
    query(inventoryApi.endpoints.listLowStock, { page: 1, size: 5 }),
    query(inventoryApi.endpoints.listStockMovements, { productId, page: 1, size: 10 }),
    query(productApi.endpoints.listProducts, { page: 1, size: 10 }),
    query(reportApi.endpoints.getDailyFinance, { date: "2026-09-09" }),
  ];
  await Promise.all(subscriptions.map((subscription) => subscription.unwrap()));
  // Regression guard: this dedicated queue (a delivery order with no fee quoted yet has no
  // paymentMethod, so it never shows up in the pickup/Bakong queues above) went unused by the
  // frontend even though the API had it, so staff had no direct way to see who was waiting.
  assert.ok(calls.some((call) => call.path === "/api/admin/orders/awaiting-delivery-fee"));
  for (const endpoint of [orderApi.endpoints.collectCash, baristaOrderApi.endpoints.payOrderCash]) {
    const before = calls.length;
    await query(endpoint, { id: orderId, body: { currency: "USD", amountTendered: 10 } }).unwrap();
    await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));
    const refreshed = calls.slice(before).filter((call) => call.method === "GET").map((call) => call.path);
    for (const expected of ["/api/admin/orders", "/api/admin/reports/daily", "/api/barista/reports/daily", "/api/admin/finance/daily", "/api/admin/inventory/low-stock", "/api/admin/products", `/api/admin/orders/${orderId}/history`, `/api/admin/inventory/${productId}/movements`]) {
      assert.ok(refreshed.includes(expected), `Payment must refresh ${expected}`);
    }
  }
  await query(productApi.endpoints.getProduct, productId).unwrap();
  await query(productApi.endpoints.listVariants, productId).unwrap();
  await query(productApi.endpoints.setProductDiscount, { id: productId, body: { discountType: "FIXED", discountValue: 1 } }).unwrap();
  await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));
  assert.equal(productApi.endpoints.getProduct.select(productId)(store.getState()).data.variants[0].finalPrice, 3);
  await query(productApi.endpoints.clearProductDiscount, productId).unwrap();
  await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));
  assert.equal(productApi.endpoints.getProduct.select(productId)(store.getState()).data.discountType, null);
  assert.equal(productApi.endpoints.getProduct.select(productId)(store.getState()).data.variants[0].finalPrice, 4);
  await query(productApi.endpoints.createVariant, { productId, body: { name: "LARGE", price: 1.25, sortOrder: 2 } }).unwrap();
  await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));
  assert.equal(productApi.endpoints.listVariants.select(productId)(store.getState()).data[1].price, 1.25);
  await query(productApi.endpoints.updateVariant, { productId, id: "variant1", body: { status: "INACTIVE" } }).unwrap();
  await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));
  assert.equal(productApi.endpoints.listVariants.select(productId)(store.getState()).data[1].status, "INACTIVE");
  await query(productApi.endpoints.deleteVariant, { productId, id: "variant1" }).unwrap();
  await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));
  assert.equal(productApi.endpoints.listVariants.select(productId)(store.getState()).data.length, 1);
  assert.ok(canAccessAdminPage("SUPER_ADMIN", "/customers"));
  assert.ok(canAccessAdminPage("ADMIN", "/reports"));
  assert.ok(!canAccessAdminPage("ADMIN", "/users"));
  // Both admin and barista ring up walk-in sales against their own endpoint pair
  // (/api/admin/orders vs /api/barista/orders) — POS is a staffed till, not barista-only.
  assert.ok(canAccessAdminPage("ADMIN", "/pos"));
  assert.ok(canAccessAdminPage("SUPER_ADMIN", "/pos"));
  assert.ok(canAccessAdminPage("BARISTA", "/pos"));
  assert.ok(canAccessAdminPage("BARISTA", "/stock-alerts"));
  for (const route of ["/categories", "/products", "/products/", "/inventory", "/inventory/record", "/reports", "/attendance"]) {
    assert.ok(canAccessAdminPage("BARISTA", route), `Barista must access ${route}`);
  }
  for (const route of ["/products/create", "/products/record/configuration", "/staff", "/users", "/customers", "/payments", "/events", "/orders", "/audit-logs"]) {
    assert.ok(!canAccessAdminPage("BARISTA", route), `Barista must not access ${route}`);
  }
  for (const role of [undefined, "CUSTOMER"]) {
    for (const route of ["/categories", "/products", "/inventory", "/reports", "/attendance", "/users"]) {
      assert.ok(!canAccessAdminPage(role, route));
    }
  }
  assert.ok(!canAccessAdminPage("CUSTOMER", "/"));
  assert.equal(adminHome("BARISTA"), "/barista-queue");

  // Regression guard: this screen was built against a path that never existed on the API
  // (/api/admin/contact-messages, status "RECEIVED") until it was corrected to the real
  // "feedback" domain (/api/admin/feedback, status "NEW") — every customer message a staff
  // member tried to read 403'd until this was fixed.
  const beforeList = calls.length;
  const feedbackList = await query(contactApi.endpoints.listContactMessages, { page: 1, size: 10, status: "NEW" }).unwrap();
  assert.equal(feedbackList.content[0].id, "feedback");
  assert.equal(calls[beforeList].path, "/api/admin/feedback");
  assert.equal(calls[beforeList].params.status, "NEW");
  const beforeUpdate = calls.length;
  const resolved = await query(contactApi.endpoints.updateContactStatus, { id: "feedback", status: "RESOLVED" }).unwrap();
  assert.equal(resolved.status, "RESOLVED");
  // The mutation's own call, not whatever cache-invalidation refetch it triggers afterward.
  assert.equal(calls[beforeUpdate].path, "/api/admin/feedback/feedback/status");
  assert.equal(calls[beforeUpdate].method, "PATCH");

  console.log("PASS: staff/self photo multipart uploads and cache refresh, report totals/dates/errors, own barista reports, user updates/deletion and cache refresh, customer pagination/filter/errors, audit history, OTP resend, payment-driven cache refresh, size CRUD, product discounts, staff navigation roles, customer feedback inbox.");
}

verify().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => store.dispatch(baseApi.util.resetApiState()));
