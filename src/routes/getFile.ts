import { Server } from "hyper-express";

import { Request, Response } from "hyper-express";
import path from "path";
import { isDirectory, publicDirPath } from "../utils/Folders";

import fs from "fs";
import { miniConvert } from "../utils/imageMagick";
import { getMimeType } from "stream-mime-type";
import { Readable } from "stream";
import { env } from "../env";
import { decrypt } from "../utils/encryption";
import { createReadStream } from "../utils/createStream";

export function handleGetFileRoute(server: Server) {
  server.get("/external-embed/*", (req, res) => {
    try {
      const encryptedPath = req.path.split("/").slice(2).join("/");
      const path = decrypt(
        encryptedPath.split(".")[0]!,
        env.EXTERNAL_EMBED_SECRET
      );
      route(req, res, path).catch((err) => {
        res.status(500).json({ error: "Internal server error" });
        console.error(err);
      });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
      console.error(err);
    }
  });
  server.get("/*", (req, res) => {
    route(req, res).catch((err) => {
      res.status(500).json({ error: "Internal server error" });
      console.error(err);
    });
  });
}

const route = async (req: Request, res: Response, customPath?: string) => {
  const urlPath = customPath || req.path;
  const decodedPath = path.join(
    path.dirname(urlPath),
    decodeURI(path.basename(urlPath))
  );

  if (decodedPath.includes("../"))
    return res.status(404).json({ error: "Not found" });
  const fullPath = path.join(publicDirPath, decodedPath);

  const isDir = await isDirectory(fullPath);
  if (isDir) {
    res.status(404).send("Not found");

    return;
  }

  const filesize = await fs.promises
    .stat(fullPath)
    .then((stats) => stats.size)
    .catch(() => null);

  if (filesize === null) {
    res.status(404).send("Not found");
    return;
  }

  const [rawStream, rawStreamErr] = await createReadStream(fullPath);

  if (rawStreamErr) {
    return res.status(404).json({ error: "Not found" });
  }

  const rawMime = await getMimeType(rawStream as Readable);
  const isRawImage = rawMime.mime?.startsWith("image/");
  const isImageFilesize = filesize / 1024 / 1024 <= 20; // 20mb

  if (isImageFilesize && isRawImage) {
    const type = req.query.type as string;
    let size = parseInt(req.query.size as string | "0");

    if (size >= 1920) {
      size = 1920;
    }
    if (!size) {
      size = 0;
    }

    if (type || size) {
      const [inStream, err] = await miniConvert(rawMime.stream as Readable, {
        size: size,
        static: type === "webp",
      });
      if (err) {
        console.error(err);
        res.status(500).end();
        return;
      }

      const { stream, mime } = await getMimeType(inStream as Readable);

      res.set("Cache-Control", "public, max-age=1800");
      res.set("Accept-Ranges", "bytes");
      res.set("Content-Type", mime || "image/webp");

      stream.pipe(res).on("error", () => {
        if (!res.headersSent) {
            res.end('Error streaming file.');
        } else {
          res.destroy();
        }
      })
      return;
    }
  }

  res.set("Cache-Control", "public, max-age=300");
  if (
    rawMime.mime.startsWith("image/") ||
    rawMime.mime.startsWith("video/mp4") ||
    rawMime.mime.startsWith("audio/mp3") ||
    rawMime.mime.startsWith("audio/ogg")
  ) {
    res.set("Content-Type", rawMime.mime);
  } else {
    res.set("Content-Type", `application/octet-stream; charset=UTF-8`);
  }

  rawMime.stream.pipe(res).on("error", () => {
    if (!res.headersSent) {
        res.end('Error streaming file.');
    } else {
      res.destroy();
    }
  })
};
