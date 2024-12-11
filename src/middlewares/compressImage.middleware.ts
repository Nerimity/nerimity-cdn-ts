import { Request, Response } from "hyper-express";
import path from "path";
import { tempDirPath } from "../utils/Folders";
import fs from "fs";
import { exec } from "node:child_process";
import { promisify } from "util";
import { imageSize } from 'image-size'
import { removeFile } from "../utils/imageMagick";

const execPromise = promisify(exec);

interface CompressImageOptions {
  tempPath: string;
  newPath: string;
  filename: string;
}

interface CompressedImage {
  filesize: number;
  filename: string;
  newFilename: string;
  height: number;
  width: number;
  animated: boolean;
}

async function compressImage(opts: CompressImageOptions) {
  const newPath = opts.newPath + "/" + path.parse(opts.filename).name + ".webp";

  await execPromise(`./pixiedust ${opts.tempPath} ${newPath}`).then(async (err) => {
    if (err.stderr != "") {
      console.log(`Failed to compress!! ${err.stderr}`);
      return [null, "Something went wrong while compressing image. Error: " + err] as const;
    }
  });

  const dimensions = imageSize(newPath);

  return [
    {
      path: newPath,
      filename: path.parse(newPath).name,
      height: dimensions.height,
      width: dimensions.width,
      filesize: await fs.promises.stat(newPath).then((stat) => stat.size),
      animated: (path.parse(opts.filename).ext == ".gif")
    }, null] as const;
}

export const compressImageMiddleware = () => {
  return async (req: Request, res: Response) => {
    if (req?.file?.shouldCompress) {
      let closed = false;
      res.on("close", () => {
        closed = true;
      });
      const tempFilePath = path.join(tempDirPath, req.file.tempFilename);

      const [result, err] = await compressImage({
        tempPath: tempFilePath,
        newPath: tempDirPath,
        filename: req.file.tempFilename
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
      req.file.compressedFilename = result.filename;
      req.file.compressedHeight = result.height;
      req.file.compressedWidth = result.width;
      req.file.animated = result.animated;
      req.file.originalFilename =
        path.parse(req.file.originalFilename).name + ".webp";
      req.file.tempFilename =
          path.parse(req.file.tempFilename).name + ".webp";
      req.file.mimetype = "image/webp";

      removeFile(tempFilePath);
    }
  };
};
