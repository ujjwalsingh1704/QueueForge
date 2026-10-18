import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";

const workerPath = path.join(__dirname, "worker.js");
const serverPath = path.join(__dirname, "server.js");
const children: ChildProcess[] = [
  spawn(process.execPath, [workerPath], { stdio: "inherit" }),
  spawn(process.execPath, [serverPath], { stdio: "inherit" }),
];

let stopping = false;
let exitCode = 0;

function stop(signal: NodeJS.Signals = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  const liveChildren = children.filter((child) => child.exitCode === null && child.signalCode === null);
  for (const child of liveChildren) child.kill(signal);

  const forceExit = setTimeout(() => process.exit(exitCode || 1), 10_000);
  forceExit.unref();
  Promise.all(liveChildren.map((child) => new Promise<void>((resolve) => child.once("exit", () => resolve()))))
    .then(() => {
      clearTimeout(forceExit);
      process.exit(exitCode);
    })
    .catch(() => process.exit(exitCode || 1));
}

for (const child of children) {
  child.once("error", (error) => {
    console.error("[all] failed to start a process:", error);
    exitCode = 1;
    stop();
  });
  child.once("exit", (code) => {
    if (stopping) return;
    exitCode = code ?? 1;
    console.error(`[all] child exited unexpectedly (code ${exitCode}); stopping the other process`);
    stop();
  });
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
