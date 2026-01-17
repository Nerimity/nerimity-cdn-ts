import { Request, Response } from "hyper-express";
import {
  pointsToDimensions,
  removeFile,
} from "../utils/imageMagick";
import path from "path";
import { tempDirPath } from "../utils/Folders";
import { CompressImageOptions, imgproxyCompressImage } from "../utils/imgproxy";

type Opts = Omit<
  Omit<Omit<Omit<CompressImageOptions, "tempPath">, "filename">, "newPath">,
  "crop"
> & {
  allowCrop?: boolean;
};
export const compressImageMiddleware = (opts: Opts) => {
  return async (req: Request, res: Response) => {
    if (req?.file?.shouldCompress) {
      let closed = false;
      res.on("close", () => {
        closed = true;
      });
      const tempFilePath = path.join(tempDirPath, req.file.tempFilename);

      let strPoints = req.query.points as string | undefined;
      let crop:
        | [number, number, number, number]
        | [number, number]
        | undefined = undefined;
      if (opts.allowCrop) {
        const [dimensions, points, dimErr] = pointsToDimensions(strPoints);
        if (dimErr) {
          return res.status(403).json(dimErr);
        }
        crop = dimensions
          ? [dimensions.width, dimensions.height, points[0]!, points[1]!]
          : undefined;
      }

      const [result, err] = await imgproxyCompressImage({
        ...opts,
        tempPath: tempFilePath,
        newPath: tempDirPath,
        filename: req.file.tempFilename,
        crop,
      });

      if (err) {
        res.status(500).json({
          error: err,
        });
        return;
      }
      if (closed) {
        removeFile(result.path);
        removeFile(tempFilePath);

        return;
      }
      req.file.filesize = result.filesize;
      req.file.compressedFilename = result.newFilename;
      req.file.compressedHeight = result.dimensions.height;
      req.file.compressedWidth = result.dimensions.width;
      req.file.animated = !!result.gif;
      req.file.mimetype = result.mimeType;
      req.file.originalFilename =
        path.parse(req.file.originalFilename).name +
        path.parse(result.newFilename).ext;

      if (req.file.tempFilename !== req.file.compressedFilename) {
        removeFile(tempFilePath);
        req.file.tempFilename =
          path.parse(req.file.tempFilename).name +
          path.parse(result.newFilename).ext;
      }
    }
  };
};
