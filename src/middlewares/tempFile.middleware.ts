import { Request, Response } from "hyper-express";
import fs from "fs";
import path from "path";
import { tempDirPath } from "../utils/Folders";
import { prisma } from "../db";

export const tempFileMiddleware = () => {
  return async (req: Request, res: Response) => {
    res.on("close", () => {
      if (res.statusCode && res.statusCode < 400) return;

      if (req.file?.compressedFilename) {
        fs.promises.unlink(req.file.compressedFilename).catch(() => {});
      }
    });

    const fileId = req.params.fileId;

    const verifyItem = await prisma.waitingVerification.findUnique({
      where: {
        fileId,
        type: null,
      },
    });

    if (!verifyItem) {
      res.status(404).json({
        error: "File not found",
      });
      return;
    }

    req.file = {
      tempPath: path.join(tempDirPath, verifyItem.tempFilename),
      tempFilename: verifyItem.tempFilename,
      fileId: verifyItem.fileId,
      originalFilename: verifyItem.originalFilename,
      mimetype: verifyItem.mimetype,
      animated: verifyItem.animated || false,
      filesize: verifyItem.filesize,
      shouldCompress: verifyItem.shouldCompress || false,
    };
  };
};
