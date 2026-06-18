import re, io

path = r'e:\full-pipeline--pen-reveal\server.ts'
newpath = r'e:\full-pipeline--pen-reveal\_newfunc.tmp'

with io.open(path, 'r', encoding='utf-8', newline='') as f:
    raw = f.read()
with io.open(newpath, 'r', encoding='utf-8', newline='') as f:
    new = f.read()

nl = '\r\n' if raw.count('\r\n') * 2 >= raw.count('\n') else '\n'
new = new.replace('\r\n', '\n').replace('\n', nl)
if new.endswith(nl):
    new = new[:-len(nl)]

pattern = re.compile(
    r'  function generateFallbackStoryboardSVG\(steps: Array<any>, _style: string, _bgColor: string\): string \{.*?\r?\n  \}',
    re.DOTALL,
)
matches = pattern.findall(raw)
if len(matches) != 1:
    raise SystemExit('Aborting: expected exactly 1 match, got %d' % len(matches))

result, n = pattern.subn(lambda m: new, raw, count=1)

with io.open(path, 'w', encoding='utf-8', newline='') as f:
    f.write(result)

print('REPLACED=%d newline=%r' % (n, nl))
