# 590st CAFE

Admin dashboard for 590st CAFE.

## Local Setup

```bash
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL` to the API's browser-accessible URL before building (the local
Compose stack supplies `http://localhost:8080`). Sign in with a staff account. Super admins
can view, edit, change the status of, and delete stored user accounts; admins manage shop
operations; baristas use POS, the order queue, read-only catalog/inventory, their own reports,
and their own attendance.

## Role permissions

On **Staff**, SUPER ADMIN sees both **Add Admin** and **Add Barista** immediately. The form's
**Account Role** selects the account to create independently of the Staff Type list filter.
ADMIN sees **Add Barista** only. After saving, the list switches to the created account's role.

| Feature | SUPER ADMIN | ADMIN | BARISTA |
| --- | --- | --- | --- |
| Admin accounts | Create, view, update, delete | No access | No access |
| User accounts (including customers) | View, update, delete | No access | No access |
| Barista accounts | Create, view, update, delete | Create, view, update, delete | No access |
| Categories and products | Manage | Manage | View only |
| Inventory | View and adjust stock | View and adjust stock | View only |
| Events, banners, expenses, finance, Bakong/payment settings | Manage | Manage | No access |
| Orders | Admin order management | Admin order management | Barista orders and POS |
| Reports | Shop reports and finance | Shop reports and finance | Own daily sales |
| Attendance | Manage staff attendance | Manage staff attendance | Own check-in/out and history |

SUPER ADMIN inherits all ADMIN permissions. User deletion marks the account `DELETED`,
revokes access, and retains its history. Edit an account with the pencil action, change its
status by clicking its status badge, or delete it with the trash action. CUSTOMER permissions
remain unchanged; customer accounts cannot enter the staff dashboard. All staff retain their
own profile/preferences and operational alerts. The API enforces access independently of the UI.

Staff photos can be selected in **Staff → Add/Edit → Profile Photo** and are uploaded when
the form is submitted. The list and details show the saved photo. JPEG, PNG, WebP, and GIF
images up to 5 MB are supported. Admins can update barista photos; super admins can also
update admin photos. Each staff member can upload, replace, or remove their own photo from
**My Profile**.

Dashboard totals, customers, orders, payments, catalog, inventory, staff, events, reports,
exchange rates, and alerts read the API. Customer and order lists refresh every 30 seconds.
The audit page shows history for a selected order or attendance record. Open a product's
details and choose **Manage sizes and discount** to edit its size options and discount.

Promotion codes, loyalty points, and table plans have no backend support yet and display
an unavailable message. Product discounts are supported. Name/status filters on list pages
apply to the current page; role, category, and order-status filters are sent to the API.
The Order Queue lists one status tab at a time with live counts per tab; its search (invoice
number or customer), date range, order type, payment, and newest/oldest filters and its
paging all run on the API, and the selected tab and filters are kept for the session.

Validation:

```bash
node node_modules/typescript/bin/tsc --noEmit
node scripts/verify-api-contracts.cjs
node scripts/verify-role-views.cjs
npm run build
```

The contract check uses intercepted requests and does not write shop data. It covers report
dates and totals, API errors, customer pagination, audit history, login OTP resend, stock
and report refresh after payment, product size changes, discounts, and staff navigation.
`../deployment/verify-admin-live.cjs` additionally checks the running dashboard with the
configured super-admin account, using read-only API requests after login.
