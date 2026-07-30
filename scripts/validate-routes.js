/**
 * Route Validation Tool
 * Validates that all sidebar/link paths have matching routes in App.jsx
 * Prevents 404 errors from route/link mismatches
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.join(__dirname, '..', 'frontend', 'src');

// Routes defined in App.jsx
function getRoutes() {
  const appContent = fs.readFileSync(
    path.join(FRONTEND_SRC, 'App.jsx'),
    'utf-8'
  );
  return new Set([...appContent.matchAll(/path="([^"]+)"/g)].map(m => m[1]));
}

// Links from AdminLayout.jsx (sidebar navigation)
function getSidebarLinks() {
  const adminLayoutPath = path.join(FRONTEND_SRC, 'components', 'admin', 'AdminLayout.jsx');
  const content = fs.readFileSync(adminLayoutPath, 'utf-8');
  return new Set([...content.matchAll(/path:\s*['"]([^'"]+)['"]/g)].map(m => m[1]));
}

// Links from marketing/landing pages
function getMarketingLinks() {
  const links = new Set();
  const pagesDir = path.join(FRONTEND_SRC, 'pages');
  const files = [
    path.join(pagesDir, 'LandingPage.jsx'),
    path.join(pagesDir, 'FoodTruckDesignShowcase.jsx'),
    path.join(pagesDir, 'foodtruck', 'FoodTruckContact.jsx'),
    path.join(pagesDir, 'foodtruck', 'FoodTruckFeatures.jsx'),
    path.join(pagesDir, 'foodtruck', 'FoodTruckGuides.jsx'),
    path.join(pagesDir, 'foodtruck', 'FoodTruckPricing.jsx'),
    path.join(pagesDir, 'marketing', 'ContactPage.jsx'),
    path.join(pagesDir, 'marketing', 'FeaturesPage.jsx'),
    path.join(pagesDir, 'marketing', 'GuidesPage.jsx'),
    path.join(pagesDir, 'marketing', 'PricingPage.jsx'),
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
}

// Links from MasterDashboard.jsx
function getDashboardLinks() {
  const masterPath = path.join(FRONTEND_SRC, 'components', 'admin', 'MasterDashboard.jsx');
  const content = fs.readFileSync(masterPath, 'utf-8');
  return new Set([...content.matchAll(/navTo:\s*['"]([^'"]+)['"]/g)].map(m => m[1]));
}

// Check if a link matches any route (accounting for dynamic params)
function matchesRoute(link, routes) {
  if (routes.has(link)) return true;

  // Check if link matches a dynamic route pattern
  const linkParts = link.split('/').filter(p => p);
  for (const route of routes) {
    const routeParts = route.split('/').filter(p => p);
    if (linkParts.length !== routeParts.length) continue;

    let match = true;
    for (let i = 0; i < linkParts.length; i++) {
      if (routeParts[i].startsWith(':')) continue; // Dynamic param
      if (linkParts[i] !== routeParts[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

function main() {
  const routes = getRoutes();
  const sidebarLinks = getSidebarLinks();
  const marketingLinks = getMarketingLinks();
  const dashboardLinks = getDashboardLinks();

  const allLinks = new Set([...sidebarLinks, ...marketingLinks, ...dashboardLinks]);

  console.log(`🔍 Route Validation Report`);
  console.log(`   Routes: ${routes.size}`);
  console.log(`   Sidebar links: ${sidebarLinks.size}`);
  console.log(`   Marketing links: ${marketingLinks.size}`);
  console.log(`   Dashboard links: ${dashboardLinks.size}`);
  console.log(`   Total unique links: ${allLinks.size}`);
  console.log('');

  const mismatches = [];
  for (const link of allLinks) {
    if (!matchesRoute(link, routes)) {
      mismatches.push(link);
    }
  }

  if (mismatches.length > 0) {
    console.error('🚨 Route mismatches found:');
    for (const m of mismatches) {
      console.error(`  ❌ ${m}`);
    }
    console.error(`\n${mismatches.length} route(s) without matching paths.`);
    process.exit(1);
  } else {
    console.log('✅ All links have matching routes!');
  }
}

main();
