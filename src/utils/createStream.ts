import fs from "fs";
type Success<T> = [T, null];
type Failure = [null, Error];
type Result<T> = Success<T> | Failure;

export function createWriteStream(
  path: string,
): Promise<Result<fs.WriteStream>> {
  return new Promise((resolve) => {
    const stream = fs.createWriteStream(path);
    stream.once("error", (err) => {
      stream.removeAllListeners();
      resolve([null, err]);
    });

    stream.once("ready", () => {
      resolve([stream, null]);
    });
  });
}

export function createReadStream(path: string): Promise<Result<fs.ReadStream>> {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(path);

    const cleanup = () => {
      stream.removeAllListeners("error");
      stream.removeAllListeners("open");
    };

    stream.once("error", (err) => {
      cleanup();
      resolve([null, err]);
    });

    stream.once("open", () => {
      cleanup();
      resolve([stream, null]);
    });
  });
}
