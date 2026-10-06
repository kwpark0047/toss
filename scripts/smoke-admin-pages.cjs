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

  const browser = await chromium.launch({headless:true});
  const results=[];
  try {
    for(const slug of ['settlements','legal','pricing','campaigns','store-settings','settings']) {
      const context=await browser.newContext({serviceWorkers:'block'});
      const payload=Buffer.from(JSON.stringify({id:3,name:'검증 매장',role:'user',type:'access',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
      await context.addInitScript(token=>localStorage.setItem('token',token),'eyJhbGciOiJIUzI1NiJ9.'+payload+'.fixture');
      await context.routeWebSocket('**',socket=>socket.close());
      await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.pathname.includes('/socket.io'))return route.abort();
        if(!url.pathname.startsWith('/api/'))return route.continue();
        const store={id:3,name:'검증 매장',business_type:'RESTAURANT',user_id:3,theme:'{}'};
        const settlement={id:1,period_start:'2026-10-01',period_end:'2026-10-06',status:'COMPLETED',total_sales:10000,net_amount:9700,created_at:new Date().toISOString(),payment_method_breakdown:JSON.stringify({cash:1000,store_card:1000,transfer:1000,kakao:1000,naver:1000,toss_pay:1000,point:1000,mixed:1000,other:1000})};
        let data=[];
        if(url.pathname==='/api/stores/my')data=[store];
        else if(url.pathname==='/api/stores/3')data=store;
        else if(url.pathname.includes('/legal/admin/'))data={business_name:'검증 사업자'};
        else if(url.pathname.endsWith('/business'))data={business_name:'검증 사업자',enabled_payment_methods:['cash','transfer'],store_accounts:[]};
        else if(url.pathname.endsWith('/settlements/summary'))data={total_sales:10000,total_commission:300,total_net:9700};
        else if(url.pathname.endsWith('/settlements/1'))data=settlement;
        else if(url.pathname.endsWith('/settlements'))data=[settlement];
        else if(url.pathname.endsWith('/pricing/rules'))data=['TIME_BASED','DEMAND_BASED','INVENTORY_BASED','WEATHER_BASED','COMPETITOR_BASED'].map((rule_type,id)=>({id,rule_type,rule_name:rule_type,product_id:1,base_price:1000,min_price:500,max_price:1500,config:{},is_active:true}));
        else if(url.pathname.endsWith('/pricing/jobs'))data=[{id:1,status:'COMPLETED',job_type:'TEST'}];
        else if(url.pathname.endsWith('/pricing/logs'))data={items:[{id:1,old_price:1000,new_price:900,trigger_type:'MANUAL',created_at:new Date().toISOString()}]};
        else if(url.pathname.endsWith('/pricing/forecasts'))data=[{id:1,product_id:1,predicted_demand:5,factors:{}}];
        else if(url.pathname.includes('/analysis'))data=null;
        return route.fulfill({json:{success:true,data}});
      });
      const page=await context.newPage();const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error'&&/Expected length|attribute (width|height)/.test(m.text()))errors.push(m.text());});
      await page.goto(new URL('/admin/stores/3/'+slug,base).href,{waitUntil:'domcontentloaded'});
      const expected={settlements:'정산 관리 시스템',legal:'사업자 정보 (전자상거래법 §13)',pricing:'가격 규칙',campaigns:'등록된 캠페인이 없습니다', 'store-settings':'영업시간',settings:'사업자 설정 및 테마 관리'}[slug];
      try {
        await page.locator('#admin-content').getByText(expected,{exact:false}).first().waitFor();
        if(slug==='legal')assert.equal(await page.locator('input[name=business_name]').inputValue(),'검증 사업자');
        if(slug==='settlements'){await page.getByRole('row').filter({hasText:'2026-10-01'}).click();await page.getByText('결제수단별 매출 분해',{exact:true}).waitFor();}
        if(slug==='pricing')for(const label of ['변경 이력','최적화 작업','수요 예측','가격 규칙']){await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(250);}
        if(slug==='campaigns'){await page.getByRole('button',{name:'캠페인 만들기',exact:true}).click();await page.getByText('트리거 유형',{exact:false}).first().waitFor();}
        if(slug==='settings'){await page.getByRole('button').filter({hasText:'결제수단 활성화'}).click();await page.getByText('토스페이먼츠',{exact:true}).waitFor();}
        assert.equal(errors.length,0,errors.join(';'));
        assert.equal(await page.getByText('페이지를 불러오는 중 예기치 않은 오류가 생겼습니다.',{exact:false}).count(),0);
        results.push({slug,passed:true,fixtureData:true,pageErrors:errors});
      }catch(e){console.error(JSON.stringify({slug,errors,body:(await page.locator('body').innerText()).slice(0,2000)}));throw e;}
      await context.close();
    }
    fs.writeFileSync('reports/admin-pages-browser-validation.json',JSON.stringify({passed:true,base,results},null,2));console.log(JSON.stringify({passed:true,results}));
  }finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
