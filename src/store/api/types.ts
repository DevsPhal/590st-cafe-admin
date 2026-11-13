// This file contains TypeScript interfaces and types that mirror the API's request and response structures. It is used for type safety in the frontend code, ensuring that the data sent to and received from the API matches the expected formats.
export interface ApiEnvelope<T> {
  status: string;
  message: string;
  data: T;
  timeStamp: string;
}

/** The `ErrorResponse` body returned by GlobalExceptionHandler. */
export interface ApiErrorBody {
  status: string;
  message: string;
  path: string;
  timeStamp: string;
}

/** `PageResponse<T>` — note `page` is 1-based, unlike Spring Data's internal 0-based page. */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

/** Standard page/size query accepted by every list endpoint. */
export interface PageQuery {
  page?: number;
  size?: number;
}

/** Java BigDecimal serialises as a JSON number. */
export type Numeric = number;

export type UUID = string;

// ---- enums (org.group1.coffeeshopapi.common.enums) ----

export type Role = "ADMIN" | "BARISTA" | "CUSTOMER" | "SUPER_ADMIN";
export type Status = "ACTIVE" | "INACTIVE";
export type UserStatus =
  | "ACTIVE"
  | "PENDING_VERIFICATION"
  | "DEACTIVATED"
  | "SUSPENDED"
  | "BANNED"
  | "DELETED";
export type Gender = "MALE" | "FEMALE" | "OTHER";
// ---- auth ----
export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PREPARING"
  // Delivery orders only: dispatched to a courier, then confirmed as arrived.
  | "OUT_FOR_DELIVERY"
  | "COMPLETED"
  | "DELIVERED"
  | "CANCELLED";
export type PaymentMethod = "CASH" | "BAKONG";
export type FulfillmentMethod = "PICKUP" | "DELIVERY";
export type DiscountType = "PERCENTAGE" | "FIXED";
export type Currency = "USD" | "KHR";
export type StockMovementType = "STOCK_IN" | "STOCK_OUT";
export type StockStrategy = "FIFO" | "LIFO";
/** How a product is counted in stock — a purchase unit, not what the customer orders in. */
export type StockUnit = "PACK" | "BOX" | "CARTON" | "PIECE";
/** What the customer actually orders in — independent of how the stock room counts it. */
export type SellUnit =
  | "PLATE"
  | "BOTTLE"
  | "CAN"
  | "CUP"
  | "CARTON"
  | "PACKAGE"
  | "TANK"
  | "PIECE";
// ---- catalog ----
export type CategoryGroup = "FRESH_DRINK" | "BEVERAGE" | "SNACK";
/** The fixed set of names a product variant can have — a closed list, not free text. */
export type VariantLabel = "MEDIUM" | "LARGE" | "PIECE";
export type SugarLevel =
  | "ZERO"
  | "TWENTY_FIVE"
  | "FIFTY"
  | "SEVENTY_FIVE"
  | "HUNDRED";
export type IceLevel = SugarLevel;
export type MilkType =
  | "NONE"
  | "WHOLE_MILK"
  | "SKIM_MILK"
  | "OAT_MILK"
  | "ALMOND_MILK"
  | "SOY_MILK"
  | "CONDENSED_MILK";
export type OrderAuditAction =
  | "CREATED"
  | "CASH_COLLECTED"
  | "BAKONG_CONFIRMED"
  | "CANCELLED"
  | "DELIVERY_FEE_SET"
  | "CASH_SELECTED"
  | "BAKONG_QR_GENERATED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "COMPLETED";

// ---- auth ----

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  /** Milliseconds. */
  expiresIn: number;
  expiresInReadable: string;
}

