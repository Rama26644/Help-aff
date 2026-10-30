import {Telegram,encryptionKey} from './telegram.js';
import {database} from './db.js';
import {application} from './app.js';
import express from 'express';
import path from 'node:path';
const db=await database(process.env.DATABASE_URL,process.env.DATA_DIR||'.data/postgres');
const telegram=new Telegram(db,await encryptionKey(process.env.SECRET_DIR||'.data/secrets'));
telegram.start();
const app=await application(db,{password:process.env.ADMIN_PASSWORD,telegram,production:process.env.NODE_ENV==='production'});
if(process.env.NODE_ENV==='production'){app.use(express.static('dist'));app.get('/{*path}',(req,res)=>res.sendFile(path.resolve('dist/index.html')));}else{const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
const server=app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Rama assistant: server started'));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{await telegram.stop();server.close(async()=>{if(db.close)await db.close();else await db.end();process.exit(0);});});
