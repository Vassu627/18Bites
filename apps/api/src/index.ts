import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";
import pinoHttp from "pino-http";
import { config } from "./config";
import { logger } from "./lib/logger";
import authRoutes from "./routes/auth";
import groundsRoutes from "./routes/grounds";
import ordersRoutes from "./routes/orders";
import kitchenRoutes from "./routes/kitchen";
import riderRoutes from "./routes/rider";
import adminRoutes from "./routes/admin";
import menuRoutes from "./routes/menu";
import { verifyAccessToken } from "./lib/jwt";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: config.corsOrigin, credentials: true },
});

app.set("io", io);

app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === "/health" },
  })
);
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "18bites-api" });
});

app.use("/auth", authRoutes);
app.use("/grounds", groundsRoutes);
app.use("/orders", ordersRoutes);
app.use("/kitchen", kitchenRoutes);
app.use("/rider", riderRoutes);
app.use("/admin", adminRoutes);
app.use("/menu", menuRoutes);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error("Unauthorized"));
    return;
  }
  try {
    socket.data.user = verifyAccessToken(token);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.on("subscribe:order", (orderId: string) => {
    socket.join(`order:${orderId}`);
  });
});

httpServer.listen(config.port, () => {
  logger.info(`18Bites API listening on port ${config.port}`);
});
