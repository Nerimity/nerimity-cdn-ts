import fs from "fs";
const SupportedImages = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];
export function isImageMime(mime: string | undefined | null) {
  if (!mime) return false;
  if (SupportedImages.includes(mime)) {
    return true;
  }
  return false;
}

export function safeFilename(filename?: string) {
  let str = filename?.replaceAll("/", "_").replaceAll("\\", "_");

  if (!str) return "unnamed";
  return str;
}

export function isUrl(url: string) {
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return true;
  }
}

export async function fetchHeaders(url: string) {
  const res = await fetch(url, {
    redirect: "follow",
    follow: 4,
  }).catch(() => {});
  if (!res) return null;
  return res;
}

export async function getMimeByUrl(res: Response | undefined | null) {
  if (!res) return null;
  const type = res.headers.get("content-type");
  return type;
}

export async function deleteDirWithFileExclusion(
  path: string,
  excludeFilePath: string
) {
  const files = await fs.promises.readdir(path, { withFileTypes: true });

  for (const file of files) {
    if (file.name === excludeFilePath) continue;
    await fs.promises.rm(path + "/" + file.name, {
      recursive: true,
      force: true,
    });
  }
}
