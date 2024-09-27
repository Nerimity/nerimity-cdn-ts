// groupId can:
// - be a userId for posts

import { Server } from "hyper-express";
import { tempFileMiddleware } from "../middlewares/tempFile.middleware";
import { validGroupIdCheckMiddleware } from "../middlewares/validGroupIdCheck.middleware";
import { addToWaitingList, VerificationType } from "../VerificationService";
import { Request, Response } from "hyper-express";
import { config } from "../config";

export function handleAttachmentsPostRoute(server: Server) {
  server.post("/attachments/:groupId", validGroupIdCheckMiddleware, tempFileMiddleware, route, { max_body_length: config.attachmentMaxBodyLength })
}

const route = async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({
      error: "Missing file"
    })
    return;
  }

  const result = await addToWaitingList({
    fileId: req.file.fileId,
    groupId: req.params.groupId as string,
    originalFilename: req.file.originalFilename,
    tempFilename: req.file.tempFilename,
    type: VerificationType.ATTACHMENT
  }).catch(err => {
    console.error(err)
  })

  if (!result) {
    res.status(500).json({
      error: "Failed to add to waiting list"
    })
    return;
  }

  res.status(200).json({
    fileId: req.file.fileId
  })
}