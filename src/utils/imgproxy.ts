import gm from "gm";
import fs, { createWriteStream } from "fs";
import path from "path";
import { getMetadata } from "./sharp";
import { Readable } from "stream";
import * as imgproxy from "@imgproxy/imgproxy-js-core";
import { finished, pipeline } from "stream/promises";
import { removeFile } from "./imageMagick";

const imageMagick = gm.subClass({ imageMagick: "7+" });

export interface CompressImageOptions {
  tempPath: string;
  newPath: string;
  filename: string;
  size: [number, number, "fit" | "fill"];
  crop?: [number, number, number, number];
}

export const imgproxyCompressImage = async (opts: CompressImageOptions) => {
  const oldMetadata = await getMetadata(opts.tempPath);
  if (!oldMetadata) return [null, "Could not get metadata."] as const;

  const isAnimated = !!oldMetadata.pages;

  const parsedFilename = path.parse(opts.filename);
  const oldFilename = parsedFilename.base;
  const newFilename = parsedFilename.name + ".webp"
  const newPath = path.join(opts.newPath, newFilename);


  await fs.promises.mkdir(opts.newPath, { recursive: true });





  const aspectRatio = opts.size[0] / opts.size[1];

  const targetDimensions = calculateTargetDimensions(
    [oldMetadata.width!, oldMetadata.height!],
    [opts.size[0], opts.size[1]],
    aspectRatio
  )

  let resize: imgproxy.Resize;

  if (opts.size[2] === "fit") {
    resize = {
      resizing_type: "fit",
      width: opts.size[0],
      height: opts.size[1],
    };
  } else {
    resize = {
      resizing_type: "fill",
      width: targetDimensions.width,
      height: targetDimensions.height,
    };
  }

  let crop: imgproxy.Crop | null = null;

  if (opts.crop) {
    let [cropWidth, cropHeight, cropX, cropY] = opts.crop;

    crop = {
      gravity: {
        type: 'nowe',
        x_offset: cropX,
        y_offset: cropY
      },
      width: cropWidth,
      height: cropHeight,
    };
  }

  const urlPath = imgproxy.generateUrl({
    value: encodeURIComponent(`local:///${oldFilename}`),
    type: 'plain',
  }, {
    resize,
    ...(crop && { crop }),
  });

  const fullUrl = `http://localhost:8888/pr:sharp${urlPath}@webp`;

  const res = await fetch(fullUrl)
  if (!res.ok) return [null, "Could not compress image."] as const;

  await pipeline(
    Readable.fromWeb(res.body!),
    createWriteStream(newPath)
  );
  const newMetadata = await getMetadata(newPath);
  if (!newMetadata) {
    removeFile(newPath);
    return [null, "Could not get metadata."] as const;
  }
  const data =  [
    {
      path: newPath,
      newFilename,
      filesize: await fs.promises.stat(newPath).then((stat) => stat.size),
      dimensions: { width: newMetadata.width, height: newMetadata.height },
      gif: isAnimated,
      mimeType: "image/webp",
    }, null
  ] as const

  return data;


};




function calculateTargetDimensions(originalDims: [number, number], maxAllowed: [number, number], aspectRatio: number) {
  const [origW, origH] = originalDims;
  const [maxW, maxH] = maxAllowed;

  const originalRatio = origW / origH;

  let width, height;

  // 1. Fit the aspect ratio inside the original image bounds
  if (originalRatio > aspectRatio) {
    height = origH;
    width = height * aspectRatio;
  } else {
    width = origW;
    height = width / aspectRatio;
  }

  // 2. Further constrain the dimensions to fit within maxAllowed
  const widthScale = maxW / width;
  const heightScale = maxH / height;

  // Use the smallest scale to ensure it fits both bounds
  // Math.min(1, ...) ensures we never upscale
  const finalScale = Math.min(1, widthScale, heightScale);

  return {
    width: Math.round(width * finalScale),
    height: Math.round(height * finalScale)
  };
}


interface MiniConvertOptions {
  size?: number | [number, number];
  localPath?: boolean
}

export async function miniConvertv2(
  path:  string,
  opts: MiniConvertOptions
) {

  let resize: imgproxy.Resize | null = null

  if (opts.size) {
    resize = {
      resizing_type: "fit",
    }
    if (typeof opts.size === "number") {
      resize.width = opts.size;
      resize.height = opts.size;
    } else {
      resize.width = opts.size[0];
      resize.height = opts.size[1];
    }
  }


  const urlPath = imgproxy.generateUrl({
    value: encodeURIComponent(!opts.localPath ? path : `local:///public/${path}`),
    type: 'plain',
  }, {
    ...(resize ? { resize } : {}),
  });

  const fullUrl = `http://localhost:8888/pr:sharp${urlPath}@webp`;


  const res = await fetch(fullUrl)
  if (!res.ok) return [null, "Could not compress image."] as const;

  const stream = Readable.fromWeb(res.body!);
  return [stream, null] as const

}