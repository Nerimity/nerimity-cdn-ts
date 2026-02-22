console.log("Starting Workers...");
import os from "os";
import cluster from "cluster";
import { createFolders, tempDirPath } from "./utils/Folders";
import { removeExpiredVerifications } from "./VerificationService";
import { setTimeout } from "timers/promises";
import path from "path";
import fs from "fs";
import { env } from "./env";
import { removeExpiredFiles } from "./ExpireFileService";
let cpus = env.devMode ? 1 : os.cpus().length;

if (cpus >= 3) {
  cpus = 3;
}

const workers = new Map();

if (cluster.isPrimary) {
  createFolders();
  removeExpiredVerificationsAtInterval();
  removeExpiredFilesAtInterval();
  for (let i = 0; i < cpus; i++) {
    const worker = cluster.fork({
      cpu: i,
    });
    workers.set(worker.id, i);
  }

  cluster.on("exit", (worker, code, signal) => {
    const cpuIndex = workers.get(worker.id);
    console.error(`Worker process ${worker.process.pid} died.`);
    workers.delete(worker.id);

    const newWorker = cluster.fork({ cpu: cpuIndex });
    workers.set(newWorker.id, cpuIndex);
  });
} else {
  import("./worker");
}

// 2 minutes
const removeExpiredVerificationsInterval = 2 * 60 * 1000;
async function removeExpiredVerificationsAtInterval() {
  console.log("removeExpiredVerificationsAtInterval");
  const results = await removeExpiredVerifications().catch((err) => {
    console.error(err);
  });

  if (results && results.length) {
    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      if (!item) continue;
      const filePath = path.join(tempDirPath, item.tempFilename);
      fs.promises.unlink(filePath).catch(() => {});
    }

    console.log("Removed", results.length, "expired temp files.");
  }
  await setTimeout(removeExpiredVerificationsInterval);
  removeExpiredVerificationsAtInterval();
}

// 2 minutes
const removeExpiredFilesInterval = 2 * 60 * 1000;
async function removeExpiredFilesAtInterval() {
  console.log("removeExpiredFilesAtInterval");

  const results = await removeExpiredFiles().catch((err) => {
    console.error(err);
  });
  if (results && results.length) {
    console.log("Removed", results.length, "expired files.");
  }

  await setTimeout(removeExpiredFilesInterval);
  removeExpiredFilesAtInterval();
}
