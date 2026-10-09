const test=require('node:test'),assert=require('node:assert/strict');
const {PassThrough}=require('node:stream');const winston=require('winston');const logger=require('../../utils/logger');
test('actual logger removes nested PG credentials, customer identifiers and phone text',async()=>{
 const stream=new PassThrough(),transport=new winston.transports.Stream({stream});logger.add(transport);
 try{
  const result=new Promise(resolve=>stream.once('data',chunk=>resolve(chunk.toString())));
  logger.info('phone=01012345678',{paymentKey:'fixture-payment-secret',customerKey:'fixture-customer-secret',nested:{authorization:'Bearer fixture-token'}});
  const line=await result;
  for(const value of ['01012345678','fixture-payment-secret','fixture-customer-secret','fixture-token']) assert.equal(line.includes(value),false);
 }finally{logger.remove(transport);}
});
