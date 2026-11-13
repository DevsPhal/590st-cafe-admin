/* Render real screens and controls with fixture queries; no server or shop data is used. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
const noop = () => {};
let role = "BARISTA";
let queryCalls = [];
let reportError;
let mutationHandler;
const product = { id: "product", name: "Fixture Coffee", sku: "COFFEE", stockUnit: "PIECE", sellUnit: "CUP", unitsPerStock: 1, categoryId: "category", categoryName: "Fixture Category", quantityOnHand: 10, reorderLevel: 2, status: "ACTIVE", variants: [{ id: "variant", productId: "product", name: "MEDIUM", price: 4, finalPrice: 4, sortOrder: 0, status: "ACTIVE" }], extras: [] };
const category = { id: "category", name: "Fixture Category", status: "ACTIVE", createdAt: "2026-09-09T08:00:00" };
const inventory = { productId: "product", productName: "Fixture Coffee", quantityOnHand: 10, reorderLevel: 2, unit: "cup" };
const paged = (item) => ({ content: [item], page: 1, size: 10, totalElements: 1, totalPages: 1 });
const fixtures = {
  useListProductsQuery: paged(product),
  useListCategoriesQuery: paged(category),
  useListInventoryQuery: paged(inventory),
  useListBaristasQuery: paged({ id: "barista", fullName: "Fixture Staff", email: "staff@example.test", role: "BARISTA", status: "ACTIVE", avatarUrl: "/images/staff-photo.png" }),
  useGetOwnDailyReportQuery: { totalOrders: 2, cashTotal: 8, bakongTotal: 4, grandTotal: 12 },
  useGetDailyReportQuery: { totalOrders: 100, grandTotal: 400, baristas: [] },
  useGetDailyFinanceQuery: { totalIn: 400, totalOut: 100, profit: 300 },
};

Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(this, name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : name, ...args);
};
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, file);
}

Module._load = function (name, ...args) {
  if (name === "react-hot-toast") return { __esModule: true, default: { success: noop, error: noop } };
  if (name === "@/store/api/useCurrentRole") return { useCurrentRole: () => ({ role, isAdmin: role === "ADMIN" || role === "SUPER_ADMIN", isBarista: role === "BARISTA" }) };
  if (name === "@/contexts/AdminPreferencesContext") return { usePageSize: () => [10, noop], useRefreshOptions: () => ({}) };
  if (name === "@/contexts/SidebarCollapseContext") return { useSidebarCollapse: () => ({ isCollapsed: false, toggleSidebar: noop }) };
  if (name === "@/contexts/I18nContext") return { useI18n: () => ({ locale: "en", t: (key) => key, setLocale: noop }) };
  if (name === "next/navigation") return { useRouter: () => ({ push: noop }), usePathname: () => "/" };
  if (name.startsWith("@/store/api/")) return new Proxy({}, {
    get(_target, hook) {
      if (hook === "apiErrorMessage") return (error, fallback) => error?.data?.message ?? fallback;
      if (typeof hook !== "string" || !hook.startsWith("use")) return undefined;
      if (hook.endsWith("Mutation")) return () => [(args) => {
        if (!mutationHandler) throw new Error("Rendering must not mutate data");
        return { unwrap: () => mutationHandler(hook, args) };
      }, {}];
      return (_params, options) => {
        if (!options?.skip) queryCalls.push(hook);
        const data = fixtures[hook];
        return { data, currentData: data, isSuccess: true, isFetching: false, refetch: noop,
          error: hook === "useGetOwnDailyReportQuery" ? reportError : undefined };
      };
    },
  });
  const loaded = originalLoad.call(this, name, ...args);
  // The notification menu is unrelated to the tested permissions; retain all real table controls.
  if (name === "@/components/common/AdminKit") return { ...loaded, AdminTopActions: () => null };
  return loaded;
};

const screens = [
  ["category/components/CategoryManagementView", "Register", true],
  ["product/components/ProductManagementView", "Register", true],
  ["inventory/components/InventoryManagementView", "Adjust Stock", false],
];
for (const [file, action, canDelete] of screens) {
  const Screen = require(path.join(root, "src/features", `${file}.tsx`)).default;
  for (const staffRole of ["BARISTA", "ADMIN", "SUPER_ADMIN"]) {
    role = staffRole;
    const html = renderToStaticMarkup(React.createElement(Screen));
    assert.match(html, /aria-label="View"/, `${staffRole} must be able to view ${file}`);
    if (staffRole === "BARISTA") {
      assert.doesNotMatch(html, /aria-label="(?:Edit|Delete)"/);
      assert.ok(!html.includes(action), `Barista must not see ${action}`);
    } else {
      assert.match(html, /aria-label="Edit"/);
      assert.ok(html.includes(action));
      if (canDelete) assert.match(html, /aria-label="Delete"/);
    }
  }
}

const Reports = require("../src/features/report/components/ReportView.tsx").default;
for (const staffRole of ["BARISTA", "ADMIN", "SUPER_ADMIN", "CUSTOMER", undefined]) {
  role = staffRole;
  queryCalls = [];
  const html = renderToStaticMarkup(React.createElement(Reports));
  if (staffRole === "BARISTA") {
    assert.deepEqual(queryCalls, ["useGetOwnDailyReportQuery"]);
    assert.match(html, /My Daily Report/);
    assert.match(html, /\$12\.00/);
    assert.doesNotMatch(html, /Profit|Money Out|Finance Period/);
  } else if (staffRole === "ADMIN" || staffRole === "SUPER_ADMIN") {
    assert.deepEqual(queryCalls, ["useGetDailyReportQuery", "useGetDailyFinanceQuery"]);
    assert.match(html, /Profit/);
  } else {
    assert.deepEqual(queryCalls, []);
    assert.equal(html, "");
  }
}
role = "BARISTA";
reportError = { status: 503, data: { message: "Report unavailable" } };
const errorHtml = renderToStaticMarkup(React.createElement(Reports));
assert.match(errorHtml, /Report unavailable/);
assert.doesNotMatch(errorHtml, /\$12\.00/);
const Staff = require("../src/features/staff/components/StaffManagementView.tsx").default;
role = "SUPER_ADMIN";
queryCalls = [];
const superAdminStaffHtml = renderToStaticMarkup(React.createElement(Staff));
assert.match(superAdminStaffHtml, /Add Admin/);
assert.match(superAdminStaffHtml, /Add Barista/);
assert.deepEqual(queryCalls, ["useListBaristasQuery"], "Opening the default barista list must still expose both creation actions");
role = "ADMIN";
const staffHtml = renderToStaticMarkup(React.createElement(Staff));
assert.match(staffHtml, /Add Barista/);
assert.doesNotMatch(staffHtml, /Add Admin/);
assert.match(staffHtml, /staff-photo\.png/);
assert.match(staffHtml, /Fixture Staff/);
fixtures.useListBaristasQuery.content[0].avatarUrl = null;
const staffFallbackHtml = renderToStaticMarkup(React.createElement(Staff));
assert.doesNotMatch(staffFallbackHtml, /staff-photo\.png/);
assert.match(staffFallbackHtml, />F<\/span>/);

// Exercise the Staff form's actual event handlers with persistent hook state and fixture mutations.
// Child UI components remain React elements; only the Staff component's hooks need this harness.
async function verifyStaffCreation() {
  const originals = { useState: React.useState, useRef: React.useRef, useMemo: React.useMemo, useEffect: React.useEffect };
  let values = [];
  let cursor = 0;
  React.useState = (initial) => {
    const index = cursor++;
    if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
    return [values[index], (next) => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
  };
  React.useRef = (initial) => React.useState(() => ({ current: initial }))[0];
  React.useMemo = (compute) => compute();
  React.useEffect = noop;
  const render = () => { cursor = 0; return Staff(); };
  // Walks every prop value, not just `children` — buttons like Staff's Add Admin/Add
  // Barista live under DataCard's `actions` prop, which is a sibling of `children`, not
  // part of it.
  function find(node, match) {
    if (!node || typeof node !== "object") return undefined;
    if (Array.isArray(node)) return node.map((child) => find(child, match)).find(Boolean);
    if (match(node)) return node;
    if (!node.props) return undefined;
    for (const value of Object.values(node.props)) {
      const result = find(value, match);
      if (result) return result;
    }
    return undefined;
  }
  const input = (label) => find(render(), (element) => element.props?.label === label);
  try {
    role = "SUPER_ADMIN";
    for (const [button, targetRole, expectedHook] of [
      ["Add Admin", "ADMIN", "useCreateAdminMutation"],
      ["Add Barista", "BARISTA", "useCreateBaristaMutation"],
    ]) {
      values = [];
      const sent = [];
      mutationHandler = async (hook, args) => {
        sent.push({ hook, args });
        return { id: "created-staff", ...args, role: targetRole, status: "ACTIVE", avatarUrl: null };
      };
      find(render(), (element) => element.props?.primaryLabel === button).props.onRegister();
      assert.equal(input("Account Role").props.value, targetRole);
      input("Full Name").props.onChange({ target: { value: "New Staff" } });
      input("Email").props.onChange({ target: { value: "new@example.test" } });
      input("Password").props.onChange({ target: { value: "StaffTest!234" } });
      const form = find(render(), (element) => element.props?.title === `Register ${targetRole === "ADMIN" ? "Admin" : "Barista"}`);
      await form.props.onSubmit();
      assert.equal(sent.length, 1);
      assert.equal(sent[0].hook, expectedHook);
      assert.equal(sent[0].args.email, "new@example.test");
      assert.equal(input("Staff Type").props.value, targetRole);
    }
    // Changing the account role in a new form also selects the matching creation endpoint.
    values = [];
    const sent = [];
    mutationHandler = async (hook, args) => { sent.push(hook); return { id: "created-staff", ...args, role: "ADMIN", status: "ACTIVE" }; };
    find(render(), (element) => element.props?.primaryLabel === "Add Barista").props.onRegister();
    input("Account Role").props.onChange({ target: { value: "ADMIN" } });
    input("Full Name").props.onChange({ target: { value: "New Admin" } });
    input("Email").props.onChange({ target: { value: "new-admin@example.test" } });
    input("Password").props.onChange({ target: { value: "StaffTest!234" } });
    await find(render(), (element) => element.props?.title === "Register Admin").props.onSubmit();
    assert.deepEqual(sent, ["useCreateAdminMutation"]);
  } finally {
    Object.assign(React, originals);
    mutationHandler = undefined;
  }
  console.log("PASS: super-admin creation buttons and form submission, admin role restrictions, staff photos, barista read-only controls, role-scoped reports.");
}
verifyStaffCreation().catch((error) => { console.error(error); process.exitCode = 1; });
