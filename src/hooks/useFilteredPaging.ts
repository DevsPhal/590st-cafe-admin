// The admin list endpoints only page; they can't search. When a search or status filter is on,
// fetch every row in one request (the API's MAX_PAGE_SIZE) and filter + page it here, so a
// match on page 5 is still found. With no filter we keep normal server-side paging.
const FETCH_ALL_SIZE = 500;

type ServerPage = { page?: number; totalPages?: number; totalElements?: number };

export function filteredQueryArgs(page: number, size: number, filtering: boolean) {
  return filtering ? { page: 1, size: FETCH_ALL_SIZE } : { page, size };
}

export function filteredPage<T>(
  rows: T[],
  serverPage: ServerPage | undefined,
  page: number,
  size: number,
  filtering: boolean
) {
  if (!filtering) {
    const current = serverPage?.page ?? page;
    return {
      rows,
      page: current,
      totalPages: serverPage?.totalPages ?? 1,
      totalElements: serverPage?.totalElements,
      offset: (current - 1) * size,
    };
  }
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(page, 1), totalPages);
  const offset = (current - 1) * size;
  return {
    rows: rows.slice(offset, offset + size),
    page: current,
    totalPages,
    totalElements: rows.length,
    offset,
  };
}
