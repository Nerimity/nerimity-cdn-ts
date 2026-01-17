import gm from "gm";
import fs from "fs";
import path from "path";
import { getMetadata } from "./sharp";
import { Readable } from "stream";
import { imgproxyCompressImage, miniConvertv2 } from "./imgproxy";
import { publicDirPath } from "./Folders";

const imageMagick = gm.subClass({ imageMagick: "7+" });









interface MiniConvertOptions {
  size?: number | [number, number];
  static?: boolean;
  localPath?: boolean
}

export async function miniConvert(
  _path: string,
  opts: MiniConvertOptions,
  readable?: Readable
) {

  if (!opts.static) {
    return miniConvertv2(_path, opts)
  }
  const fullPath = !opts.localPath ? _path :path.join(publicDirPath, _path);
  let instance = imageMagick((readable ||  fullPath) as unknown as string);
  if (opts.static) instance = instance.selectFrame(0);
  if (opts.size) {
    if (typeof opts.size === "number") {
      instance = instance.resize(opts.size, opts.size, ">");
    } else {
      instance = instance.resize(opts.size[0], opts.size[1], ">");
    }
  }

  return asyncStream(instance, "webp")
    .then((stream) => {
      return [stream, null] as const;
    })
    .catch((err) => {
      return [null, err] as const;
    });
}

async function asyncStream(im: gm.State, format: string) {
  return new Promise<Readable>((res, rej) => {
    im.stream(format, (err, stream) => {
      if (err) rej(err);
      else res(stream);
    });
  });
}

export async function removeFile(path: string) {
  if (!path) return;
  return await fs.promises.unlink(path).catch((e) => {});
}

/**
 * Converts an array of points into dimensions.
 */
export const pointsToDimensions = (pointsStr: string | undefined) => {
  let parsedPoints;
  let dimensions: { width: number; height: number } | undefined;

  try {
    parsedPoints = JSON.parse(pointsStr || "null") as number[];
    if (parsedPoints !== null) {
      if (!Array.isArray(parsedPoints))
        return [null, null, "Invalid crop points."] as const;
      if (parsedPoints.length !== 4)
        return [null, null, "Invalid crop points."] as const;
      const invalidPoint = parsedPoints.find(
        (point) =>
          typeof point !== "number" || isNaN(point) || point < 0 || point > 9999
      );
      if (invalidPoint) return [null, null, "Invalid crop points."] as const;
      dimensions = !!parsedPoints && getDimensions(parsedPoints);
      return [dimensions, parsedPoints, null] as const;
    }
    return [null, null, null] as const;
  } catch (err) {
    return [null, null, "Invalid crop points."] as const;
  }
};

function getDimensions(points: number[]) {
  const [startX, startY, endX, endY] = points as [
    number,
    number,
    number,
    number
  ];
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  return { width, height };
}
