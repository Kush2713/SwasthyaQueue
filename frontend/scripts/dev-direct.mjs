import { startServer } from "next/dist/server/lib/start-server.js";

const port = Number(process.env.PORT || 3001);
const hostname = process.env.HOSTNAME || "0.0.0.0";

if (!process.env.NEXT_DIST_DIR) {
  process.env.NEXT_DIST_DIR = ".next-direct";
}

await startServer({
  dir: process.cwd(),
  port,
  hostname,
  isDev: true,
  allowRetry: false,
});