//---- auth ----
export interface LoginResponse {
  otpRequired: boolean;
  loginTicket: string | null;
  tokens: AuthTokenResponse | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Staff invited over Telegram sign in by phone; the code goes to their linked Telegram chat. */
export interface PhoneLoginRequest {
  phoneNumber: string;
}

export interface VerifyLoginOtpRequest {
  loginTicket: string;
  otp: string;
}

// ---- user / staff ----

export interface UserResponse {
  id: UUID;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  gender: Gender | null;
  role: Role;
  status: UserStatus;
  telegramLinked: boolean;
  createdBy: UUID | null;
  createdByName: string | null;
  createdByRole: Role | null;
}

/** Self-service edit of the signed-in account — `PATCH /api/users/me`. */
export interface UpdateProfileRequest {
  fullName?: string;
  phoneNumber?: string;
  gender?: Gender;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface CreateStaffRequest {
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  gender?: Gender;
}

export interface UpdateStaffRequest {
  fullName?: string;
  phoneNumber?: string;
  gender?: Gender;
  status?: UserStatus;
}

// ---- invite staff / telegram ----
export interface InviteStaffRequest {
  fullName: string;
  phoneNumber: string;
  gender?: Gender;
}

export interface TelegramLinkCodeResponse {
  code: string;
  expiresInSeconds: number;
  deepLink: string;
}

/**
 * The signed payload Telegram's Login Widget hands back, posted as-is to /api/auth/login/telegram
 * (the API verifies `hash` against the bot token). Optional fields are omitted when Telegram
 * didn't send them.
 */
export interface TelegramWidgetAuthRequest {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// ---- category ----

export interface CategoryResponse {
  id: UUID;
  name: string;
  description: string | null;
  status: Status;
  // Null on an internal category (e.g. stock-in materials) that customers never order from.
  categoryGroup: CategoryGroup | null;
  createdBy: UUID | null;
  createdByName: string | null;
  createdByRole: Role | null;
  updatedBy: UUID | null;
  updatedByName: string | null;
  updatedByRole: Role | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  // Leave unset for an internal category customers never order from directly.
  categoryGroup?: CategoryGroup;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  status?: Status;
  categoryGroup?: CategoryGroup;
}

// ---- product ----
//
// A product carries no price of its own — every price lives on one of its variants
// (ProductVariantResponse). A product needs at least one variant before it can be sold.
// `discountType`/`discountValue` still live on the product and apply as a modifier on top of
// each variant's own price to produce that variant's `finalPrice`.

export interface ProductVariantResponse {
  id: UUID;
  productId: UUID;
  name: VariantLabel;
  price: Numeric;
  finalPrice: Numeric;
  sortOrder: number | null;
  status: Status;
}

export interface CreateProductVariantRequest {
  name: VariantLabel;
  price: Numeric;
  sortOrder?: number;
}

export interface UpdateProductVariantRequest {
  name?: VariantLabel;
  price?: Numeric;
  sortOrder?: number;
  status?: Status;
}

/** One extra (e.g. Pearl) offered on one product — the attachment, not the extra itself. */
export interface ProductExtraResponse {
  id: UUID;
  productId: UUID;
  extraId: UUID;
  name: string;
  price: Numeric;
  sortOrder: number | null;
  status: Status;
  /** Null means untracked (always available); hidden from customers once it hits zero. */
  quantityOnHand: Numeric | null;
  /** Flattened from the underlying Extra — shown next to the add-on choice. Manage the photo
   * itself via the catalog Extra's own image endpoints, not through this attachment. */
  imageUrl: string | null;
}

export interface AttachProductExtraRequest {
  extraId: UUID;
  sortOrder?: number;
}

export interface UpdateProductExtraRequest {
  sortOrder?: number;
  status?: Status;
}

/** An entry in the shop-wide add-on catalog (e.g. Pearl) — see ProductExtraResponse to offer
 * one on a specific product. */
export interface ExtraResponse {
  id: UUID;
  name: string;
  price: Numeric;
  status: Status;
  quantityOnHand: Numeric | null;
  /** Shown next to the add-on choice so customers can see what they're adding. Set via
   * POST/DELETE /api/admin/extras/{id}/image, not through create/update. */
  imageUrl: string | null;
}

export interface CreateExtraRequest {
  name: string;
  price: Numeric;
  /** Omit for an untracked extra that's always available. */
  quantityOnHand?: Numeric;
}

export interface UpdateExtraRequest {
  name?: string;
  price?: Numeric;
  status?: Status;
  quantityOnHand?: Numeric;
}

export interface ProductResponse {
  id: UUID;
  name: string;
  /** Khmer translation of the name — null if none was set. */
  nameKh: string | null;
  description: string | null;
  imageUrl: string | null;
  sku: string;
  stockUnit: StockUnit;
  sellUnit: SellUnit;
  unitsPerStock: Numeric;
  categoryId: UUID;
  categoryName: string;
  /** Which customisations (sugar/ice/milk) this product accepts, inherited from its category. */
  categoryGroup: CategoryGroup | null;
  status: Status;
  quantityOnHand: Numeric;
  reorderLevel: Numeric;
  discountType: DiscountType | null;
  discountValue: Numeric | null;
  discountStartAt: string | null;
  discountEndAt: string | null;
  discountActive: boolean;
  variants: ProductVariantResponse[];
  extras: ProductExtraResponse[];
  createdBy: UUID | null;
  createdByName: string | null;
  createdByRole: Role | null;
  updatedBy: UUID | null;
  updatedByName: string | null;
  updatedByRole: Role | null;
  createdAt: string;
  updatedAt: string;
}

/** No price here — add one or more variants after creating the product. */
export interface CreateProductRequest {
  name: string;
  nameKh?: string;
  description?: string;
  sku: string;
  stockUnit: StockUnit;
  sellUnit: SellUnit;
  unitsPerStock?: Numeric;
  categoryId: UUID;
  reorderLevel?: Numeric;
}

export interface UpdateProductRequest {
  name?: string;
  nameKh?: string;
  description?: string;
  sku?: string;
  stockUnit?: StockUnit;
  sellUnit?: SellUnit;
  unitsPerStock?: Numeric;
  categoryId?: UUID;
  status?: Status;
  reorderLevel?: Numeric;
}

export interface SetProductDiscountRequest {
  discountType: DiscountType;
  discountValue: Numeric;
  discountStartAt?: string;
  discountEndAt?: string;
}

export interface ProductImportRowError {
  rowNumber: number;
  sku: string;
  message: string;
}

/**
 * Excel columns (row 1 is the header): name, description, sku, stockUnit, price, category,
 * reorderLevel, variants, sellUnit, unitsPerStock, nameKh. `variants` is optional —
 * "MEDIUM:1.50;LARGE:1.75" sets several sizes at once and makes `price` ignored; leave it blank
 * for a single MEDIUM variant priced from `price`. `sellUnit` defaults to CUP, `unitsPerStock`
 * defaults to 1, `nameKh` is optional. Valid rows are created even if others fail.
 */
export interface ProductImportResponse {
  totalRows: number;
  created: number;
  failed: number;
  errors: ProductImportRowError[];
}

// ---- inventory ----

export interface InventoryResponse {
  productId: UUID;
  productName: string;
  unit: string;
  quantityOnHand: Numeric;
  reorderLevel: Numeric;
}

export interface StockInImportRowError {
  rowNumber: number;
  sku: string;
  message: string;
}

/** Excel columns (row 1 is the header): sku, quantity, unitCost, note. Each valid row is
 * stocked in just like a manual receipt; valid rows are still saved even if others fail. */
export interface StockInImportResponse {
  totalRows: number;
  created: number;
  failed: number;
  errors: StockInImportRowError[];
}

export interface StockMovementResponse {
  id: UUID;
  productId: UUID;
  productName: string;
  type: StockMovementType;
  strategy: StockStrategy | null;
  quantity: Numeric;
  note: string | null;
  performedBy: UUID | null;
  performedByName: string | null;
  performedByRole: Role | null;
  createdAt: string;
}

export interface BatchConsumptionResponse {
  batchId: UUID;
  quantityTaken: Numeric;
  unitCost: Numeric;
}

export interface StockCutResponse {
  movementId: UUID;
  productId: UUID;
  strategy: StockStrategy;
  quantityCut: Numeric;
  remainingOnHand: Numeric;
  consumptions: BatchConsumptionResponse[];
}

export interface StockInRequest {
  productId: UUID;
  quantity: Numeric;
  unitCost: Numeric;
  note?: string;
}

export interface StockCutRequest {
  productId: UUID;
  quantity: Numeric;
  strategy: StockStrategy;
  note?: string;
}

// ---- order ----

/** One extra (e.g. Pearl) added to an order line — unitPrice/subtotal already include its price. */
export interface OrderItemExtraResponse {
  extraId: UUID;
  name: string;
  price: Numeric;
}

export interface OrderItemResponse {
  id: UUID;
  productId: UUID;
  productName: string;
  productNameKh: string | null;
  quantity: number;
  unitPrice: Numeric;
  subtotal: Numeric;
  variantName: VariantLabel | null;
  sugarLevel: SugarLevel | null;
  iceLevel: IceLevel | null;
  milkType: MilkType | null;
  extras: OrderItemExtraResponse[];
}

export interface OrderResponse {
  id: UUID;
  handledById: UUID | null;
  handledByName: string | null;
  handledByRole: Role | null;
  customerId: UUID | null;
  customerName: string | null;
  status: OrderStatus;
  items: OrderItemResponse[];
  totalAmount: Numeric;
  // Pickup by default; DELIVERY carries the fields below. dispatchedAt/deliveredAt stay null
  // until the order actually gets there.
  fulfillmentMethod: FulfillmentMethod | null;
  deliveryAddress: string | null;
  contactName: string | null;
  contactPhone: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  paymentMethod: PaymentMethod | null;
  amountTendered: Numeric | null;
  amountTenderedCurrency: Currency | null;
  changeDue: Numeric | null;
  changeCurrency: Currency | null;
  bakongQrString: string | null;
  bakongMd5Hash: string | null;
  bakongCurrency: Currency | null;
  bakongAmount: Numeric | null;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
  // Where the customer pinned the drop-off — null for a pickup order, both set together or not
  // at all.
  deliveryLatitude: Numeric | null;
  deliveryLongitude: Numeric | null;
  // Null until staff sets it, even for a delivery order — already folded into totalAmount once set.
  deliveryFee: Numeric | null;
  // Stamped the moment staff set the fee — the canonical "has this been quoted yet" flag (what
  // /awaiting-delivery-fee actually filters on), distinct from deliveryFee being null because a
  // legitimate $0 fee would otherwise look unset if code checked deliveryFee alone.
  deliveryFeeSetAt: string | null;
  // Straight-line distance from the shop to the pin — null for pickup, or if the shop's own
  // location isn't configured (Settings).
  distanceMeters: Numeric | null;
}

/** Pushed to every staff member on `/topic/orders` the instant an order changes. */
export interface OrderUpdateMessage {
  action: OrderAuditAction;
  order: OrderResponse;
  sentAt: string;
}

/** One open (unanswered) "call staff" press, or the result of pressing it. */
export interface StaffCallResponse {
  orderId: UUID;
  customerName: string | null;
  orderStatus: OrderStatus;
  fulfillmentMethod: FulfillmentMethod | null;
  calledAt: string;
  /** When the customer's button can be pressed again. */
  nextCallAllowedAt: string | null;
}

/** Pushed to every staff member on `/topic/staff-calls`. CALLED shows the alert on every staff
 * screen; ANSWERED clears it everywhere (answeredByName is null for CALLED). */
export interface StaffCallMessage {
  type: "CALLED" | "ANSWERED";
  orderId: UUID;
  customerName: string | null;
  orderStatus: OrderStatus;
  fulfillmentMethod: FulfillmentMethod | null;
  calledAt: string;
  answeredByName: string | null;
  sentAt: string;
}

/** A kind of data clients can watch for live changes — mirrors the API's own ResourceType. */
export type WatchedResource =
  | "PRODUCT"
  | "CATEGORY"
  | "EXTRA"
  | "INVENTORY"
  | "FEEDBACK";

export type ResourceChangeType = "CREATED" | "UPDATED" | "DELETED";

/**
 * "This changed, refetch it" — pushed on `/topic/catalog` (PRODUCT/CATEGORY/EXTRA),
 * `/topic/inventory` (INVENTORY, id is the productId) and `/topic/feedback` (FEEDBACK). Carries
 * no data, so whatever a client shows still comes from the normal REST endpoints and their own
 * permission checks — this is only a signal to go refetch.
 */
export interface ResourceChangeMessage {
  resource: WatchedResource;
  id: UUID;
  change: ResourceChangeType;
  sentAt: string;
}

export interface OrderAuditLogResponse {
  id: UUID;
  action: OrderAuditAction;
  actorId: UUID | null;
  actorName: string | null;
  actorRole: Role | null;
  createdAt: string;
}

export interface OrderItemRequest {
  productId: UUID;
  quantity: number;
  /** Pick a variant by id or by name; variantId wins if both are given. */
  variantId?: UUID;
  variantName?: VariantLabel;
  sugarLevel?: SugarLevel;
  iceLevel?: IceLevel;
  milkType?: MilkType;
  /** Extras (e.g. Pearl) to add. Omit or leave empty for none. */
  extraIds?: UUID[];
}

export interface CreateOrderRequest {
  items: OrderItemRequest[];
  note?: string;
}

export interface CashPaymentRequest {
  /** Which currency the tendered amount is in — the API rejects the request without it. */
  currency: Currency;
  amountTendered: Numeric;
  /** Defaults to `currency` server-side; set only to give change back in the other currency. */
  changeCurrency?: Currency;
}

export interface DeliveryFeeRequest {
  fee: Numeric;
}

export interface BakongQrResponse {
  orderId: UUID;
  qrString: string;
  md5Hash: string;
  // Already converted for `currency` — a KHR code carries whole riel, not the order's USD total.
  amount: Numeric;
  currency: Currency;
  expiresAt: string;
  /** The same deadline as `expiresAt`, but as a duration — no clock/timezone reconciliation. */
  expiresInSeconds: number;
}

// ---- event ----

export interface EventResponse {
  id: UUID;
  title: string;
  description: string | null;
  imageUrl: string | null;
  // GPS pin for the event's venue. Optional — either both set or both null, never one alone.
  latitude: Numeric | null;
  longitude: Numeric | null;
  startAt: string;
  endAt: string;
  status: Status;
  createdBy: UUID | null;
  createdByName: string | null;
  createdByRole: Role | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  /** Must be given together, or both omitted for an event with no fixed venue. */
  latitude?: Numeric;
  longitude?: Numeric;
  /** ISO local date-time, e.g. "2026-09-09T08:00:00". */
  startAt: string;
  endAt: string;
}

export interface UpdateEventRequest {
  title?: string;
  description?: string;
  /** Must be given together, or both omitted to leave the venue pin unchanged. */
  latitude?: Numeric;
  longitude?: Numeric;
  startAt?: string;
  endAt?: string;
  status?: Status;
}

// ---- banner ----

/** A storefront homepage slide. ACTIVE banners show there in ascending `sortOrder`. */
export interface BannerResponse {
  id: UUID;
  title: string;
  imageUrl: string | null;
  /** Where tapping the slide goes — a storefront path ("/menu") or a full URL. */
  linkUrl: string | null;
  sortOrder: number;
  status: Status;
  adminId: UUID | null;
  adminName: string | null;
  adminRole: Role | null;
  updatedByAdminId: UUID | null;
  updatedByAdminName: string | null;
  updatedByAdminRole: Role | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBannerRequest {
  title: string;
  linkUrl?: string;
  sortOrder?: number;
}

export interface UpdateBannerRequest {
  title?: string;
  linkUrl?: string;
  sortOrder?: number;
  status?: Status;
}

// ---- reports & finance ----

export interface DailyReportResponse {
  baristaId: UUID;
  baristaName: string;
  date: string;
  totalOrders: number;
  cashTotal: Numeric;
  bakongTotal: Numeric;
  grandTotal: Numeric;
}

export interface AdminDailyReportResponse {
  date: string;
  totalOrders: number;
  cashTotal: Numeric;
  bakongTotal: Numeric;
  grandTotal: Numeric;
  baristas: DailyReportResponse[];
}

export interface FinanceSummaryResponse {
  periodStart: string;
  periodEnd: string;
  cashIn: Numeric;
  bakongIn: Numeric;
  totalIn: Numeric;
  totalOut: Numeric;
  profit: Numeric;
}

// ---- settings ----

export interface BakongExchangeRateResponse {
  khrPerUsdRate: Numeric;
  marketRate: Numeric | null;
  updatedByAdminId: UUID | null;
  updatedByAdminName: string | null;
  updatedByAdminRole: Role | null;
  updatedAt: string;
}

export interface UpdateBakongExchangeRateRequest {
  khrPerUsdRate: Numeric;
  marketRate?: Numeric;
}
