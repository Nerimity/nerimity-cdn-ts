import fs from "fs";
import { miniConvertv2 } from "./imgproxy";


interface MiniConvertOptions {
  size?: number | [number, number];
  static?: boolean;
  localPath?: boolean
}

export async function miniConvert(
  _path: string,
  opts: MiniConvertOptions,
) {
    return miniConvertv2(_path, opts)
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
