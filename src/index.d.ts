export type IngredientImageVariant = "original" | "webp512" | "png512";
export type CatalogItemKind = "food" | "household" | "personal" | "pet";

export type IngredientImageResult = {
  slug: string;
  displayName: string;
  kind: CatalogItemKind;
  category: string;
  path: string;
  url?: string;
  sha256: string;
  license: {
    status: string;
    recommended: string;
    notice?: string;
  };
  review: {
    imageJobStatus: string;
    taxonomyImageStatus?: string | null;
    datasetStatus: string;
    duplicateApprovedJobs: number;
  };
};

export type IngredientImageAsset = {
  path: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  contentType: string;
};

export type IngredientRecord = {
  slug: string;
  displayName: string;
  kind?: CatalogItemKind;
  category: string;
  images: Record<IngredientImageVariant, IngredientImageAsset>;
  license: IngredientImageResult["license"];
  review: IngredientImageResult["review"] & {
    sourceSlugs?: string[];
  };
};

export type IngredientAtlasManifest = {
  recordsBySlug: Record<string, IngredientRecord>;
  aliases: Record<string, IngredientRecord>;
};

export function loadManifest(): IngredientAtlasManifest;
export function normalizeIngredientSlug(value: unknown): string;
export function normalizeCatalogSlug(value: unknown): string;
export function getIngredientImage(
  value: unknown,
  options?: { variant?: IngredientImageVariant; baseUrl?: string; kind?: CatalogItemKind },
): IngredientImageResult | null;
export function getCatalogItemImage(
  value: unknown,
  options?: { variant?: IngredientImageVariant; baseUrl?: string; kind?: CatalogItemKind },
): IngredientImageResult | null;
export function listIngredientImages(): IngredientRecord[];
export function listCatalogItemImages(options?: { kind?: CatalogItemKind }): IngredientRecord[];
export function listCatalogKinds(): CatalogItemKind[];
