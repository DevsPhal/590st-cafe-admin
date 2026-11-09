export interface ApiEnvelope<T> {
  status: string;
  message: string;
  data: T;
  timeStamp: string;
}

/** One invalid request field, e.g. { field: "fullName", message: "Full name is required" }. */
export interface ApiFieldError {
  field: string;
  message: string;
}

/** The API's single error shape (ErrorResponse). */
export interface ApiErrorBody {
  status: string;
  message: string;
  path: string;
  timeStamp: string;
  /** Present only when specific request fields are invalid. */
  errors?: ApiFieldError[];
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface PageQuery {
  page?: number;
  size?: number;
}

export type Numeric = number;

export type UUID = string;

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
export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "COMPLETED"
  | "DELIVERED"
  | "CANCELLED";
export type PaymentMethod = "CASH" | "BAKONG";
export type FulfillmentMethod = "PICKUP" | "DELIVERY" | "DINE_IN";
// How a POS (walk-in) order leaves the counter. Online orders have none and use FulfillmentMethod.
export type OrderType = "DINE_IN" | "TAKE_AWAY";
export type DiscountType = "PERCENTAGE" | "FIXED";
export type Currency = "USD" | "KHR";
// The language an invoice PDF is printed in; both carry the same order and amounts.
export type InvoiceLanguage = "EN" | "KH";
export type StockMovementType = "STOCK_IN" | "STOCK_OUT";
export type StockStrategy = "FIFO" | "LIFO";
// The unit stock is bought in; one holds the product's unitsPerStock sell units.
export type StockUnit = "PACK" | "BOX" | "CARTON" | "PIECE" | "BAG" | "BOTTLE" | "KILOGRAM" | "LITER";
export type SellUnit =
  | "PLATE"
  | "BOTTLE"
  | "CAN"
  | "CUP"
  | "CARTON"
  | "PACKAGE"
  | "TANK"
  | "PIECE"
  | "GRAM"
  | "MILLILITER";
// INGREDIENT: stock-only items (beans, milk, cups) that recipes use up; never sold on their own.
export type CategoryGroup = "FRESH_DRINK" | "BEVERAGE" | "SNACK" | "INGREDIENT";
export type StockMovementReason = "PURCHASE" | "SALE" | "RETURN" | "WASTE" | "ADJUSTMENT";
export type WasteReason = "EXPIRED" | "DAMAGED" | "SPILLED" | "QUALITY" | "OTHER";
export type ReportPeriod = "DAY" | "MONTH" | "YEAR";
// PACK / BOX / CARTON sell several base units at once (unitsPerSale), e.g. a carton of 24 cans.
export type VariantLabel = "MEDIUM" | "LARGE" | "PIECE" | "PACK" | "BOX" | "CARTON";
// Which unit a stock-in / stock-cut quantity is in: the stock unit it is bought in, or the sell unit stock is counted in.
export type QuantityUnit = "PURCHASE" | "BASE";
// Same values as the API's SugarLevel / IceLevel / MilkType enums.
export type SugarLevel = "ZERO" | "LESS" | "NORMAL" | "EXTRA";
export type IceLevel = "NO_ICE" | "LESS_ICE" | "NORMAL" | "EXTRA_ICE";
export type MilkType = "NONE" | "LESS" | "NORMAL" | "EXTRA";
export type OrderAuditAction =
  | "CREATED"
  | "CASH_COLLECTED"
  | "BAKONG_CONFIRMED"
  | "BAKONG_BY_RECEIPT"
  | "CANCELLED"
  | "DELIVERY_FEE_SET"
  | "ESTIMATE_SET"
  | "CASH_SELECTED"
  | "BAKONG_QR_GENERATED"
  | "LOCATION_PINNED"
  | "STAFF_CALLED"
  | "STAFF_CALL_ANSWERED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "COMPLETED";

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  expiresInReadable: string;
}

