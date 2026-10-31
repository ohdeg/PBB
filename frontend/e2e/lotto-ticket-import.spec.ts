import { test, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
const token='header.'+Buffer.from(JSON.stringify({userId:'ticket-test',sub:'ticket-test@example.invalid',nickname:'Test',userClass:'dev',exp:9000000000})).toString('base64url')+'.signature'
const draw={round:1200,mainNumbers:[1,2,3,4,5,6],bonusNumber:7}
const engine=`export async function createWorker(){return {recognize:async()=>({data:{text:'제 1201 회\\nA 자동 01 02 03 04 05 06'}}),terminate:async()=>{}}}`
test.beforeEach(async({page},info)=>{
 const root=info.config.metadata.staticBuildDir as string|undefined
 let picks: unknown[]=[]
 const origin=new URL(String(info.project.use.baseURL??'http://127.0.0.1:4173')).origin
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  if(url.pathname.startsWith('/api/')) {
   const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true'}
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{...headers,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,PUT,POST,OPTIONS'}})
   let data:unknown={}
   if(url.pathname.endsWith('/auth/refresh'))data={accessToken:token}
   else if(url.pathname.endsWith('/draws'))data=[draw]
   else if(url.pathname.endsWith('/pattern-profiles'))data={profiles:{}}
   else if(url.pathname.endsWith('/picks')) {
    if(route.request().method()==='PUT')picks=JSON.parse(route.request().postDataJSON().itemsJson)
    data={targetRound:null,itemsJson:JSON.stringify(picks)}
   }
   return route.fulfill({status:200,json:data,headers})
  }
  if(url.pathname==='/ocr/tesseract.esm.min.js')return route.fulfill({contentType:'text/javascript',body:engine})
  if(!root)return route.continue()
  if(url.hostname!=='sixpick.test')return route.abort()
  let name=decodeURIComponent(url.pathname);if(!path.extname(name))name='/index.html'
  const dest=path.resolve(root,'.'+name);if(!dest.startsWith(root+path.sep))return route.abort()
  try{return route.fulfill({body:await fs.readFile(dest),contentType:({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html','.png':'image/png'} as Record<string,string>)[path.extname(dest)]??'application/octet-stream'})}
  catch{return route.fulfill({status:404,body:''})}
 })
})
test('photo OCR adapter, explicit review, responsive dialog and saved history',async({page},info)=>{
 await page.setViewportSize({width:375,height:850});await page.goto('/hobbies/6pick/play')
 await page.getByRole('button',{name:'용지 등록',exact:true}).click()
 const dialog=page.getByRole('dialog')
 const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=800;const x=c.getContext('2d')!;x.fillStyle='white';x.fillRect(0,0,600,800);x.fillStyle='black';x.font='30px sans-serif';x.fillText('1201 A 01 02 03 04 05 06',20,100);return c.toDataURL('image/png').split(',')[1]})
 await page.getByLabel('용지 사진 선택',{exact:true}).setInputFiles({name:'synthetic-ticket.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')})
 await dialog.getByRole('button',{name:'번호 인식',exact:true}).click()
 await expect(dialog.getByLabel('회차',{exact:true})).toHaveValue('1201')
 await expect(dialog.getByRole('button',{name:'확인한 번호 저장'})).toBeDisabled()
 await dialog.getByLabel('A줄 확인 완료',{exact:true}).check()
 for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)}
 await page.screenshot({path:info.outputPath('ticket-review.png'),fullPage:true})
 await dialog.getByRole('button',{name:'확인한 번호 저장'}).click()
 await expect(dialog).not.toBeVisible();await expect(page.getByText('번호를 저장했습니다',{exact:true})).toBeVisible()
 await expect(page.getByText('용지 등록 · A',{exact:true})).toBeVisible()
 await page.reload();await expect(page.getByText('용지 등록 · A',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'용지 등록',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'직접 입력'}).click()
 await page.getByLabel('회차',{exact:true}).fill('1201')
 for(let i=0;i<6;i++)await page.getByLabel(`A줄 ${i+1}번째 번호`,{exact:true}).fill(String(i+1))
 await expect(page.getByText(/같은 번호가 이미 있습니다/)).toBeVisible()
})
