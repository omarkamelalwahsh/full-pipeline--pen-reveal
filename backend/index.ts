import express from "express";
import path from "path";
import { PORT } from "./config.ts";
import { jsonMiddleware } from "./middleware.ts";
import { getLocalIpAddresses } from "./helpers/network.ts";

// Route registrations
import registerTranscribeRoute from "./routes/transcribe.ts";
import registerSyncElementsRoute from "./routes/syncElements.ts";
import registerSegmentImageRoute from "./routes/segmentImage.ts";
import registerEditImageRoute from "./routes/editImage.ts";
import registerNarratorAudioRoute from "./routes/narratorAudio.ts";
import registerStoryboardImageRoute from "./routes/storyboardImage.ts";
import registerStoryboardPipelineRoute from "./routes/storyboardPipeline.ts";
import registerPipelineCreateRoute from "./routes/pipelineCreate.ts";
import registerNetworkInfoRoute from "./routes/networkInfo.ts";

const app = express();

// Middleware
app.use(jsonMiddleware);

// Register all API routes
registerTranscribeRoute(app);
registerSyncElementsRoute(app);
registerSegmentImageRoute(app);
registerEditImageRoute(app);
registerNarratorAudioRoute(app);
registerStoryboardImageRoute(app);
registerStoryboardPipelineRoute(app);
registerPipelineCreateRoute(app);
registerNetworkInfoRoute(app);

// Vite middleware for development
if (!process.env.VERCEL) {
  (async () => {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
        configLoader: "runner",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`\n🚀 Server is running!`);
      console.log(`🏠 Local:            http://localhost:${PORT}`);
      const localIps = getLocalIpAddresses();
      localIps.forEach(ip => {
        console.log(`🌐 On Your Network:  http://${ip}:${PORT}`);
      });
      console.log(`\n💡 To share this publicly over the internet, click "Share / Invite" in the UI.\n`);
    });
  })();
}

export default app;
