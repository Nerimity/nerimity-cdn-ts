export const env = {
  port: parseInt(process.env.PORT!),
  origin: JSON.parse(process.env.ORIGIN!) as string[],
  attachmentMaxBodyLength:
    parseInt(process.env.ATTACHMENT_MAX_BODY_LENGTH!) * (1024 * 1024),
  imageMaxBodyLength:
    parseInt(process.env.IMAGE_MAX_BODY_LENGTH!) * (1024 * 1024),
  expireFileMS: 1000 * 60 * 60 * 24 * parseInt(process.env.EXPIRE_FILE_MS!),
  secret: process.env.SECRET!,
  devMode: process.env.DEV_MODE?.toLowerCase() === "true",
  databaseUrl: process.env.DATABASE_URL!,
  EXTERNAL_EMBED_SECRET: process.env.EXTERNAL_EMBED_SECRET as string,
};
