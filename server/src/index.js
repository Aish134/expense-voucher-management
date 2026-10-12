import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const app = express();
const PORT = process.env.PORT || 4000;
const SECRET = process.env.JWT_SECRET || 'dev-only-change-this-secret';
const here = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(here, '../uploads');
fs.mkdirSync(uploadDir, {recursive:true});
app.use(cors({origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173'}));
app.use(express.json({limit:'1mb'}));
app.use('/uploads', express.static(uploadDir));
const upload = multer({storage:multer.diskStorage({
 destination:(_,__,cb)=>cb(null,uploadDir),
 filename:(_,file,cb)=>cb(null,`${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`)
}), limits:{fileSize:2*1024*1024}, fileFilter:(_,f,cb)=>cb(null,['image/png','image/jpeg','image/webp'].includes(f.mimetype))});
const now = () => new Date().toISOString();
const publicUser = u => ({id:u.id,name:u.name,email:u.email,role:u.role,employeeId:u.employee_id,department:u.department});
function auth(req,res,next){
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 try { if(!token) throw new Error(); req.user=jwt.verify(token,SECRET); next(); }
 catch { res.status(401).json({error:'Please sign in to continue.'}); }
}
const allow = (...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'You do not have permission to perform this action.'});
const voucherSelect = `SELECT v.*,u.name employee_name,u.email employee_email,u.employee_id employee_code FROM vouchers v JOIN users u ON u.id=v.employee_id`;
function event(voucherId,actorId,action,note=''){db.prepare('INSERT INTO workflow_events(voucher_id,actor_id,action,note,created_at) VALUES(?,?,?,?,?)').run(voucherId,actorId,action,note,now());}
function getVoucher(id){return db.prepare(`${voucherSelect} WHERE v.id=?`).get(id);}
function canView(v,u){return u.role!=='employee'||v.employee_id===u.id;}
app.get('/api/health',(_,res)=>res.json({ok:true,service:'Expense Voucher API'}));
app.post('/api/auth/login',(req,res)=>{
 const {email,password}=req.body||{};
 const u=db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(String(email||'').trim());
 if(!u||!bcrypt.compareSync(String(password||''),u.password_hash)) return res.status(401).json({error:'Invalid email or password.'});
 const token=jwt.sign({id:u.id,role:u.role,name:u.name},SECRET,{expiresIn:'8h'});
 res.json({token,user:publicUser(u)});
});
app.get('/api/auth/me',auth,(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id); if(!u)return res.status(401).json({error:'User not found'});res.json({user:publicUser(u)});});
app.get('/api/dashboard',auth,(req,res)=>{
 let rows=req.user.role==='employee'?db.prepare(`${voucherSelect} WHERE v.employee_id=?`).all(req.user.id):db.prepare(voucherSelect).all();
 const sum=(xs)=>xs.reduce((n,v)=>n+Number(v.amount),0);
 const countStatus=s=>rows.filter(v=>v.status===s).length;
 const data={total:rows.length,drafts:countStatus('Draft'),pending:countStatus('Pending Approval'),approved:countStatus('Approved'),rejected:countStatus('Rejected'),totalAmount:sum(rows),pendingAmount:sum(rows.filter(v=>v.status==='Pending Approval')),approvedAmount:sum(rows.filter(v=>v.status==='Approved')),recent:rows.sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).slice(0,6)};
 res.json(data);
});
app.get('/api/vouchers',auth,(req,res)=>{
 const {q='',status='',department='',category=''}=req.query;
 let rows=req.user.role==='employee'?db.prepare(`${voucherSelect} WHERE v.employee_id=?`).all(req.user.id):db.prepare(voucherSelect).all();
 const query=String(q).toLowerCase();
 rows=rows.filter(v=>(!query||[v.voucher_no,v.employee_name,v.title,v.department].some(x=>String(x||'').toLowerCase().includes(query)))&&(!status||v.status===status)&&(!department||v.department===department)&&(!category||v.category===category));
 rows.sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
 res.json({vouchers:rows});
});
app.post('/api/vouchers',auth,allow('employee'),(req,res)=>{
 const b=req.body||{};
 if(!b.department||!b.title||!b.expense_date||!b.category||!(Number(b.amount)>0))return res.status(400).json({error:'Department, title, category, expense date and a positive amount are required.'});
 const t=now(), voucherNo=`EV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
 const result=db.prepare(`INSERT INTO vouchers(voucher_no,employee_id,voucher_date,expense_date,department,title,category,description,amount,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'Draft',?,?)`).run(voucherNo,req.user.id,b.voucher_date||t.slice(0,10),b.expense_date,b.department,b.title,b.category,b.description||'',Number(b.amount),t,t);
 event(result.lastInsertRowid,req.user.id,'Created draft');
 res.status(201).json({voucher:getVoucher(result.lastInsertRowid)});
});
app.get('/api/vouchers/:id',auth,(req,res)=>{
 const v=getVoucher(Number(req.params.id)); if(!v)return res.status(404).json({error:'Voucher not found.'});
 if(!canView(v,req.user))return res.status(403).json({error:'You cannot view this voucher.'});
 const history=db.prepare('SELECT e.*,u.name actor_name,u.role actor_role FROM workflow_events e JOIN users u ON u.id=e.actor_id WHERE e.voucher_id=? ORDER BY e.id DESC').all(v.id);
 res.json({voucher:v,history});
});
app.put('/api/vouchers/:id',auth,allow('employee'),(req,res)=>{
 const v=getVoucher(Number(req.params.id));if(!v)return res.status(404).json({error:'Voucher not found.'});
 if(v.employee_id!==req.user.id)return res.status(403).json({error:'Not your voucher.'});
 if(v.status!=='Draft')return res.status(409).json({error:'Only draft vouchers can be edited.'});
 const b=req.body||{};if(!b.department||!b.title||!b.expense_date||!b.category||!(Number(b.amount)>0))return res.status(400).json({error:'Complete all required fields and enter a positive amount.'});
 db.prepare(`UPDATE vouchers SET voucher_date=?,expense_date=?,department=?,title=?,category=?,description=?,amount=?,updated_at=? WHERE id=?`).run(b.voucher_date||v.voucher_date,b.expense_date,b.department,b.title,b.category,b.description||'',Number(b.amount),now(),v.id);
 event(v.id,req.user.id,'Updated draft');res.json({voucher:getVoucher(v.id)});
});
app.delete('/api/vouchers/:id',auth,allow('employee'),(req,res)=>{
 const v=getVoucher(Number(req.params.id));if(!v)return res.status(404).json({error:'Voucher not found.'});
 if(v.employee_id!==req.user.id||v.status!=='Draft')return res.status(403).json({error:'Only your own draft vouchers can be deleted.'});
 db.prepare('DELETE FROM workflow_events WHERE voucher_id=?').run(v.id);db.prepare('DELETE FROM vouchers WHERE id=?').run(v.id);res.json({ok:true});
});
async function saveSignature(req,res,kind){
 const v=getVoucher(Number(req.params.id));if(!v)return res.status(404).json({error:'Voucher not found.'});
 if(kind==='employee'&&(req.user.role!=='employee'||v.employee_id!==req.user.id||v.status!=='Draft'))return res.status(403).json({error:'Employee signature can only be added to your draft.'});
 if(kind==='director'&&(req.user.role!=='director'||v.status!=='Pending Approval'))return res.status(403).json({error:'Director signature is only available for pending vouchers.'});
 if(!req.file)return res.status(400).json({error:'Upload a PNG, JPG or WEBP image (max 2 MB).'});
 const col=kind==='employee'?'employee_signature':'director_signature';
 db.prepare(`UPDATE vouchers SET ${col}=?,updated_at=? WHERE id=?`).run(`/uploads/${req.file.filename}`,now(),v.id);
 event(v.id,req.user.id,`Uploaded ${kind} signature`);res.json({voucher:getVoucher(v.id)});
}
app.post('/api/vouchers/:id/employee-signature',auth,upload.single('signature'),(req,res)=>saveSignature(req,res,'employee').catch(e=>res.status(500).json({error:e.message})));
app.post('/api/vouchers/:id/director-signature',auth,upload.single('signature'),(req,res)=>saveSignature(req,res,'director').catch(e=>res.status(500).json({error:e.message})));
app.post('/api/vouchers/:id/submit',auth,allow('employee'),(req,res)=>{
 const v=getVoucher(Number(req.params.id));if(!v)return res.status(404).json({error:'Voucher not found.'});
 if(v.employee_id!==req.user.id||v.status!=='Draft')return res.status(403).json({error:'Only your draft vouchers can be submitted.'});
 if(!v.employee_signature)return res.status(400).json({error:'Upload your signature before submitting.'});
 db.prepare("UPDATE vouchers SET status='Pending Approval',updated_at=? WHERE id=?").run(now(),v.id);event(v.id,req.user.id,'Submitted for approval');res.json({voucher:getVoucher(v.id)});
});
app.post('/api/vouchers/:id/approve',auth,allow('director'),(req,res)=>{
 const v=getVoucher(Number(req.params.id));if(!v)return res.status(404).json({error:'Voucher not found.'});
 if(v.status!=='Pending Approval')return res.status(409).json({error:'Only pending vouchers can be approved.'});
 if(!v.director_signature)return res.status(400).json({error:'Upload your director signature before approving.'});
 const t=now();db.prepare("UPDATE vouchers SET status='Approved',approval_date=?,updated_at=? WHERE id=?").run(t,t,v.id);event(v.id,req.user.id,'Approved');res.json({voucher:getVoucher(v.id)});
});
app.post('/api/vouchers/:id/reject',auth,allow('director'),(req,res)=>{
 const v=getVoucher(Number(req.params.id));if(!v)return res.status(404).json({error:'Voucher not found.'});
 if(v.status!=='Pending Approval')return res.status(409).json({error:'Only pending vouchers can be rejected.'});
 const reason=String(req.body?.reason||'').trim();if(!reason)return res.status(400).json({error:'A rejection reason is required.'});
 db.prepare("UPDATE vouchers SET status='Rejected',rejection_reason=?,updated_at=? WHERE id=?").run(reason,now(),v.id);event(v.id,req.user.id,'Rejected',reason);res.json({voucher:getVoucher(v.id)});
});
app.use((err,req,res,next)=>{console.error(err);if(err instanceof multer.MulterError)return res.status(400).json({error:err.message});res.status(500).json({error:'Unexpected server error.'});});
app.listen(PORT,()=>console.log(`Expense Voucher API running at http://localhost:${PORT}`));
