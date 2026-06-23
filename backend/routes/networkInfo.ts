import { Express } from "express";
import { spawn } from "child_process";
import { getLocalIpAddresses } from "../helpers/network.ts";
import { PORT } from "../config.ts";

// Tunnel state management
let tunnelProcess: any = null;
let tunnelUrl: string | null = null;
let tunnelPublicIp: string | null = null;

export default function registerNetworkInfoRoute(app: Express) {
  app.get("/api/network-info", async (_req, res) => {
    const localIps = getLocalIpAddresses();
    const localUrl = localIps.length > 0 ? `http://${localIps[0]}:${PORT}` : `http://localhost:${PORT}`;
    res.json({
      localUrl,
      tunnelUrl,
      publicIp: tunnelPublicIp
    });
  });

  app.post("/api/start-tunnel", async (_req, res) => {
    if (tunnelUrl) {
      return res.json({ url: tunnelUrl, publicIp: tunnelPublicIp });
    }

    try {
      // Get public IP for tunnel password
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipRes.json() as any;
      tunnelPublicIp = ipData.ip;
    } catch (err) {
      console.warn("Could not retrieve public IP address:", err);
    }

    try {
      const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
      console.log(`Starting localtunnel on port ${PORT}...`);
      tunnelProcess = spawn(cmd, ["localtunnel", "--port", PORT.toString()]);

      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          res.status(500).json({ error: "Tunnel startup timed out" });
        }
      }, 12000);

      tunnelProcess.stdout.on("data", (data: any) => {
        const output = data.toString();
        console.log(`[Tunnel stdout] ${output}`);
        const match = output.match(/your url is:\s*(https:\/\/[^\s]+)/i);
        if (match && match[1]) {
          tunnelUrl = match[1].trim();
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            res.json({ url: tunnelUrl, publicIp: tunnelPublicIp });
          }
        }
      });

      tunnelProcess.stderr.on("data", (data: any) => {
        console.error(`[Tunnel stderr] ${data.toString()}`);
      });

      tunnelProcess.on("close", (code: any) => {
        console.log(`Tunnel process exited with code ${code}`);
        tunnelUrl = null;
        tunnelProcess = null;
      });

      tunnelProcess.on("error", (err: any) => {
        console.error("Tunnel process error:", err);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          res.status(500).json({ error: err.message || "Failed to start tunnel process" });
        }
      });

    } catch (error: any) {
      console.error("Failed to start tunnel:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
