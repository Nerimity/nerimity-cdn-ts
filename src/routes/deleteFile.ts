import { Server } from "hyper-express";
import { Request, Response } from "hyper-express";
import { checkSecretMiddleware } from "../middlewares/checkSecret.middleware";
import { isDirectory, publicDirPath } from "../utils/Folders";
import path from "path";
import fs from "fs";
import { deleteExpiringFiles } from "../ExpireFileService";

export function handleDeleteFileRoute(server: Server) {
  server.delete("/", checkSecretMiddleware, route);
}

const route = async (req: Request, res: Response) => {
  const { path: pathToDelete } = (await req.json({ path: undefined })) as {
    path: string | undefined;
  };
  if (!pathToDelete) {
    return res.status(400).json({ error: "Missing path" });
  }

  const fullPath = path.join(publicDirPath, decodeURIComponent(pathToDelete));
  if (fullPath.includes("../"))
    return res.status(400).json({ error: "Invalid path" });

  if (await isDirectory(fullPath))
    return res.status(404).json({ error: "Invalid path" });

  const unlinkFileRes = await fs.promises.unlink(fullPath).catch((err) => {
    console.log(err);
    res.status(404).json({ error: "File not found" });
    return false;
  });
  if (unlinkFileRes === false) return;

  // go back one directory and delete the folder if it's empty
  const parentDir = path.dirname(fullPath);
  const parentFiles = await fs.promises.readdir(parentDir).catch(() => {
    res.status(500).json({ error: "Internal server error" });
    return null;
  });

  const fileId = pathToDelete.split("/")[2]!;

  if (fileId) {
    await deleteExpiringFiles([fileId]).catch((err) => {
      console.error(err);
    });
  }
  if (parentFiles === null) return;
  if (parentFiles.length !== 0)
    return res.status(404).json({ status: "deleted" });

  const rmDirRes = await fs.promises.rmdir(parentDir).catch(() => {
    res.status(500).json({ error: "Internal server error" });
    return null;
  });
  if (rmDirRes === null) return;

  res.status(200).json({ status: "deleted" });
};
