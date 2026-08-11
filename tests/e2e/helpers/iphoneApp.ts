import { expect, type Locator, type Page, type Route } from '@playwright/test';

const E2E_USER_ID = '00000000-0000-4000-8000-000000000001';
const E2E_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000002';

const toBase64Url = (value: object): string => Buffer
  .from(JSON.stringify(value))
  .toString('base64url');

const createAccessToken = (): string => {
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  return [
    toBase64Url({ alg: 'HS256', typ: 'JWT' }),
    toBase64Url({
      aud: 'authenticated',
      exp: expiresAt,
      role: 'authenticated',
      sub: E2E_USER_ID,
    }),
    'e2e-signature',
  ].join('.');
};

export interface BlockedRequest {
  method: string;
  url: string;
}

const fulfillJson = (
  route: Route,
  body: unknown,
  headers: Record<string, string>,
  status = 200,
) => route.fulfill({
  status,
  headers: { ...headers, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export async function seedOfflineSession(
  page: Page,
  options: { communityAccessGranted: boolean },
): Promise<BlockedRequest[]> {
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const session = {
    access_token: createAccessToken(),
    refresh_token: 'e2e-refresh-token',
    expires_in: 24 * 60 * 60,
    expires_at: expiresAt,
    token_type: 'bearer',
    user: {
      id: E2E_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'iphone.e2e@peliculasbr.test',
      email_confirmed_at: now,
      phone: '',
      confirmed_at: now,
      last_sign_in_at: now,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: 'Teste iPhone' },
      identities: [],
      created_at: now,
      updated_at: now,
      is_anonymous: false,
    },
  };
  const profile = {
    id: E2E_USER_ID,
    email: session.user.email,
    role: 'user',
    organization_id: E2E_ORGANIZATION_ID,
    community_access_granted_at: options.communityAccessGranted ? now : null,
    full_name: 'Teste iPhone',
    created_at: now,
    updated_at: now,
  };
  const cachedScope = {
    profile,
    memberStatus: 'active',
    memberRole: 'owner',
    isOwner: true,
  };

  await page.addInitScript(
    ({ persistedSession, persistedScope }) => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });

      window.localStorage.setItem('peliculas-br-bd-auth-v4', JSON.stringify(persistedSession));
      window.localStorage.setItem('peliculas-br-bd-auth-scope-v1', JSON.stringify(persistedScope));
      window.localStorage.setItem('peliculas-br-bd-pdf_migration_v1', 'true');
      window.localStorage.setItem('peliculas-br-push-auto-repair-disabled', '1');
      window.localStorage.setItem('peliculas-br-onboarding-v1', 'done');
      window.localStorage.removeItem('peliculas-br-selected-client-id');
    },
    { persistedSession: session, persistedScope: cachedScope },
  );

  const member = {
    id: 'e2e-member',
    organization_id: E2E_ORGANIZATION_ID,
    user_id: E2E_USER_ID,
    email: session.user.email,
    role: 'owner',
    status: 'active',
    invited_at: now,
    joined_at: now,
  };
  const subscription = {
    subscription_id: 'e2e-subscription',
    limits: {
      max_clients: 10,
      max_films: 5,
      max_pdfs_month: 10,
      max_agendamentos_month: 5,
    },
    active_modules: [],
    usage: { pdfs_generated: 0, agendamentos_created: 0 },
    usage_resets_at: now,
    trial_ends_at: null,
    abacate_customer_id: null,
    modules_detail: null,
  };
  const blockedWrites: BlockedRequest[] = [];
  const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,HEAD,POST,PATCH,DELETE,OPTIONS',
    'access-control-expose-headers': 'content-range',
  };

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isLocal = url.hostname === '127.0.0.1' || url.hostname === 'localhost';

    if (isLocal) {
      await route.continue();
      return;
    }

    if (!url.hostname.endsWith('.supabase.co')) {
      await route.abort('blockedbyclient');
      return;
    }

    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          ...corsHeaders,
          'access-control-allow-headers':
            request.headers()['access-control-request-headers'] || '*',
        },
      });
      return;
    }

    const pathname = url.pathname;
    if (pathname === '/rest/v1/profiles') {
      await fulfillJson(route, profile, corsHeaders);
      return;
    }
    if (pathname === '/rest/v1/organization_members') {
      await fulfillJson(route, member, corsHeaders);
      return;
    }
    if (pathname === '/rest/v1/organizations') {
      await fulfillJson(route, { owner_id: E2E_USER_ID }, corsHeaders);
      return;
    }
    if (pathname === '/rest/v1/subscription_modules') {
      await fulfillJson(route, [], corsHeaders);
      return;
    }
    if (pathname === '/rest/v1/rpc/get_subscription_info') {
      await fulfillJson(route, subscription, corsHeaders);
      return;
    }

    if (request.method() === 'GET' || request.method() === 'HEAD') {
      await fulfillJson(route, [], corsHeaders);
      return;
    }

    blockedWrites.push({ method: request.method(), url: request.url() });
    await fulfillJson(
      route,
      { message: 'Bloqueado pelo fixture offline do Playwright' },
      corsHeaders,
      403,
    );
  });

  await page.routeWebSocket(/^wss:\/\/.*\.supabase\.co\//, (webSocket) => {
    webSocket.close();
  });

  return blockedWrites;
}

export async function expectLocatorInsideViewport(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const page = locator.page();
  const viewport = page.viewportSize();
  const box = await locator.boundingBox();

  expect(viewport, 'O projeto precisa usar um perfil de dispositivo com viewport').not.toBeNull();
  expect(box, 'O controle precisa ter uma área clicável').not.toBeNull();

  if (!viewport || !box) return;

  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);

  const receivesPointerAtCenter = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return target === element || (target !== null && element.contains(target));
  });
  expect(
    receivesPointerAtCenter,
    'Nenhum overlay deve interceptar o centro do controle',
  ).toBe(true);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}
