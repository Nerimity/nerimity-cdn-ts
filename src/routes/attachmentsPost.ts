import { Server } from "hyper-express";
import { tempFileMiddleware } from "../middlewares/tempFile.middleware";
import { validGroupIdCheckMiddleware } from "../middlewares/validGroupIdCheck.middleware";
import { addToWaitingList, VerificationType } from "../VerificationService";
import { Request, Response } from "hyper-express";
import { env } from "../env";
import { tempDirPath } from "../utils/Folders";
import { compressImageMiddleware } from "../middlewares/compressImage.middleware";
import { getAudioDurationInSeconds } from 'get-audio-duration'

export function handleAttachmentsPostRoute(server: Server) {
  server.post(
    "/attachments/:groupId/:fileId",
    validGroupIdCheckMiddleware,
    tempFileMiddleware(),
    compressImageMiddleware({
      size: [1920, 1080],
    }),
    route,
    { max_body_length: env.attachmentMaxBodyLength }
  );
}

const route = async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({
      error: "Missing file",
    });
    return;
  }


  const isAudio = req.file.mimetype === "audio/ogg" || req.file.mimetype === "audio/mp3";
  const isVideo = req.file.mimetype === "video/mp4";
  let duration: number | undefined;

  if (isAudio || isVideo) {
    duration = await getAudioDurationInSeconds(req.file.tempPath);
  }

  const result = await addToWaitingList({
    type: VerificationType.ATTACHMENT,
    fileId: req.file.fileId,
    groupId: req.params.groupId as string,
    originalFilename: req.file.originalFilename,
    duration,
    tempFilename: req.file.tempFilename,
    animated: req.file.animated,
    compressed: !!req.file.compressedFilename,
    filesize: req.file.filesize,
    mimetype: req.file.mimetype,
    width: req.file.compressedWidth,
    height: req.file.compressedHeight,
  }, true).catch((err) => {
    console.error(err);
  });

  if (!result) {
    res.status(500).json({
      error: "Failed to add to waiting list",
    });
    return;
  }

  res.status(200).json({
    fileId: req.file.fileId,
  });
};
