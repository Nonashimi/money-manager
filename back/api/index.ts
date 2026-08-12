import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { createNestApp } from '../src/create-app';

const server = express();
let bootstrapped: Promise<void> | null = null;

async function bootstrap() {
  const app = await createNestApp(new ExpressAdapter(server));
  await app.init();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!bootstrapped) {
    bootstrapped = bootstrap();
  }
  await bootstrapped;
  server(req, res);
}
