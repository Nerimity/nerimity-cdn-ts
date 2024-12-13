import { Request, Response } from "hyper-express";
import path from "path";
import { tempDirPath } from "../utils/Folders";
import fs from "fs";
import { exec } from "node:child_process";
import { promisify } from "util";
import { imageSize } from 'image-size'
import { removeFile, pointsToDimensions, getDimensions } from "../utils/imageMagick";

const execPromise = promisify(exec);

interface CompressImageOptions {
  tempPath: string;
  newPath: string;
  filename: string;
  cropWidth: number | undefined;
  cropHeight: number | undefined;
  cropX: number | undefined;
  cropY: number | undefined;
  size: [number, number, "fit" | "fill"];
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


  let crop = "";
  if (opts.cropWidth !== undefined) {
    crop += `--crop --crop-width ${opts.cropWidth} --crop-height ${opts.cropHeight}`;
  }

  if (opts.cropX !== undefined) {
    crop += ` --crop-x ${opts.cropX} --crop-y ${opts.cropY}`;
  }

  let size = `--width ${opts.size[0]} --height ${opts.size[1]}`

  console.log(crop)

  await execPromise(`./pixiedust -i ${opts.tempPath} -o ${newPath} ${crop} ${size}`).then(async (err) => {
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
          | [undefined, undefined, undefined, undefined] = [undefined, undefined, undefined, undefined];
      if (opts.allowCrop) {
        const [dimensions, points, dimErr] = pointsToDimensions(strPoints);
        if (dimErr) {
          return res.status(403).json(dimErr);
        }
        crop = dimensions
            ? [dimensions.width, dimensions.height, points[0]!, points[1]!]
            : [opts.size[0], opts.size[1]];
      }


      let cropX: number | undefined = undefined;
      if (crop[2] !== undefined && crop[0] !==  undefined) {
        cropX = Math.round(crop[2] + (crop[0] / 2));
      }
      let cropY: number | undefined = undefined;
      if (crop[3] !== undefined && crop[1] !==  undefined) {
        cropY = Math.round(crop[3] + (crop[1] / 2));
      }

      const [result, err] = await compressImage({
        tempPath: tempFilePath,
        newPath: tempDirPath,
        filename: req.file.tempFilename,
        cropWidth: crop[0],
        cropHeight: crop[1],
        cropX,
        cropY,
        size: opts.size
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
