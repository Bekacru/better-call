import { z } from "zod";

export function paramToZod(path: string) {
  const parts = path.split("/");
  const params = parts.filter((part) => part.startsWith(":"));
  const zod = z.object({});
  for (const param of params) {
    zod.merge(z.object({ [param.slice(1)]: z.string() }));
  }
  return zod;
}
