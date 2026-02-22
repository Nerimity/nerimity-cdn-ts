type LogType = "FS" | "PROXY" | "COMPRESS" | "UPLOAD";

export function log(type: LogType, level: "log" | "error", ...args: any[]) {
  const prefix = `[${type}]`;
  if (level === "log") {
    console.log(prefix, ...args);
  } else if (level === "error") {
    console.error(prefix, ...args);
  }
}
