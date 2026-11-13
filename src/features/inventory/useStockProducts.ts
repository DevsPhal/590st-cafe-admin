"use client";

import { useMemo } from "react";
import type { ProductSelectOption } from "@/components/common/AdminKit";
import { useI18n } from "@/contexts/I18nContext";
import { enumLabel } from "@/lib/enumLabel";
import { useListInventoryQuery } from "@/store/api/inventoryApi";
import { useListProductsQuery } from "@/store/api/productApi";
import type { InventoryResponse } from "@/store/api/types";

// Every stock row (the API's largest page) for product pickers; the product list only adds SKUs to search by.
const ALL = { page: 1, size: 500 };

export function useStockProducts({ skip = false }: { skip?: boolean } = {}) {
  const { t } = useI18n();
  const { data: inventoryPage } = useListInventoryQuery(ALL, { skip });
  const { data: productPage } = useListProductsQuery(ALL, { skip });

  return useMemo(() => {
    const skus = new Map((productPage?.content ?? []).map((product) => [product.id, product.sku]));
    const items = inventoryPage?.content ?? [];
    const byId = new Map<string, InventoryResponse>(items.map((item) => [item.productId, item]));
    const options: ProductSelectOption[] = items.map((item) => ({
      id: item.productId,
      name: item.productName,
      sku: skus.get(item.productId) ?? "-",
      currentStock: Number(item.quantityOnHand),
      unit: enumLabel(t, "unit", item.unit),
    }));
    return { options, byId };
  }, [inventoryPage, productPage, t]);
}
