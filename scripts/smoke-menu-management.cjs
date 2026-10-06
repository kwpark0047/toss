// UI-only fixtures: all API/socket traffic is intercepted; no production data or writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

async function main() {
  let base = process.argv[2];
  let server;
  if (!base) {
    const root = path.resolve(__dirname, '../frontend/dist');
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
    server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = path.resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        if (path.extname(pathname)) { res.writeHead(404).end(); return; }
        file = path.join(root, 'index.html');
      }
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }

  const browser=await chromium.launch({headless:true});const results=[];
  try{for(const [name,width,theme]of [['desktop-dark',1440,'obsidian'],['desktop-light',1440,'arctic'],['mobile',390,'arctic']]){
    const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
    const payload=Buffer.from(JSON.stringify({id:3,name:'검증 매장',role:'user',type:'access',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
    await context.addInitScript(({token,theme})=>{localStorage.setItem('token',token);localStorage.setItem('adm-theme',theme);},{token:'eyJhbGciOiJIUzI1NiJ9.'+payload+'.fixture',theme});
    await context.routeWebSocket('**',socket=>socket.close());let fail=false;
    await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.pathname.includes('/socket.io'))return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();const store={id:3,name:'검증 매장',user_id:3};let data=[];
      if(u.pathname==='/api/stores/my')data=[store];else if(u.pathname==='/api/stores/3')data=store;
      else if(u.pathname.includes('/categories/store/'))data=[{id:1,name:'음료'},{id:2,name:'디저트'}];
      else if(u.pathname.includes('/products/store/')){if(fail)return route.fulfill({status:500,json:{message:'fixture error'}});data=[{id:1,name:'카페 라떼',price:5000,category_id:1,is_sold_out:false},{id:2,name:'아메리카노',price:4000,category_id:1,is_sold_out:false},{id:3,name:'초콜릿 케이크',price:6000,category_id:2,is_sold_out:true}];}
      return route.fulfill({json:{success:true,data}});
    });const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(new URL('/admin/stores/3/menu',base).href,{waitUntil:'domcontentloaded'});
    try{
      await page.getByRole('button',{name:'카페 라떼',exact:true}).waitFor();
      const geometry=await page.locator('.menu-product-row').first().evaluate(el=>({top:el.getBoundingClientRect().top,width:document.documentElement.scrollWidth,viewport:innerWidth}));
      assert.ok(geometry.width<=width+1,'page has no horizontal overflow');assert.ok(geometry.top<700,'menu rows visible without a large empty screen');
      await page.screenshot({path:path.resolve('reports','menu-management-'+name+'.png')});
      await page.getByRole('searchbox',{name:'메뉴 검색'}).fill('라떼');assert.equal(await page.locator('.menu-product-row').count(),1);
      await page.getByRole('checkbox',{name:'카페 라떼 선택'}).check();await page.getByRole('region',{name:'선택 메뉴 일괄 작업'}).waitFor();
      await page.getByRole('combobox',{name:'판매 상태 필터'}).selectOption('sold-out');await page.getByText('조건에 맞는 메뉴가 없습니다',{exact:true}).waitFor();assert.equal(await page.getByRole('region',{name:'선택 메뉴 일괄 작업'}).count(),0);
      await page.getByRole('button',{name:'필터 초기화',exact:true}).click();assert.equal(await page.locator('.menu-product-row').count(),3);
      await page.getByRole('combobox',{name:'판매 상태 필터'}).selectOption('sold-out');assert.equal(await page.locator('.menu-product-row').count(),1);await page.getByRole('button',{name:'초콜릿 케이크',exact:true}).waitFor();
      await page.getByRole('button',{name:'필터 초기화',exact:true}).click();
      if(width<1024){await page.getByRole('combobox',{name:'카테고리 필터'}).selectOption('2');assert.equal(await page.locator('.menu-product-row').count(),1);await page.getByRole('button',{name:'필터 초기화',exact:true}).click();}
      await page.getByText('가져오기 · 옵션 도구',{exact:true}).click();await page.getByRole('button',{name:'다른 매장 메뉴 가져오기',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
      fail=true;await page.getByRole('button',{name:'메뉴 새로고침'}).click();await page.getByRole('alert').filter({hasText:'메뉴를 불러오지 못했습니다'}).waitFor();assert.equal(await page.locator('.menu-product-row').count(),3);
      fail=false;await page.getByRole('button',{name:'다시 조회',exact:true}).click();await page.getByRole('alert').filter({hasText:'메뉴를 불러오지 못했습니다'}).waitFor({state:'hidden'});
      await page.getByRole('button',{name:'메뉴 추가',exact:true}).click();await page.getByPlaceholder('메뉴 이름을 입력하세요').waitFor();
      await page.goto(new URL('/admin/stores/3/visual-builder',base).href);await page.getByRole('heading',{name:'메뉴판 비주얼 빌더'}).waitFor();await page.getByRole('button',{name:'레이아웃',exact:true}).click();for(const label of ['그리드','리스트','매거진'])await page.getByRole('button').filter({hasText:label}).first().click();
      assert.equal(errors.length,0,errors.join(';'));results.push({name,fixtureData:true,...geometry,pageErrors:errors});
    }catch(error){console.error(JSON.stringify({name,url:page.url(),errors,body:(await page.locator('body').innerText()).slice(0,1600)}));throw error;}await context.close();
  }fs.writeFileSync('reports/menu-management-browser-validation.json',JSON.stringify({passed:true,base,results},null,2));console.log(JSON.stringify({passed:true,results}));
  }finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
