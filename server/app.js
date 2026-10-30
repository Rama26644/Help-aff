import express from 'express';
import bcrypt from 'bcryptjs';
import {randomBytes,createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
export async function application(db,{password,production=false,telegram,ai}={}) {
 if(!password || password.length<12) throw Error('Задайте ADMIN_PASSWORD длиной не менее 12 символов в .env');
 await db.query('INSERT INTO users(username,password) VALUES ($1,$2) ON CONFLICT(username) DO NOTHING',['rama',await bcrypt.hash(password,12)]);
 const app=express();app.disable('x-powered-by');app.set('trust proxy',1);app.use(express.json({limit:'64kb'}));
 app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','same-origin');if(req.path.startsWith('/api'))res.set('Cache-Control','no-store');next();});
 app.get('/api/health',async(req,res,next)=>{try{await db.query('SELECT 1');res.json({ok:true});}catch(e){next(e);}});
 app.use('/api',(req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)) {const origin=req.get('origin');if(!origin || origin!==`${req.protocol}://${req.get('host')}`)return res.status(403).json({error:'Недопустимый источник запроса'});}next();});
 const attempts=new Map();
 app.post('/api/login',async(req,res,next)=>{try{
 const key=req.ip,now=Date.now();let a=attempts.get(key);if(!a||a.until<now){a={count:0,until:now+900000};attempts.set(key,a);}if(a.count>=10)return res.status(429).json({error:'Слишком много попыток. Подождите 15 минут.'});a.count++;
 const u=(await db.query('SELECT * FROM users WHERE username=$1',['rama'])).rows[0];
 if(typeof req.body.password!=='string'||req.body.password.length>256||!await bcrypt.compare(req.body.password,u.password))return res.status(401).json({error:'Неверный пароль'});
 attempts.delete(key);const token=randomBytes(32).toString('hex');await db.query('DELETE FROM sessions WHERE expires<$1',[now]);await db.query('INSERT INTO sessions VALUES($1,$2,$3)',[hash(token),u.id,now+86400000]);
 res.cookie('session',token,{httpOnly:true,secure:production,sameSite:'strict',maxAge:86400000,path:'/'});res.json({username:'rama'});
 }catch(e){next(e);}});
 app.use('/api',async(req,res,next)=>{try{const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('session='))?.slice(8);if(!token)return res.status(401).json({error:'Войдите в аккаунт'});const s=await db.query('SELECT user_id FROM sessions WHERE token=$1 AND expires>$2',[hash(token),Date.now()]);if(!s.rows.length)return res.status(401).json({error:'Сессия завершена'});req.sessionToken=hash(token);next();}catch(e){next(e);}});
 app.get('/api/me',(req,res)=>res.json({username:'rama'}));
 app.post('/api/logout',async(req,res,next)=>{try{await db.query('DELETE FROM sessions WHERE token=$1',[req.sessionToken]);res.clearCookie('session',{path:'/'});res.json({ok:true});}catch(e){next(e);}});
 if(ai){
 app.get('/api/ai',async(req,res,next)=>{try{res.json(await ai.status());}catch(e){next(e);}});
 app.post('/api/ai',async(req,res)=>{if(!req.secure&&!['localhost','127.0.0.1','::1'].includes(req.hostname))return res.status(403).json({error:'Для API-ключа нужен HTTPS или localhost'});try{res.json(await ai.configure(req.body.apiKey,req.body.model));}catch(e){res.status(400).json({error:e.message});}});
 app.delete('/api/ai',async(req,res,next)=>{try{await ai.disconnect();res.json({ok:true});}catch(e){next(e);}});
 }
 if(telegram){
 app.get('/api/telegram',async(req,res,next)=>{try{res.json(await telegram.status());}catch(e){next(e);}});
 app.post('/api/telegram',async(req,res)=>{const host=req.hostname; if(!req.secure&&!['localhost','127.0.0.1','::1'].includes(host))return res.status(403).json({error:'Для ввода токена нужен HTTPS или localhost на вашем компьютере'});try{res.json(await telegram.configure(req.body.token));}catch(e){res.status(400).json({error:e.message});}});
 app.delete('/api/telegram',async(req,res,next)=>{try{await telegram.disconnect();res.json({ok:true});}catch(e){next(e);}});
 }
 const kinds=['affiliate','task','condition','content','connection'];
 app.get('/api/records',async(req,res,next)=>{try{res.json((await db.query('SELECT * FROM records ORDER BY id DESC')).rows);}catch(e){next(e);}});
 app.post('/api/records',async(req,res,next)=>{try{const {kind,company,data}=req.body;
 if(!kinds.includes(kind)||!['Altex','Buyo'].includes(company)||!data||typeof data!=='object'||Array.isArray(data)||typeof data.title!=='string'||!data.title.trim()||data.title.length>300)return res.status(400).json({error:'Проверьте название и компанию'});
 // Configuration accepts public metadata only. Credentials are deliberately unavailable until adapters exist.
 const allowed=kind==='connection'?['title','note']:['title','note','status','date','affiliateId','externalId','telegram','offer','geo','rate','currency','guarantee','offerId','goalId','consumerPrice','consumerCurrency','ar','arMeaning'];
 const clean=Object.fromEntries(allowed.filter(k=>typeof data[k]==='string'&&data[k].length<=5000).map(k=>[k,data[k]]));
 if(clean.affiliateId){const parent=(await db.query("SELECT id FROM records WHERE id=$1 AND kind='affiliate' AND company=$2",[Number(clean.affiliateId),company])).rows[0];if(!parent)return res.status(400).json({error:'Веб должен принадлежать выбранной компании'});}
 const saved=await db.query('INSERT INTO records(kind,company,data) VALUES($1,$2,$3) RETURNING *',[kind,company,JSON.stringify(clean)]);res.status(201).json(saved.rows[0]);
 }catch(e){next(e);}});
 app.patch('/api/records/:id',async(req,res,next)=>{try{const {status}=req.body;if(!['done','open'].includes(status))return res.status(400).json({error:'Некорректный статус'});const r=await db.query("UPDATE records SET data=jsonb_set(data,'{status}',$1::jsonb),updated_at=NOW() WHERE id=$2 AND kind='task' RETURNING *",[JSON.stringify(status),req.params.id]);if(!r.rows.length)return res.status(404).json({error:'Задача не найдена'});res.json(r.rows[0]);}catch(e){next(e);}});
 app.use('/api',(err,req,res,next)=>{console.error('API operation failed:',err.name);res.status(500).json({error:'Не удалось выполнить операцию. Повторите позже.'});});
 return app;
}
