import { Context, MiddlewareFn } from "telegraf";
import { config } from "./config.js";

export const authMiddleware: MiddlewareFn<Context> = (ctx, next) => {
  const userId = ctx.from?.id;

  if (!userId || !config.allowed_users.includes(userId)) {
    console.log(`Unauthorized access attempt from user ${userId}`);
    return;
  }

  return next();
};
