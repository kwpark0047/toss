/**
 * Routing Tests - Verifies all routes and links are properly defined
 * Prevents 404 errors from route/link mismatches
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.join(__dirname, '..', '..', 'frontend', 'src');

describe('Route Validation', () => {
  // Get all routes defined in App.jsx
  const getRoutes = () => {
    const appContent = fs.readFileSync(path.join(FRONTEND_SRC, 'App.jsx'), 'utf-8');
    return new Set([...appContent.matchAll(/path="([^"]+)"/g)].map((m) => m[1]));
  };

  // Get all sidebar links from AdminLayout.jsx
  const getSidebarLinks = () => {
    const adminLayoutPath = path.join(FRONTEND_SRC, 'components', 'admin', 'AdminLayout.jsx');
    const content = fs.readFileSync(adminLayoutPath, 'utf-8');
    return new Set([...content.matchAll(/path:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
  };

  // Get all marketing links from landing pages
  const getMarketingLinks = () => {
    const links = new Set();
    const pagesDir = path.join(FRONTEND_SRC, 'pages');
    const files = [
      path.join(pagesDir, 'LandingPage.jsx'),
      path.join(pagesDir, 'FoodTruckDesignShowcase.jsx'),
    ];

    for (const file of files) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const m of content.matchAll(/to=["']([^"']+)["']/g)) {
          if (m[1].startsWith('/')) {
            links.add(m[1]);
          }
        }
      }
    }
    return links;
  };

  // Check if a link matches any route (accounting for dynamic params)
  const matchesRoute = (link, routes) => {
    if (routes.has(link)) return true;

    const linkParts = link.split('/').filter((p) => p);
    for (const route of routes) {
      const routeParts = route.split('/').filter((p) => p);
      if (linkParts.length !== routeParts.length) continue;

      let match = true;
      for (let i = 0; i < linkParts.length; i++) {
        if (routeParts[i].startsWith(':')) continue;
        if (linkParts[i] !== routeParts[i]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    return false;
  };

  const routes = getRoutes();
  const sidebarLinks = getSidebarLinks();
  const marketingLinks = getMarketingLinks();

  test('All sidebar links have matching routes', () => {
    const mismatches = [...sidebarLinks].filter((link) => !matchesRoute(link, routes));
    expect(mismatches).toEqual([]);
  }, 10000);

  test('All marketing links have matching routes', () => {
    const mismatches = [...marketingLinks].filter((link) => !matchesRoute(link, routes));
    expect(mismatches).toEqual([]);
  }, 10000);

  test('App.jsx has /admin route', () => {
    expect(routes.has('/admin')).toBe(true);
  });

  test('App.jsx has /admin/tinkerbell route', () => {
    expect(routes.has('/admin/tinkerbell')).toBe(true);
  });

  test('App.jsx has /admin/system-status route', () => {
    expect(routes.has('/admin/system-status')).toBe(true);
  });

  test('App.jsx has /admin/bulk-sms route', () => {
    expect(routes.has('/admin/bulk-sms')).toBe(true);
  });

  test('App.jsx has /admin/community route', () => {
    expect(routes.has('/admin/community')).toBe(true);
  });

  test('App.jsx has /admin/plan-requests route', () => {
    expect(routes.has('/admin/plan-requests')).toBe(true);
  });

  test('App.jsx has /foodtruck/landing route', () => {
    expect(routes.has('/foodtruck/landing')).toBe(true);
  });

  test('App.jsx has /foodtruck/showcase route', () => {
    expect(routes.has('/foodtruck/showcase')).toBe(true);
  });

  test('App.jsx has /legal/:storeId/:type route', () => {
    expect(routes.has('/legal/:storeId/:type')).toBe(true);
  });

  test('App.jsx has redirect for /admin/profile', () => {
    expect(routes.has('/admin/profile')).toBe(true);
  });

  test('App.jsx has redirect for /board', () => {
    expect(routes.has('/board')).toBe(true);
  });

  test('App.jsx has redirect for /stores', () => {
    expect(routes.has('/stores')).toBe(true);
  });

  test('Google Fonts uses v1 format (no woff2 404)', () => {
    const indexHtml = fs.readFileSync(path.join(FRONTEND_SRC, '..', 'index.html'), 'utf-8');
    expect(indexHtml).toContain('fonts.googleapis.com/css?');
    expect(indexHtml).not.toContain('fonts.googleapis.com/css2?');
  });

  test('All components used in App.jsx routes are imported', () => {
    const appContent = fs.readFileSync(path.join(FRONTEND_SRC, 'App.jsx'), 'utf-8');

    // Get all imports from lazyImports
    const importMatch = appContent.match(/import\s*\{([^}]+)\}\s*from\s*"@\/routes\/lazyImports"/);
    const importedNames = new Set(importMatch[1].split(',').map((name) => name.trim()));

    // Get all component names used in Route elements
    const usedComponents = new Set(
      [...appContent.matchAll(/element=\{.*?<([A-Z][a-zA-Z]*)</g)].map((m) => m[1])
    );

    // Remove non-lazyImports components
    const exclude = new Set([
      'AdminPage',
      'ValidStoreRoute',
      'AdminSuspense',
      'ProtectedRoute',
      'Navigate',
      'RoleBasedRoute',
    ]);
    const componentsToCheck = [...usedComponents].filter((c) => !exclude.has(c));

    // Check that all used components are imported from lazyImports
    for (const comp of componentsToCheck) {
      expect(importedNames.has(comp)).toBe(true);
    }
  });

  test('PlanRequestsManage is exported from lazyImports', () => {
    const lazyImports = fs.readFileSync(
      path.join(FRONTEND_SRC, 'routes', 'lazyImports.js'),
      'utf-8'
    );
    expect(lazyImports).toContain('PlanRequestsManage');
  });
});
