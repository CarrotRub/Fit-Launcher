function hashKey(type: "torrent" | "ddl", id: string): string {
  return `${type}:${id}`;
}
