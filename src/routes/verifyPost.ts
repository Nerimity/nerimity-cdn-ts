import { Server } from "hyper-express";
import { isValidGroupId } from "../middlewares/validGroupIdCheck.middleware";
import {
  findAndDeleteWaitingVerification,
  VerificationType,
} from "../VerificationService";
import { Request, Response } from "hyper-express";
import path, { ParsedPath } from "path";
import { publicDirPath, tempDirPath } from "../utils/Folders";
import { WaitingVerification } from "@prisma/client";
import fs from "fs";
import { typeToDir, typeToRelativeDir } from "../utils/uploadType";
import { env } from "../env";
import { addToExpireList } from "../ExpireFileService";
import { checkSecretMiddleware } from "../middlewares/checkSecret.middleware";
import { deleteDirWithFileExclusion } from "../utils/utils";

export function handleVerifyPostRoute(server: Server) {
  server.post("/verify/:groupId/:fileId", checkSecretMiddleware, route);
  server.post("/verify/:fileId", checkSecretMiddleware, route);
}

const route = async (req: Request, res: Response) => {
  const groupId = req.params.groupId as string;
  const fileId = req.params.fileId as string;
  const type = req.query.type as VerificationType;
  const imageOnly = (req.query.imageOnly as string | undefined) === "true"; // optional true or false
  if (!type) {
    res.status(400).json({
      error: "Missing type query parameter",
    });
    return;
  }
  if (groupId && !isValidGroupId(groupId)) {
    res.status(400).json({
      error: "Invalid groupId or fileId",
    });
    return;
  }

  if (type !== "EMOJI" && !groupId) {
    res.status(400).json({
      error: "Missing groupId",
    });
    return;
  }

  if (!isValidGroupId(fileId)) {
    res.status(400).json({
      error: "Invalid groupId or fileId",
    });
    return;
  }

  const waitingVerification = await findAndDeleteWaitingVerification(
    fileId,
    groupId,
    type,
    imageOnly ? true : undefined
  );
  if (!waitingVerification) {
    res.status(404).json({
      error: "Not found",
    });
    return;
  }
  const tempPath = path.join(tempDirPath, waitingVerification.tempFilename);
  const newPath = getFilePathFromVerificationType(waitingVerification);

  const fullPath = path.join(
    newPath.dirPath,
    newPath.parsedFilePath.name + newPath.parsedFilePath.ext
  );

  try {
    await fs.promises.mkdir(newPath.dirPath, { recursive: true });
    await fs.promises.rename(tempPath, fullPath);
  } catch {
    fs.promises.unlink(tempPath).catch(() => {});
    fs.promises.unlink(fullPath).catch(() => {});

    res.status(500).json({
      error: "Internal server error.",
    });
  }

  let expireAt: number | undefined = undefined;

  if (!waitingVerification.compressed) {
    const expireFile = await addToExpireList({
      fileId: waitingVerification.fileId,
      groupId: waitingVerification.groupId!,
    }).catch((err) => {
      console.error(err);
    });

    if (!expireFile) {
      res.status(500).json({
        error: "Failed to add to expire list",
      });
      fs.promises.unlink(tempPath).catch(() => {});
      fs.promises.unlink(fullPath).catch(() => {});
      return;
    }
    expireAt = expireFile.expireAt;
  }

  if (
    waitingVerification.type === VerificationType.AVATAR ||
    waitingVerification.type === VerificationType.BANNER
  ) {
    deleteDirWithFileExclusion(
      newPath.dirPath,
      newPath.parsedFilePath.name + newPath.parsedFilePath.ext
    ).catch((e) => {
      console.log(e);
    });
  }

  res.status(200).json({
    fileId: waitingVerification.fileId,
    path: path
      .join(
        newPath.relativeDirPath,
        encodeURIComponent(newPath.parsedFilePath.name) +
          newPath.parsedFilePath.ext + (waitingVerification.animated ? "#a" : "")
      )
      .replaceAll("\\", "/"),
    filesize: waitingVerification.filesize,
    animated: waitingVerification.animated,
    ...(waitingVerification.duration !== undefined
      ? { duration: waitingVerification.duration }
      : {}),
    mimetype: waitingVerification.mimetype,
    compressed: waitingVerification.compressed,
    width: waitingVerification.width,
    height: waitingVerification.height,
    expireAt,
  });
};

function getFilePathFromVerificationType(
  waitingVerification: WaitingVerification
) {
  if (!waitingVerification.type) {
    throw new Error(`No type provided.`);
  }
  const dirPath = typeToDir(waitingVerification.type);
  const relDirPath = typeToRelativeDir(waitingVerification.type);

  if (!dirPath) {
    throw new Error(`Invalid type: ${waitingVerification.type}`);
  }
  if (!relDirPath) {
    throw new Error(`Invalid type: ${waitingVerification.type}`);
  }

  let relativeDirPath: string;
  let parsedFilePath: ParsedPath;

  if (waitingVerification.type === VerificationType.ATTACHMENT) {
    if (!waitingVerification.groupId) {
      throw new Error("Missing groupId");
    }
    relativeDirPath = path.join(
      relDirPath,
      waitingVerification.groupId,
      waitingVerification.fileId
    );
    parsedFilePath = path.parse(waitingVerification.originalFilename);
  } else if (waitingVerification.type === VerificationType.EMOJI) {
    relativeDirPath = path.join(relDirPath);
    parsedFilePath = path.parse(waitingVerification.tempFilename);
  } else {
    if (!waitingVerification.groupId) {
      throw new Error("Missing groupId");
    }
    relativeDirPath = path.join(relDirPath, waitingVerification.groupId);
    parsedFilePath = path.parse(waitingVerification.tempFilename);
  }

  let fullDirPath = path.join(publicDirPath, relativeDirPath);

  return {
    dirPath: fullDirPath,
    relativeDirPath,
    parsedFilePath,
  };
}
