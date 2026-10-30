const regions=new Intl.DisplayNames(['ru'],{type:'region'});
export function formatGeo(value){if(!value)return 'не указано';return value.split(/[,;]/).map(x=>{const raw=x.trim();if(!/^[a-z]{2}$/i.test(raw))return raw;const code=raw.toUpperCase();const name=regions.of(code);return name&&name!==code&&code!=='ZZ'?`${name} (${code})`:code;}).join(', ');}
export const arMeanings={reference:'ориентир',actual:'фактический показатель',guarantee:'согласованная гарантия'};
export function formatAR(data){return data.ar?`${data.ar} (${arMeanings[data.arMeaning]||'смысл не уточнён'})`:'';}
