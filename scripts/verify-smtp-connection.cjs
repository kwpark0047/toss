// No DB access, no OTP/account creation, no retry. Explicit --send for one mail.
const fs=require('node:fs'),dotenv=require('dotenv'),nodemailer=require('nodemailer');
const {normalizeEmail}=require('../utils/freeAuthPolicy');
async function verifySmtp(env,{recipient,send=false},create=nodemailer.createTransport){
 const from=normalizeEmail(env.MAIL_FROM||env.SMTP_FROM),to=normalizeEmail(recipient),port=Number(env.SMTP_PORT||587);
 if(!env.SMTP_HOST||!env.SMTP_USER||!env.SMTP_PASSWORD||![465,587,2525].includes(port))throw Error('SMTP_CONFIGURATION_REQUIRED');
 const transport=create({host:env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},tls:{rejectUnauthorized:true},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000,disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false});
 try{
  await transport.verify();
  if(!send)return {smtpAuthenticated:true,sent:false,delivered:false};
  const result=await transport.sendMail({from,to,subject:'[위마켓] 이메일 발송 연결 테스트',text:'위마켓 이메일 공급자 연결을 확인하기 위한 테스트 메일입니다. 인증번호나 로그인 링크가 아니며 계정을 생성하거나 변경하지 않습니다. 수신하셨다면 위마켓 검증 대화에서 수신 완료를 알려 주세요.'});
  if(!result.accepted?.some(value=>String(value).toLowerCase()===to)||result.rejected?.length)throw Error('SMTP_NOT_ACCEPTED');
  return {smtpAuthenticated:true,sent:true,providerAccepted:true,delivered:false,authenticationFlowVerified:false};
 }finally{transport.close?.();}
}
module.exports={verifySmtp};
if(require.main===module){
 const source=process.argv[2],recipient=process.argv[3];
 if(!source||!recipient)throw Error('EXPLICIT_ENV_PATH_AND_RECIPIENT_REQUIRED');
 const env=dotenv.parse(fs.readFileSync(source));
 verifySmtp(env,{recipient,send:process.argv.includes('--send')}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(JSON.stringify({failed:true,code:/^[A-Z_0-9]{1,60}$/.test(error.code||error.message)?error.code||error.message:'SMTP_VERIFICATION_FAILED',responseCode:Number.isInteger(error.responseCode)?error.responseCode:undefined}));process.exitCode=1;});
}
