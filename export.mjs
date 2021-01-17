import puppeteer from 'puppeteer-extra';
import pluginStealth from 'puppeteer-extra-plugin-stealth';
import readline from 'readline-promise';
import dotenv from 'dotenv';

dotenv.config();
puppeteer.use(pluginStealth());

const exportZennArticleToPDF = async ({
  email = process.env.GOOGLE_EMAIL,
  password = process.env.GOOGLE_PASSWORD,
  pageUrl = process.env.ZENN_PAGE_URL, // example: https://zenn.dev/zenn/books/how-to-create-book/print
  pdfPath = process.env.PDF_PATH || 'prod.pdf',
  isTwoFA = process.env.IS_TWO_FA || true,
  twoFATool = process.env.TWO_FA_TOOL || 'APP', // APP or SMS
  headless = true,
}) => {
  if (!email || !password || !pageUrl) { 
    throw new Error('You must set following environment valuables: GOOGLE_EMAIL, GOOGLE_PASSWORD and ZENN_PAGE_URL');
  }

  // Launch puppeteer browser.
  const browser = await puppeteer.launch({ headless });
  console.log('Opening chromium browser...');

  const rlp = readline.default.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });
  const page = await browser.newPage();
  const navigationPromise = page.waitForNavigation({ waitUntil: ['load', 'networkidle2'] });
  const pages = await browser.pages();
  // Close the new tab that chromium always opens first.
  pages[0].close();
  await page.goto('https://zenn.dev/enter', { waitUntil: 'networkidle2' });

  // click login button
  await page.waitForSelector('button.enter-login-btn');
  await page.click('button.enter-login-btn');
  await navigationPromise;

  // login with google
  await page.waitForSelector('#identifierId');

  // input email
  await page.type('#identifierId', email);
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  // input password
  await page.waitForSelector('input[type="password"]');
  await page.type('input[type="password"]', password);
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');
  // Login via gmail app works autmatically.
  await page.waitForTimeout(1000);

  // For headless mode, 2FA needs to be handled here.
  if (isTwoFA) {
    const twoFASelector = {
      APP: '[data-challengetype="6"]',
      SMS: '[data-sendmethod="SMS"]',
    };

    await page.waitForSelector(twoFASelector[twoFATool]);
    await page.waitForTimeout(500);
    await page.focus(twoFASelector[twoFATool]);
    await page.keyboard.press('Enter');
  
    const code = await rlp.questionAsync('Enter your G-code: ');
    console.log('Finishing up...');
    await page.waitForSelector('input[type="tel"]');
    await page.click('input[type="tel"]');
    await page.waitForTimeout(1000);
    await page.type('input[type="tel"]', code);
  
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
  }

  // zenn
  await page.waitForRequest(request => {
    return  request.url().includes('zenn.dev') && request.method() === 'GET'
  });
  await page.waitForSelector('#__next');
  await page.waitForTimeout(2000);

  // goto the article page
  await page.goto(pageUrl, { waitUntil: ['load', 'networkidle2'] });

  // update css style
  await page.addStyleTag({path: 'zenn_pdf.css'});

  // export the article page to PDF
  await page.pdf({ 
    path: pdfPath,
    format: 'A4',  
  });
  console.log(`The article was successfully exported to PDF 🎉`);
  console.log(`export: ${process.env.PWD}/${pdfPath}`);

  await browser.close();
  rlp.close();
};

await exportZennArticleToPDF({});
