'use client';
import React,{Children,cloneElement,isValidElement,useState} from 'react';
function value(node:any):any{
 if(node==null||node===false)return '';
 if(typeof node==='number'||typeof node==='string')return node;
 if(Array.isArray(node))return node.map(value).join('');
 if(node.props?.v!==undefined)return node.props.v;
 if(node.props?.value!==undefined)return node.props.value;
 return value(node.props?.children);
}
function key(node:any){const v=value(node);if(v==null||v==='—'||v==='Not checked'||v==='Unavailable')return null;if(typeof v==='number')return v;const s=String(v).trim();if(/^\d{2} [A-Z][a-z]{2} \d{4}$/.test(s))return Date.parse(s);if(/^[-+−$\d,.%]+[KMBT]?$/.test(s)){const k=s.endsWith('K')?1e3:s.endsWith('M')?1e6:s.endsWith('B')?1e9:s.endsWith('T')?1e12:1;return Number(s.replace(/−/g,'-').replace(/[$,%KMBT]/g,''))*k;}return s.toLowerCase();}
export default function SortableTable({children}:{children:any}){
 const [sort,setSort]=useState({i:-1,d:1});const parts=Children.toArray(children) as any[],head=parts.find(p=>p.type==='thead'),body=parts.find(p=>p.type==='tbody');
 if(!head||!body)return <table>{children}</table>;
 const headRow=Children.toArray(head.props.children)[0] as any,ths=Children.toArray(headRow.props.children) as any[],rows=Children.toArray(body.props.children).filter(isValidElement) as any[];
 const sorted=sort.i<0?rows:[...rows].sort((a,b)=>{const x=key(Children.toArray(a.props.children)[sort.i]),y=key(Children.toArray(b.props.children)[sort.i]);if(x==null)return y==null?0:1;if(y==null)return -1;return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y)))*sort.d});
 return <table><thead><tr>{ths.map((th,i)=>cloneElement(th,{key:i,'aria-sort':sort.i===i?(sort.d===1?'ascending':'descending'):'none'},<button onClick={()=>setSort({i,d:sort.i===i?-sort.d:1})}>{th.props.children} <span>{sort.i===i?(sort.d===1?'↑':'↓'):'↕'}</span></button>))}</tr></thead><tbody>{sorted}</tbody></table>
}
