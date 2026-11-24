import json,html,sys
src=open('grade-howto.html').read()
fonts=src[src.index('@font-face'):src.index('*{box-sizing')]
CSS='''*{box-sizing:border-box}body{margin:0;background:#0d1219}
.c{width:1080px;height:1350px;padding:58px 64px 46px;color:#e8edf2;font-family:Plex,sans-serif;display:flex;flex-direction:column;gap:26px;
 background:radial-gradient(900px 420px at 92% -6%,color-mix(in srgb,var(--a) 22%,transparent),transparent 70%),radial-gradient(800px 420px at -10% 108%,rgba(127,224,143,.10),transparent 70%),#0d1219}
.k{font:500 19px Mono;letter-spacing:.14em;color:var(--a);text-transform:uppercase}
h1{margin:8px 0 0;font:700 72px/0.95 Rajdhani}
.sub{font-size:24px;color:#9fb0c2;margin-top:8px;line-height:1.35}
.b{border-radius:20px;padding:22px 28px 24px;background:#121a24;border:1px solid #1f2a36;border-left:9px solid var(--c);display:grid;gap:15px}
.b h2{margin:0 0 2px;font:700 38px/1 Rajdhani;color:var(--c);display:flex;align-items:center}
.b h2 i{font-style:normal;font:500 16px Mono;letter-spacing:.12em;color:#8d99a6;margin-left:auto;text-transform:uppercase}
.st{display:grid;grid-template-columns:38px 1fr;gap:14px;align-items:start}
.n{width:38px;height:38px;border-radius:50%;background:var(--c);color:#0d1219;font:700 24px/38px Rajdhani;text-align:center}
.d{width:12px;height:12px;border-radius:50%;background:var(--c);margin:14px 0 0 13px}
.st p{margin:3px 0 0;font-size:24px;line-height:1.4;color:#dbe3ec}.st p b{color:#fff;font-weight:600}
.ui{display:inline-flex;align-items:center;gap:6px;font:600 20px Plex;padding:2px 11px;border-radius:9px;border:1px solid #3a4656;background:#1b2531;color:#e8edf2;vertical-align:2px;white-space:nowrap}
.ui.p{background:#1f8fcf;border-color:#1f8fcf;color:#fff}.ui.v{background:#5865f2;border-color:#5865f2;color:#fff}
.tip{border:1px dashed #2a3542;border-radius:16px;padding:16px 22px;font-size:21px;color:#9fb0c2;line-height:1.4}.tip b{color:#e8edf2}
.foot{display:flex;justify-content:space-between;font:500 19px Mono;color:#8d99a6;letter-spacing:.04em}
'''
def page(d):
    out=f'<!doctype html><meta charset="utf-8"><style>{fonts}{CSS}</style><div class="c" style="--a:{d["a"]}"><div><div class="k">{d["k"]}</div><h1>{d["t"]}</h1><div class="sub">{d["s"]}</div></div>'
    for sec in d['secs']:
        out+=f'<section class="b" style="--c:{sec.get("c",d["a"])}"><h2>{sec["h"]}<i>{sec.get("i","")}</i></h2>'
        for j,it in enumerate(sec['it']):
            mark=f'<span class="n">{it[0]}</span>' if sec.get('num') else '<span class="d"></span>'
            out+=f'<div class="st">{mark}<p>{it[-1]}</p></div>'
        out+='</section>'
    if d.get('tip'): out+=f'<div class="tip">{d["tip"]}</div>'
    out+=f'<div class="foot" style="margin-top:auto"><span>destinyparallel.vercel.app{d["url"]}</span><span>DPI · tutorial {d["no"]}</span></div></div>'
    return out
for d in json.load(open(sys.argv[1])):
    open(f'tut-{d["f"]}.html','w').write(page(d))
    print(d['f'])
