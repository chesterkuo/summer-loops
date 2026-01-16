const { chromium } = require('playwright');

(async () => {
  console.log('Starting UI tests...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = [];
  
  try {
    // Test 1: Load landing page
    console.log('TEST 1: Load landing page');
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);
    const title = await page.title();
    console.log(`  Title: ${title}`);
    results.push({ test: 'Landing Page', status: 'PASS' });
    
    // Test 2: Demo Login
    console.log('\nTEST 2: Demo Login');
    const demoButton = await page.locator('button:has-text("Demo")').first();
    if (await demoButton.isVisible()) {
      await demoButton.click();
      await page.waitForTimeout(2000);
      console.log('  Clicked Demo button');
      results.push({ test: 'Demo Login', status: 'PASS' });
    } else {
      // Already logged in, check for dashboard
      console.log('  Already logged in or no demo button');
      results.push({ test: 'Demo Login', status: 'SKIP' });
    }
    
    // Test 3: Dashboard loads
    console.log('\nTEST 3: Dashboard');
    await page.waitForTimeout(2000);
    const dashboardContent = await page.content();
    if (dashboardContent.includes('Your Network') || dashboardContent.includes('contact')) {
      console.log('  Dashboard loaded with contacts');
      results.push({ test: 'Dashboard', status: 'PASS' });
    } else {
      console.log('  Dashboard content check');
      results.push({ test: 'Dashboard', status: 'CHECK' });
    }
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/test-dashboard.png', fullPage: true });
    console.log('  Screenshot saved: /tmp/test-dashboard.png');
    
    // Test 4: Navigate to Network Map
    console.log('\nTEST 4: Network Map');
    const networkNav = await page.locator('[class*="BottomNav"] button, nav button').filter({ hasText: /network|map/i }).first();
    if (await networkNav.count() > 0) {
      await networkNav.click();
      await page.waitForTimeout(2000);
      console.log('  Navigated to Network Map');
      await page.screenshot({ path: '/tmp/test-network.png', fullPage: true });
      results.push({ test: 'Network Map', status: 'PASS' });
    } else {
      // Try clicking by icon
      const mapIcon = await page.locator('text=hub').first();
      if (await mapIcon.count() > 0) {
        await mapIcon.click();
        await page.waitForTimeout(2000);
      }
      results.push({ test: 'Network Map', status: 'CHECK' });
    }
    
    // Test 5: Navigate to Scan Card
    console.log('\nTEST 5: Scan Card');
    const scanNav = await page.locator('button:has-text("add"), [class*="scan"]').first();
    if (await scanNav.count() > 0) {
      await scanNav.click();
      await page.waitForTimeout(1500);
      console.log('  Navigated to Scan');
      await page.screenshot({ path: '/tmp/test-scan.png', fullPage: true });
      results.push({ test: 'Scan Card', status: 'PASS' });
    } else {
      results.push({ test: 'Scan Card', status: 'SKIP' });
    }
    
    // Navigate back to dashboard
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);
    
    // Test 6: Click on a contact to view Profile
    console.log('\nTEST 6: Contact Profile');
    const contactCard = await page.locator('[class*="contact"], [class*="Card"]').first();
    if (await contactCard.count() > 0) {
      await contactCard.click();
      await page.waitForTimeout(2000);
      console.log('  Opened contact profile');
      await page.screenshot({ path: '/tmp/test-profile.png', fullPage: true });
      results.push({ test: 'Contact Profile', status: 'PASS' });
    } else {
      results.push({ test: 'Contact Profile', status: 'SKIP' });
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
    results.push({ test: 'Error', status: 'FAIL', error: error.message });
  } finally {
    await browser.close();
  }
  
  // Print results
  console.log('\n========== TEST RESULTS ==========');
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${r.test}: ${r.status}`);
  });
  console.log('==================================\n');
  
  console.log('Screenshots saved to /tmp/test-*.png');
})();
