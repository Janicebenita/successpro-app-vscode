export function messagePage<T extends { id: string }>(documents: T[], pageSize = 50) {
  const page = documents.slice(0, pageSize);
  return { page, nextCursor: documents.length > pageSize ? page.at(-1)?.id ?? null : null };
}
