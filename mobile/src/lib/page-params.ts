/** Shared Next 16 route prop shapes — params and searchParams are Promises. */

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export type RouteParams<K extends string = "id"> = Promise<Record<K, string>>;

export type PageArgs = { searchParams: SearchParams };
export type DetailPageArgs = { params: RouteParams; searchParams: SearchParams };

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
