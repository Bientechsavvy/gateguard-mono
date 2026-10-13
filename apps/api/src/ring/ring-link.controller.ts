import { Body, Controller, Get, Logger, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'crypto';
import type { Response } from 'express';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

const ALLOWED_HOSTS = ['ring.com', 'amazon.com', 'amazonvision.com'];

function redirectAllowed(uri: string): boolean {
  try {
    const u = new URL(uri);
    return (
      u.protocol === 'https:' &&
      ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))
    );
  } catch {
    return false;
  }
}

@Controller('ring')
export class RingLinkController {
  private readonly logger = new Logger(RingLinkController.name);
  private readonly pendingCodes = new Map<string, { exp: number }>();

  constructor(private readonly config: ConfigService) {}

  private page(body: string): string {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GateGuard</title><style>body{font-family:system-ui,sans-serif;max-width:420px;margin:12vh auto;padding:0 16px}input,button{width:100%;padding:12px;margin:8px 0;font-size:16px;box-sizing:border-box}</style></head><body><h2>GateGuard</h2>${body}</body></html>`;
  }

  @Get('link')
  link(@Query() q: Record<string, string>, @Res() res: Response) {
    this.logger.log(`Account link request, params: ${Object.keys(q).join(', ') || '(none)'}`);
    if (q.nonce && q.time) {
      const age = Date.now() - Number(q.time);
      if (!Number.isFinite(age) || age > 600_000 || age < -60_000) {
        return res.status(400).send(this.page('<p>This link has expired. Start again from Ring.</p>'));
      }
    }
    if (q.redirect_uri && !redirectAllowed(q.redirect_uri)) {
      return res.status(400).send(this.page('<p>Invalid redirect address.</p>'));
    }
    const hidden = ['nonce', 'time', 'redirect_uri', 'state']
      .map((k) => (q[k] ? `<input type="hidden" name="${k}" value="${esc(q[k])}">` : ''))
      .join('');
    return res.send(
      this.page(
        `<p>Sign in to link your Ring account.</p><form method="post" action="/ring/link">${hidden}<input type="password" name="key" placeholder="Dashboard key" required><button type="submit">Link Ring account</button></form>`,
      ),
    );
  }

  @Post('link')
  confirm(@Body() b: Record<string, string>, @Res() res: Response) {
    const expected = this.config.get<string>('DASHBOARD_API_KEY') ?? '';
    const a = Buffer.from(String(b.key ?? ''));
    const e = Buffer.from(expected);
    if (!expected || a.length !== e.length || !timingSafeEqual(a, e)) {
      return res.status(401).send(this.page('<p>Wrong dashboard key.</p>'));
    }
    if (b.redirect_uri && b.state) {
      if (!redirectAllowed(b.redirect_uri)) {
        return res.status(400).send(this.page('<p>Invalid redirect address.</p>'));
      }
      const code = randomBytes(24).toString('base64url');
      this.pendingCodes.set(code, { exp: Date.now() + 60_000 });
      const url = new URL(b.redirect_uri);
      url.searchParams.set('state', b.state);
      url.searchParams.set('code', code);
      this.logger.log('Account link approved, redirecting back to Ring with code');
      return res.redirect(url.toString());
    }
    this.logger.log(`Account link approved (nonce flow), nonce present: ${Boolean(b.nonce)}`);
    return res.send(this.page('<p>Your Ring account is linked to GateGuard.</p>'));
  }

  @Post('token')
  token(@Body() b: Record<string, string>, @Res() res: Response) {
    this.logger.log(`Token exchange request, fields: ${Object.keys(b ?? {}).join(', ') || '(none)'}`);
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
}