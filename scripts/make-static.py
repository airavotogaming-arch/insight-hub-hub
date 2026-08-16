import re,os,glob,urllib.request
h=urllib.request.urlopen("http://localhost:8080/").read().decode('utf-8','replace')
# strip dev scripts and dev stylesheets
h=re.sub(r'<script[^>]*src="/@id/[^"]*"[^>]*></script>','',h)
h=re.sub(r'<link[^>]*href="/@tanstack-start/[^"]*"[^>]*>','',h)
h=re.sub(r'<link[^>]*href="/src/styles.css"[^>]*>','',h)
h=re.sub(r'<link[^>]*href="/@id/[^"]*"[^>]*>','',h)

# map /src/assets/x.png -> hashed built asset
built={}
for f in os.listdir('dist/client/assets'):
    base=re.sub(r'-[A-Za-z0-9_-]{8}(\.[a-z0-9]+)$',r'\1',f)
    built[base]=f
def rep(m):
    name=os.path.basename(m.group(1))
    return './assets/'+built.get(name,name)
h=re.sub(r'"(/src/assets/[^"]+)"',lambda m:'"'+rep(m)+'"',h)
css=[f for f in built if f.startswith('styles')]
cssfile=built[css[0]]
entry=[f for f in os.listdir('dist/client/assets') if f.startswith('index-') and f.endswith('.js')][0]
h=h.replace('</head>',f'<link rel="stylesheet" href="./assets/{cssfile}"></head>')
h=h.replace('</body>',f'<script type="module" src="./assets/{entry}"></script></body>')
h=h.replace('href="/favicon','href="./favicon').replace('src="/toys','src="./toys')
open('dist/client/index.html','w',encoding='utf-8').write(h)
print("ok",len(h),cssfile,entry)
