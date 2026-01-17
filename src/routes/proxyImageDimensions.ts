import { Server } from "hyper-express";
import { Request, Response } from "hyper-express";
import { fetchHeaders, isImageMime, isUrl } from "../utils/utils";

import { checkSecretMiddleware } from "../middlewares/checkSecret.middleware";
import { getMetadata } from "../utils/sharp";

export function handleProxyImageDimensionsRoute(server: Server) {
  server.get("/proxy-dimensions", checkSecretMiddleware, route);
}

const route = async (req: Request, res: Response) => {
  res.header("Cache-Control", "public, max-age=1800");

  const unsafeImageUrl = req.query.url as string;

  if (!unsafeImageUrl || !isUrl(unsafeImageUrl)) {
    res.status(403).end();
    return;
  }

  try {
    const imageRes = await fetchHeaders(unsafeImageUrl);
    if (!imageRes) return res.status(403).end();
    const mime = imageRes.headers.get("content-type");

    if (!isImageMime(mime)) {
      res.status(403).end();
      return;
    }

    const metadata = await getMetadata(await imageRes.arrayBuffer());
    if (!metadata) return res.status(403).end();
    res.json({ height: metadata.height, width: metadata.width, animated: !!metadata.pages });
  } catch {
    res.status(403).end();
  }
}

