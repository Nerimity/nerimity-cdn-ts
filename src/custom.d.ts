import { DefaultRequestLocals } from "hyper-express";

declare module "hyper-express" {
  interface Request<T = DefaultRequestLocals> {
    file?: {
      tempPath: string;
      originalFilename: string;
      fileId: string;
      tempFilename: string;
      mimetype: string;
      filesize: number;
      shouldCompress: boolean;
      compressedFilename?: string;
      compressedWidth?: number;
      compressedHeight?: number;
      animated: boolean;
    };
  }
}
