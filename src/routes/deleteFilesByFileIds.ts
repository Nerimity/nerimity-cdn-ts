import { Server } from "hyper-express";
import { Request, Response } from "hyper-express";
import { checkSecretMiddleware } from "../middlewares/checkSecret.middleware";
import path from "path";
import fs from "fs";
import { publicDirPath } from "../utils/Folders";
import { deleteExpiringFiles } from "../ExpireFileService";

export function handleDeleteFilesByFileIdsRoute(server: Server) {
  server.delete("/batch", checkSecretMiddleware, route);
}

// This runs in a interval in nerimity-server when user has deleted their account
const route = async (req: Request, res: Response) => {
  const body = await req.json();

  if (!body.paths) {
    return res.status(400).json({ error: "Missing paths" });
  }
  const paths = (body.paths as string[]).filter((path) => path);

  const promises = paths.map((pathToDelete) => {
    const fullPath = path.join(publicDirPath, decodeURIComponent(pathToDelete));
    fs.promises.rm(fullPath, { recursive: true, force: true }).catch(() => {});
  });

  const fileIds = paths
    .map((pathToDelete) => pathToDelete.split("/")[2]!)
    .map((fileId) => fileId!);
  await deleteExpiringFiles(fileIds)
    .then(() => {})
    .catch(() => {});

  await Promise.all(promises);

  console.log("Deleted", paths.length, "image(s).");
  return res.status(200).json({ status: "deleted", count: paths.length });
};
