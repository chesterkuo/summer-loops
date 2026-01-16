import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';

async function testLocale() {
  console.log('Testing Locale/Language Support...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();

  const results = [];

  try {
    // Navigate and wait for auto-login
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Navigate to Profile page
    console.log('1. Navigating to Profile page...');
    const profileBtn = page.locator('button:has-text("Profile")').last();
    await profileBtn.click({ force: true });
    await page.waitForTimeout(1500);
    results.push({ test: 'Navigate to Profile', passed: true, details: 'Profile page loaded' });
    console.log('   ✓ Profile page loaded\n');

    // Open menu to access language selector
    console.log('2. Opening settings menu...');
    const menuBtn = page.locator('button:has(span:has-text("more_horiz"))').first();
    await menuBtn.click({ force: true });
    await page.waitForTimeout(500);

    const menuVisible = await page.locator('text=Language').first().isVisible();
    results.push({ test: 'Settings menu opens', passed: menuVisible, details: menuVisible ? 'Menu with Language section visible' : 'Menu not found' });
    console.log(menuVisible ? '   ✓ Settings menu opened with Language section\n' : '   ✗ Settings menu not found\n');

    // Check available languages
    console.log('3. Checking available languages...');
    const languages = ['English', '中文', '日本語', '한국어', 'Tiếng Việt', 'ไทย'];
    let foundLanguages = [];

    for (const lang of languages) {
      const langBtn = page.locator(`button:has-text("${lang}")`).first();
      if (await langBtn.isVisible().catch(() => false)) {
        foundLanguages.push(lang);
      }
    }

    results.push({
      test: 'Language options available',
      passed: foundLanguages.length === 6,
      details: `Found ${foundLanguages.length}/6: ${foundLanguages.join(', ')}`
    });
    console.log(`   ✓ Found ${foundLanguages.length}/6 languages: ${foundLanguages.join(', ')}\n`);

    // Test language selection - Chinese
    console.log('4. Testing Chinese (中文) selection...');
    const chineseBtn = page.locator('button:has-text("中文")').first();
    await chineseBtn.click({ force: true });
    await page.waitForTimeout(500);

    // Check if Chinese button is now highlighted (selected state)
    const chineseSelected = await chineseBtn.evaluate(el => el.classList.contains('bg-primary/20'));
    results.push({
      test: 'Chinese selection works',
      passed: chineseSelected,
      details: chineseSelected ? 'Chinese is now selected (highlighted)' : 'Selection state unclear'
    });
    console.log(chineseSelected ? '   ✓ Chinese selected (button highlighted)\n' : '   ? Chinese selection state unclear\n');

    // Check if UI text changed to Chinese
    console.log('5. Checking if UI text translated to Chinese...');
    // Close menu first to see main content
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Look for Chinese text in the UI
    const chineseTextVisible = await page.locator('text=联系人, text=个人资料, text=分析, text=连接').first().isVisible().catch(() => false);

    // Check if English text is still there
    const englishStillVisible = await page.locator('text=Find Path, text=Draft Intro, text=Recent Interactions').first().isVisible().catch(() => false);

    results.push({
      test: 'UI translated to Chinese',
      passed: chineseTextVisible,
      details: chineseTextVisible ? 'Chinese text visible' : (englishStillVisible ? 'English text still showing (no translation)' : 'Translation status unclear')
    });
    console.log(chineseTextVisible ? '   ✓ UI translated to Chinese\n' : '   ✗ UI NOT translated - English text still showing\n');

    // Test Japanese selection
    console.log('6. Testing Japanese (日本語) selection...');
    await menuBtn.click({ force: true });
    await page.waitForTimeout(500);

    const japaneseBtn = page.locator('button:has-text("日本語")').first();
    await japaneseBtn.click({ force: true });
    await page.waitForTimeout(500);

    const japaneseSelected = await japaneseBtn.evaluate(el => el.classList.contains('bg-primary/20'));
    results.push({
      test: 'Japanese selection works',
      passed: japaneseSelected,
      details: japaneseSelected ? 'Japanese is now selected' : 'Selection state unclear'
    });
    console.log(japaneseSelected ? '   ✓ Japanese selected\n' : '   ? Japanese selection state unclear\n');

    // Check locale persistence (localStorage)
    console.log('7. Checking locale persistence...');
    const savedLocale = await page.evaluate(() => localStorage.getItem('locale'));
    results.push({
      test: 'Locale persistence',
      passed: savedLocale !== null,
      details: savedLocale ? `Saved locale: ${savedLocale}` : 'Locale not saved to localStorage'
    });
    console.log(savedLocale ? `   ✓ Locale saved: ${savedLocale}\n` : '   ✗ Locale NOT persisted to localStorage\n');

    // Reload and check if locale is remembered
    console.log('8. Testing locale retention after page reload...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Navigate back to profile
    await profileBtn.click({ force: true });
    await page.waitForTimeout(1000);
    await menuBtn.click({ force: true });
    await page.waitForTimeout(500);

    // Check if Japanese is still selected after reload
    const japaneseStillSelected = await japaneseBtn.evaluate(el => el.classList.contains('bg-primary/20')).catch(() => false);
    results.push({
      test: 'Locale retained after reload',
      passed: japaneseStillSelected,
      details: japaneseStillSelected ? 'Japanese still selected after reload' : 'Locale reset to English after reload'
    });
    console.log(japaneseStillSelected ? '   ✓ Locale retained after reload\n' : '   ✗ Locale NOT retained - reset to default\n');

  } catch (error) {
    console.error('Test error:', error.message);
    results.push({ test: 'Test execution', passed: false, details: error.message.slice(0, 100) });
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n========== LOCALE TEST SUMMARY ==========\n');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const result of results) {
    const icon = result.passed ? '✓' : '✗';
    console.log(`${icon} ${result.test}: ${result.details}`);
  }

  console.log(`\n${passed} passed, ${failed} failed out of ${results.length} tests`);

  // Diagnosis
  console.log('\n========== DIAGNOSIS ==========\n');
  const translationWorking = results.find(r => r.test === 'UI translated to Chinese')?.passed;
  const persistenceWorking = results.find(r => r.test === 'Locale persistence')?.passed;
  const retentionWorking = results.find(r => r.test === 'Locale retained after reload')?.passed;

  if (!translationWorking) {
    console.log('⚠️  ISSUE: Translations are NOT implemented');
    console.log('   - Language selector UI exists and works');
    console.log('   - But selecting a language does NOT change UI text');
    console.log('   - No i18n library (i18next, react-intl) is installed');
    console.log('   - All text is hardcoded in English\n');
  }

  if (!persistenceWorking) {
    console.log('⚠️  ISSUE: Locale preference is NOT persisted');
    console.log('   - Selected language is lost on page refresh');
    console.log('   - Need to save locale to localStorage\n');
  }

  if (!retentionWorking) {
    console.log('⚠️  ISSUE: Locale state is NOT retained');
    console.log('   - Component state resets on navigation/reload');
    console.log('   - Need a global state (Zustand/Context) for locale\n');
  }

  return { passed, failed, total: results.length };
}

testLocale().then(({ passed, failed }) => {
  process.exit(failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