export interface LoginResponse {
  otpRequired: boolean;
  loginTicket: string | null;
  tokens: AuthTokenResponse | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface PhoneLoginRequest {
  phoneNumber: string;
}

export interface VerifyLoginOtpRequest {
  loginTicket: string;
  otp: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

export type ResendOtpRequest =
  | { purpose: "RESET_PASSWORD"; email: string }
  | { purpose: "LOGIN"; loginTicket: string };

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
  telegramUsername?: string | null;
  createdBy: UUID | null;
  createdByName: string | null;
  createdByRole: Role | null;
}

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

export interface TelegramWidgetAuthRequest {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface CategoryResponse {
  id: UUID;
  name: string;
  description: string | null;
  status: Status;
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
  categoryGroup?: CategoryGroup;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  status?: Status;
  categoryGroup?: CategoryGroup;
}

export interface ProductVariantResponse {
  id: UUID;
  productId: UUID;
  name: VariantLabel;
  price: Numeric;
  finalPrice: Numeric;
  // Base units (the product's sell unit) one sale takes from stock: 1 can, or 24 for a carton.
  unitsPerSale: number;
  sortOrder: number | null;
  status: Status;
  // How many can be sold right now: from its own stock, or from its ingredients when recipeBased.
  availableQuantity: number | null;
  recipeBased: boolean;
}

export interface CreateProductVariantRequest {
  name: VariantLabel;
  price: Numeric;
  unitsPerSale?: number;
  sortOrder?: number;
}

export interface UpdateProductVariantRequest {
  name?: VariantLabel;
  price?: Numeric;
  unitsPerSale?: number;
  sortOrder?: number;
  status?: Status;
}

export interface ProductExtraResponse {
  id: UUID;
  productId: UUID;
  extraId: UUID;
  name: string;
  price: Numeric;
  sortOrder: number | null;
  status: Status;
  quantityOnHand: Numeric | null;
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

export interface ExtraResponse {
  id: UUID;
  name: string;
  price: Numeric;
  status: Status;
  quantityOnHand: Numeric | null;
  imageUrl: string | null;
}

export interface CreateExtraRequest {
  name: string;
  price: Numeric;
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
  nameKh: string | null;
  description: string | null;
  imageUrl: string | null;
  sku: string;
  stockUnit: StockUnit;
  sellUnit: SellUnit;
  unitsPerStock: Numeric;
  categoryId: UUID;
  categoryName: string;
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

export type SkuMode = "MANUAL" | "GENERATE";

export interface CreateProductRequest {
  name: string;
  nameKh?: string;
  description?: string;
  sku?: string;
  skuMode?: SkuMode;
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
  skuMode?: SkuMode;
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

export interface SkuSuggestionResponse {
  sku: string;
  prefix: string;
  categoryName: string;
  categoryGroup: CategoryGroup | null;
  allowedVariants: VariantLabel[];
  variantSkus: Partial<Record<VariantLabel, string>>;
}

export interface ProductImportRowError {
  rowNumber: number;
  sku: string;
  message: string;
}

export interface ProductImportResponse {
  totalRows: number;
  created: number;
  failed: number;
  errors: ProductImportRowError[];
}

export interface InventoryResponse {
  productId: UUID;
  productName: string;
  // The sell unit quantityOnHand and reorderLevel are counted in, e.g. CAN.
  unit: SellUnit;
  quantityOnHand: Numeric;
  reorderLevel: Numeric;
  // The unit stock is bought in and how many sell units it holds, e.g. CARTON of 24.
  stockUnit: StockUnit;
  unitsPerStock: Numeric;
  // Used up by recipes rather than sold.
  ingredient: boolean;
}

export interface StockInImportRowError {
  rowNumber: number;
  sku: string;
  message: string;
}

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
  // Null only on very old movements from before reasons were kept.
  reason: StockMovementReason | null;
  wasteReason: WasteReason | null;
  strategy: StockStrategy | null;
  // In `unit`, the product's sell unit, as is balanceAfter.
  quantity: Numeric;
  unit: SellUnit;
  balanceAfter: Numeric | null;
  totalCost: Numeric | null;
  orderId: UUID | null;
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
  unit: QuantityUnit;
  // Per `unit`: per carton when buying cartons, per can when buying loose cans.
  unitCost: Numeric;
  note?: string;
}

export interface StockCutRequest {
  productId: UUID;
  quantity: Numeric;
  unit: QuantityUnit;
  strategy: StockStrategy;
  note?: string;
}

export interface WasteRequest {
  productId: UUID;
  quantity: Numeric;
  unit: QuantityUnit;
  wasteReason: WasteReason;
  note?: string;
}

// Sold items put back on the shelf. With an order, no more than that order took out can come back.
export interface StockReturnRequest {
  productId: UUID;
  quantity: Numeric;
  unit: QuantityUnit;
  orderId?: UUID;
  note?: string;
}

// A physical count: stock becomes countedQuantity and the difference is recorded.
export interface StockCountRequest {
  productId: UUID;
  countedQuantity: Numeric;
  unit: QuantityUnit;
  note?: string;
}

export interface MovementSearchQuery extends PageQuery {
  productId?: UUID;
  type?: StockMovementType;
  reason?: StockMovementReason;
  // yyyy-MM-dd, inclusive.
  from?: string;
  to?: string;
}

// One product over a report period; quantities in `unit`, money in USD. onHand and stockValue are as of now.
export interface InventoryReportRow {
  productId: UUID;
  productName: string;
  categoryName: string | null;
  ingredient: boolean;
  unit: SellUnit;
  purchased: Numeric;
  sold: Numeric;
  returned: Numeric;
  wasted: Numeric;
  adjustedIn: Numeric;
  adjustedOut: Numeric;
  purchaseCost: Numeric;
  salesCost: Numeric;
  wasteCost: Numeric;
  onHand: Numeric;
  reorderLevel: Numeric;
  stockValue: Numeric;
}

export interface InventoryReportResponse {
  period: ReportPeriod;
  from: string;
  to: string;
  purchaseCost: Numeric;
  purchaseCount: number;
  salesCost: Numeric;
  saleCount: number;
  wasteCost: Numeric;
  wasteCount: number;
  wasteCostByReason: Partial<Record<WasteReason, Numeric>>;
  returnValue: Numeric;
  adjustmentValue: Numeric;
  movementCount: number;
  stockValue: Numeric;
  lowStockCount: number;
  outOfStockCount: number;
  products: InventoryReportRow[];
}

export interface InventoryReportQuery {
  period: ReportPeriod;
  // yyyy-MM-dd inside the period; today when left out.
  date?: string;
}

export interface RecipeItemRequest {
  ingredientId: UUID;
  // Whole number in the ingredient's sell unit, e.g. 18 (GRAM) or 150 (MILLILITER).
  quantity: Numeric;
}

export interface SetRecipeRequest {
  // Replaces the whole recipe of the size; empty = sold from its own stock again.
  items: RecipeItemRequest[];
}

export interface RecipeItemResponse {
  ingredientId: UUID;
  ingredientName: string;
  unit: SellUnit;
  quantity: Numeric;
  unitCost: Numeric;
  lineCost: Numeric;
  onHand: Numeric;
}

export interface RecipeResponse {
  productId: UUID;
  variantId: UUID;
  variantName: VariantLabel;
  variantStatus: Status;
  finalPrice: Numeric;
  items: RecipeItemResponse[];
  cost: Numeric;
  margin: Numeric;
  marginPercent: Numeric | null;
  availableQuantity: number;
}

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
  variantId: UUID | null;
  productImageUrl: string | null;
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
  fulfillmentMethod: FulfillmentMethod | null;
  /** POS orders only; null for online orders. */
  orderType?: OrderType | null;
  tableNumber: string | null;
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
  /** When the QR payment window closes; unpaid online orders are cancelled after it. */
  bakongExpiresAt?: string | null;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
  deliveryLatitude: Numeric | null;
  deliveryLongitude: Numeric | null;
  deliveryFee: Numeric | null;
  deliveryFeeSetAt: string | null;
  estimatedReadyAt: string | null;
  distanceMeters: Numeric | null;
}

export type OrderChannel = "WALK_IN" | "ONLINE";
export type SortDirection = "ASC" | "DESC";

/** Optional filters shared by the staff order lists and their per-status summary. */
export interface OrderSearchParams {
  /** Order number ("#A1B2C3D4" or its start), customer name or contact name. */
  search?: string;
  /** Shop days (yyyy-MM-dd) on which the order was placed; both ends are included. */
  from?: string;
  to?: string;
  channel?: OrderChannel;
  fulfillment?: FulfillmentMethod;
  paymentMethod?: PaymentMethod;
}

export interface OrderStatusSummary {
  status: OrderStatus;
  count: number;
  totalAmount: Numeric;
}

export interface OrderUpdateMessage {
  action: OrderAuditAction;
  order: OrderResponse;
  sentAt: string;
}

export type StaffCallReason =
  | "PAYMENT_HELP"
  | "CHANGE_ORDER"
  | "ORDER_DELAY"
  | "WRONG_OR_MISSING_ITEM"
  | "NAPKINS_UTENSILS"
  | "DELIVERY_HELP"
  | "OTHER";

export type StaffCallStatus = "OPEN" | "ANSWERED";

export interface AnswerStaffCallRequest {
  reply?: string;
}

export interface StaffCallResponse {
  orderId: UUID;
  customerName: string | null;
  orderStatus: OrderStatus;
  fulfillmentMethod: FulfillmentMethod | null;
  tableNumber: string | null;
  status: StaffCallStatus;
  reason: StaffCallReason;
  note: string | null;
  calledAt: string;
  answeredByName: string | null;
  reply: string | null;
  answeredAt: string | null;
  nextCallAllowedAt: string | null;
}

export interface StaffCallMessage {
  type: "CALLED" | "ANSWERED";
  orderId: UUID;
  customerName: string | null;
  orderStatus: OrderStatus;
  fulfillmentMethod: FulfillmentMethod | null;
  tableNumber: string | null;
  reason: StaffCallReason;
  note: string | null;
  calledAt: string;
  answeredByName: string | null;
  reply: string | null;
  sentAt: string;
}

export type WatchedResource =
  | "PRODUCT"
  | "CATEGORY"
  | "EXTRA"
  | "INVENTORY"
  | "FEEDBACK"
  | "TABLE";

export type ResourceChangeType = "CREATED" | "UPDATED" | "DELETED";

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
  variantId?: UUID;
  variantName?: VariantLabel;
  sugarLevel?: SugarLevel;
  iceLevel?: IceLevel;
  milkType?: MilkType;
  extraIds?: UUID[];
}

/** A POS sale: always dine-in or take-away, never delivery. */
export interface CreateOrderRequest {
  items: OrderItemRequest[];
  orderType: OrderType;
  note?: string;
  /** Dine-in only, and optional there (a counter seat has no table). */
  tableNumber?: string;
}

export interface CashPaymentRequest {
  currency: Currency;
  amountTendered: Numeric;
  changeCurrency?: Currency;
}

export interface DeliveryFeeRequest {
  fee: Numeric;
}

export interface EstimatedTimeRequest {
  minutes: number;
}

export interface BakongQrResponse {
  orderId: UUID;
  qrString: string;
  md5Hash: string;
  amount: Numeric;
  currency: Currency;
  expiresAt: string;
  expiresInSeconds: number;
}

export interface EventResponse {
  id: UUID;
  title: string;
  description: string | null;
  imageUrl: string | null;
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
  latitude?: Numeric;
  longitude?: Numeric;
  startAt: string;
  endAt: string;
}

export interface UpdateEventRequest {
  title?: string;
  description?: string;
  latitude?: Numeric;
  longitude?: Numeric;
  startAt?: string;
  endAt?: string;
  status?: Status;
}

export interface BannerResponse {
  id: UUID;
  title: string;
  imageUrl: string | null;
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

export type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED";
export type TableSize = "SMALL" | "MEDIUM" | "LARGE";

export interface TableResponse {
  id: UUID;
  tableNumber: string;
  size: TableSize;
  capacity: number;
  guestCount: number;
  status: TableStatus;
  scanUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTableRequest {
  tableNumber: string;
  size: TableSize;
  capacity?: number;
}

export interface UpdateTableRequest {
  tableNumber?: string;
  size?: TableSize;
  capacity?: number;
}

export interface TableActivityResponse {
  table: TableResponse;
  activeOrderCount: number;
  openStaffCallCount: number;
  activeOrders: OrderResponse[];
  openStaffCalls: StaffCallResponse[];
}

export interface UpdateTableStatusRequest {
  status: TableStatus;
  guestCount?: number;
}
